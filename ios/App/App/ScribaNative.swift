import AuthenticationServices
import Capacitor
import CryptoKit
import Security
import UIKit
import UniformTypeIdentifiers

/** Native capabilities are registered only in the bundled editor, never in a remote web view. */
@objc(ScribaViewController)
class ScribaViewController: CAPBridgeViewController {
    var darkChrome = true
    override var preferredStatusBarStyle: UIStatusBarStyle { darkChrome ? .lightContent : .darkContent }
    override func capacitorDidLoad() {
        // Capacitor makes WKWebView the root view. A separate container can reserve
        // safe areas without recursively resizing that root during UIKit layout.
        if let web = webView {
            let container = UIView()
            container.addSubview(web); web.translatesAutoresizingMaskIntoConstraints = false
            view = container
            NSLayoutConstraint.activate([
                web.topAnchor.constraint(equalTo: container.safeAreaLayoutGuide.topAnchor),
                web.bottomAnchor.constraint(equalTo: container.keyboardLayoutGuide.topAnchor),
                web.leadingAnchor.constraint(equalTo: container.safeAreaLayoutGuide.leadingAnchor),
                web.trailingAnchor.constraint(equalTo: container.safeAreaLayoutGuide.trailingAnchor)
            ])
        }
        bridge?.registerPluginInstance(ScribaNative())
        webView?.allowsBackForwardNavigationGestures = false
    }
}

/** Files access uses a user-granted security-scoped bookmark; credentials remain native. */
@objc(ScribaNative)
class ScribaNative: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate, ASWebAuthenticationPresentationContextProviding {
    let identifier = "ScribaNative"
    let jsName = "ScribaNative"
    let pluginMethods: [CAPPluginMethod] = [
        "folderStatus", "chooseFolder", "authorizeFolder", "disconnectFolder", "readNotes", "saveNote",
        "document", "documentVersion", "renameNote", "shareFile", "githubRequest", "githubLogin", "openExternal", "appearance", "accessibilityPreferences", "updateInfo", "openUpdate"
    ].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }

    private let defaults = UserDefaults.standard
    private let files = FileManager.default
    private let worker = DispatchQueue(label: "com.aeonbridge.scriba.files", qos: .userInitiated)
    private let network = DispatchQueue(label: "com.aeonbridge.scriba.network", qos: .userInitiated)
    private let gateway = "https://scriba.aeonbridge.app"
    private let bookmarkKey = "scriba.files.bookmark"
    private var pickerCall: CAPPluginCall?
    private var authentication: ASWebAuthenticationSession?

    @objc func accessibilityPreferences(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["reduceTransparency": UIAccessibility.isReduceTransparencyEnabled,
                          "increaseContrast": UIAccessibility.isDarkerSystemColorsEnabled])
        }
    }

    @objc func appearance(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let controller = self.bridge?.viewController as? ScribaViewController else { call.resolve(); return }
            controller.darkChrome = call.getBool("dark") ?? true
            let channel: (String) -> CGFloat = { min(255, max(0, CGFloat(call.getInt($0) ?? 0))) / 255 }
            let color = UIColor(red: channel("red"), green: channel("green"), blue: channel("blue"), alpha: 1)
            controller.view.backgroundColor = color; controller.webView?.backgroundColor = color
            controller.overrideUserInterfaceStyle = controller.darkChrome ? .dark : .light
            controller.setNeedsStatusBarAppearanceUpdate(); call.resolve()
        }
    }

    private func problem(_ message: String) -> NSError { NSError(domain: "Scriba", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
    private func hash(_ bytes: Data) -> String { SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined() }
    private func base64url(_ data: Data) -> String { data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }

    private func selectedParent() throws -> URL? {
        guard let bookmark = defaults.data(forKey: bookmarkKey) else { return nil }
        var stale = false
        let url = try URL(resolvingBookmarkData: bookmark, options: .withoutUI, relativeTo: nil, bookmarkDataIsStale: &stale)
        if stale {
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            defaults.set(try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil), forKey: bookmarkKey)
        }
        return url
    }

    private func withFolder<T>(_ action: (URL, URL) throws -> T) throws -> T {
        guard let parent = try selectedParent() else { throw problem("Selecione uma pasta em Files nas configurações.") }
        let accessed = parent.startAccessingSecurityScopedResource()
        defer { if accessed { parent.stopAccessingSecurityScopedResource() } }
        guard files.isReadableFile(atPath: parent.path) else { throw problem("Autorize novamente a pasta em Files.") }
        return try action(parent, parent.appendingPathComponent("scriba", isDirectory: true))
    }

    /** Reject traversal, hidden metadata and symlinks escaping the exact granted directory. */
    private func child(_ name: String, in root: URL) throws -> URL {
        let parts = name.split(separator: "/", omittingEmptySubsequences: false)
        guard !parts.isEmpty, parts.count <= 12, !parts.contains(where: { $0.isEmpty || $0.hasPrefix(".") || $0.contains("\\") || $0.contains("\0") }) else { throw problem("Caminho de arquivo inválido.") }
        let url = root.appendingPathComponent(name).standardizedFileURL.resolvingSymlinksInPath()
        let boundary = root.standardizedFileURL.resolvingSymlinksInPath().path + "/"
        guard url.path.hasPrefix(boundary) else { throw problem("O arquivo precisa estar dentro da pasta escolhida.") }
        return url
    }

    private func revisionKey(_ url: URL) -> String { "scriba.files.revision." + hash(Data(url.standardizedFileURL.path.utf8)) }
    private func rasterType(_ bytes: Data) -> String? {
        let prefix = Array(bytes.prefix(12))
        if prefix.starts(with: [137,80,78,71,13,10,26,10]) { return "image/png" }
        if prefix.starts(with: [255,216,255]) { return "image/jpeg" }
        if prefix.starts(with: Array("GIF87a".utf8)) || prefix.starts(with: Array("GIF89a".utf8)) { return "image/gif" }
        if prefix.count == 12 && Array(prefix[0..<4]) == Array("RIFF".utf8) && Array(prefix[8..<12]) == Array("WEBP".utf8) { return "image/webp" }
        return nil
    }

    private func read(_ url: URL, name: String, acknowledge: Bool) throws -> [String: Any] {
        let metadata = try url.resourceValues(forKeys: [.fileSizeKey, .contentModificationDateKey, .isRegularFileKey])
        guard metadata.isRegularFile == true, (metadata.fileSize ?? 0) <= 5 * 1024 * 1024 else { throw problem("O Markdown excede 5 MB ou não é um arquivo regular.") }
        let data = try Data(contentsOf: url)
        guard let value = String(data: data, encoding: .utf8) else { throw problem("O Markdown precisa estar em UTF-8.") }
        var attachments = [[String: Any]](), total = 0
        let expression = try NSRegularExpression(pattern: #"!\[[^\]]*\]\(<?([^\s)>]+)>?(?:\s+[^)]*)?\)"#)
        let source = value as NSString
        for match in expression.matches(in: value, range: NSRange(location: 0, length: source.length)) {
            guard attachments.count < 50, let relative = source.substring(with: match.range(at: 1)).removingPercentEncoding,
                  !attachments.contains(where: { ($0["path"] as? String) == relative }),
                  let image = try? child(relative, in: url.deletingLastPathComponent()),
                  let size = try? image.resourceValues(forKeys: [.fileSizeKey]).fileSize, size <= 10 * 1024 * 1024,
                  total + size <= 40 * 1024 * 1024, let bytes = try? Data(contentsOf: image), let mime = rasterType(bytes) else { continue }
            attachments.append(["path": relative, "data": bytes.base64EncodedString(), "mime": mime]); total += bytes.count
            if acknowledge { defaults.set(hash(bytes), forKey: revisionKey(image)) }
        }
        let version = hash(data)
        if acknowledge { defaults.set(version, forKey: revisionKey(url)) }
        return ["name": name, "value": value, "version": version, "files": attachments,
                "modifiedAt": ISO8601DateFormatter().string(from: metadata.contentModificationDate ?? Date())]
    }

    private func locate(_ name: String, parent: URL, folder: URL) throws -> URL? {
        for root in [folder, parent] {
            let url = try child(name, in: root)
            if files.fileExists(atPath: url.path) { return url }
            // Once a saved copy is known, its deletion must not reopen an older parent original.
            if root == folder && defaults.string(forKey: revisionKey(url)) != nil { return nil }
        }
        return nil
    }

    @objc func folderStatus(_ call: CAPPluginCall) {
        do { let url = try selectedParent(); call.resolve(["label": url.map { $0.lastPathComponent + "/scriba" } ?? ""]) }
        catch { call.reject("Autorize novamente a pasta em Files.") }
    }
    @objc func chooseFolder(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pickerCall == nil else { call.reject("A seleção de pasta já está aberta."); return }
            self.pickerCall = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
            picker.allowsMultipleSelection = false; picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }
    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { pickerCall?.reject("Seleção de pasta cancelada."); pickerCall = nil }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let call = pickerCall, let url = urls.first else { return }
        pickerCall = nil
        worker.async {
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            do {
                let folder = url.appendingPathComponent("scriba", isDirectory: true)
                try self.files.createDirectory(at: folder, withIntermediateDirectories: true)
                let bookmark = try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
                self.defaults.set(bookmark, forKey: self.bookmarkKey)
                call.resolve(["label": url.lastPathComponent + "/scriba"])
            } catch { call.reject("Não foi possível autorizar esta pasta. \(error.localizedDescription)") }
        }
    }
    @objc func authorizeFolder(_ call: CAPPluginCall) {
        worker.async {
            do { try self.withFolder { _, folder in try self.files.createDirectory(at: folder, withIntermediateDirectories: true) }; call.resolve() }
            catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func disconnectFolder(_ call: CAPPluginCall) { defaults.removeObject(forKey: bookmarkKey); call.resolve() }

    @objc func readNotes(_ call: CAPPluginCall) {
        worker.async {
            do {
                let notes = try self.withFolder { parent, folder -> [[String: Any]] in
                    var result = [String: [String: Any]]()
                    for root in [parent, folder] {
                        guard let entries = self.files.enumerator(at: root, includingPropertiesForKeys: [.isDirectoryKey, .isSymbolicLinkKey], options: [.skipsHiddenFiles, .skipsPackageDescendants]) else { continue }
                        for case let url as URL in entries {
                            let relative = String(url.path.dropFirst(root.path.count + 1)), parts = relative.split(separator: "/")
                            let metadata = try? url.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey])
                            if parts.count > 10 || parts.contains("node_modules") || metadata?.isSymbolicLink == true || (root == parent && parts.first == "scriba") { entries.skipDescendants(); continue }
                            guard result.count < 1000, ["md", "markdown", "mdown"].contains(url.pathExtension.lowercased()), metadata?.isDirectory != true else { continue }
                            // Loading one damaged/unsupported file must not hide the remaining library.
                            if let note = try? self.read(url, name: relative, acknowledge: root == folder) { result[relative] = note }
                        }
                    }
                    return Array(result.values)
                }
                call.resolve(["notes": notes])
            } catch { call.reject(error.localizedDescription) }
        }
    }
    @objc func document(_ call: CAPPluginCall) {
        worker.async {
            do {
                guard let name = call.getString("name") else { throw self.problem("Informe o nome da nota.") }
                let note = try self.withFolder { parent, folder in
                    guard let url = try self.locate(name, parent: parent, folder: folder) else { throw self.problem("O arquivo foi removido. Seu rascunho continua preservado.") }
                    return try self.read(url, name: name, acknowledge: url.path.hasPrefix(folder.path + "/"))
                }
                call.resolve(note)
            } catch { call.reject(error.localizedDescription) }
        }
    }
    /** A coordinated move keeps Markdown assets in place and refuses an existing destination. */
    @objc func renameNote(_ call: CAPPluginCall) {
        worker.async {
            do {
                guard let name = call.getString("name"), let newName = call.getString("newName"), let version = call.getString("version"),
                      newName.range(of: #"\.(md|markdown|mdown)$"#, options: [.regularExpression, .caseInsensitive]) != nil,
                      (name as NSString).deletingLastPathComponent == (newName as NSString).deletingLastPathComponent else { throw self.problem("Mantenha o arquivo na mesma pasta ao renomear.") }
                try self.withFolder { parent, folder in
                    guard let source = try self.locate(name, parent: parent, folder: folder) else { throw self.problem("O arquivo foi removido. Seu rascunho continua preservado.") }
                    let leaf = (newName as NSString).lastPathComponent
                    let target = try self.child(leaf, in: source.deletingLastPathComponent())
                    if source == target { return }
                    var coordinationError: NSError?
                    var moveError: Error?
                    NSFileCoordinator().coordinate(writingItemAt: source, options: .forMoving, writingItemAt: target, options: [], error: &coordinationError) { oldURL, newURL in
                        do {
                            guard self.hash(try Data(contentsOf: oldURL)) == version else { throw self.problem("O arquivo mudou. Reabra a nota antes de renomear.") }
                            let entries = try self.files.contentsOfDirectory(atPath: oldURL.deletingLastPathComponent().path)
                            guard !entries.contains(where: { $0.precomposedStringWithCanonicalMapping.lowercased() == leaf.precomposedStringWithCanonicalMapping.lowercased() }) else { throw self.problem("Já existe um arquivo com esse nome na pasta.") }
                            try self.files.moveItem(at: oldURL, to: newURL)
                        } catch { moveError = error }
                    }
                    if let error = coordinationError { throw error }
                    if let error = moveError { throw error }
                    self.defaults.set(version, forKey: self.revisionKey(target))
                    self.defaults.removeObject(forKey: self.revisionKey(source))
                }
                call.resolve()
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func documentVersion(_ call: CAPPluginCall) {
        worker.async {
            do {
                guard let name = call.getString("name") else { throw self.problem("Informe o nome da nota.") }
                let version: String? = try self.withFolder { parent, folder in
                    guard let url = try self.locate(name, parent: parent, folder: folder) else { return nil }
                    let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                    guard size <= 5 * 1024 * 1024 else { throw self.problem("O Markdown excede 5 MB.") }
                    return self.hash(try Data(contentsOf: url))
                }
                call.resolve(["version": version as Any? ?? NSNull()])
            } catch { call.reject(error.localizedDescription) }
        }
    }

    /** Each coordinated atomic write verifies the last acknowledged digest before changing the file. */
    private func write(_ data: Data, to url: URL) throws {
        try files.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
        var coordinationError: NSError?, writeError: Error?
        NSFileCoordinator().coordinate(writingItemAt: url, options: .forReplacing, error: &coordinationError) { target in
            do {
                if self.files.fileExists(atPath: target.path) {
                    let actual = self.hash(try Data(contentsOf: target))
                    guard actual == self.hash(data) || actual == self.defaults.string(forKey: self.revisionKey(url)) else { throw self.problem("O arquivo \(url.lastPathComponent) mudou fora do Scriba. Recarregue ou salve uma cópia.") }
                }
                try data.write(to: target, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                self.defaults.set(self.hash(data), forKey: self.revisionKey(url))
            } catch { writeError = error }
        }
        if let error = coordinationError ?? writeError as NSError? { throw error }
    }
    @objc func saveNote(_ call: CAPPluginCall) {
        worker.async {
            do {
                guard let name = call.getString("name"), let value = call.getString("value"), value.utf8.count <= 5 * 1024 * 1024,
                      ["md", "markdown", "mdown"].contains(URL(fileURLWithPath: name).pathExtension.lowercased()) else { throw self.problem("Nome ou tamanho de Markdown inválido.") }
                try self.withFolder { _, folder in
                    let destination = try self.child(name, in: folder)
                    let attachments = call.getArray("files", JSObject.self) ?? []
                    guard attachments.count <= 50 else { throw self.problem("A nota excede 50 imagens.") }
                    var writes = [(URL, Data)](), total = 0
                    for item in attachments {
                        guard let relative = item["path"] as? String, let encoded = item["data"] as? String, let data = Data(base64Encoded: encoded), data.count <= 10 * 1024 * 1024, self.rasterType(data) != nil else { throw self.problem("Imagem inválida ou maior que 10 MB.") }
                        total += data.count; guard total <= 40 * 1024 * 1024 else { throw self.problem("As imagens excedem 40 MB.") }
                        writes.append((try self.child(relative, in: destination.deletingLastPathComponent()), data))
                    }
                    writes.append((destination, Data(value.utf8)))
                    // Reject known conflicts before writing any part of the note or its images.
                    for (url, data) in writes where self.files.fileExists(atPath: url.path) {
                        let existing = self.hash(try Data(contentsOf: url))
                        guard existing == self.hash(data) || existing == self.defaults.string(forKey: self.revisionKey(url)) else { throw self.problem("O arquivo \(url.lastPathComponent) mudou fora do Scriba. Recarregue ou salve uma cópia.") }
                    }
                    for (url, data) in writes { try self.write(data, to: url) }
                }
                call.resolve()
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func shareFile(_ call: CAPPluginCall) {
        guard let name = call.getString("name"), name == URL(fileURLWithPath: name).lastPathComponent,
              let encoded = call.getString("data"), let data = Data(base64Encoded: encoded), data.count <= 60 * 1024 * 1024 else { call.reject("Arquivo de exportação inválido ou maior que 60 MB."); return }
        let folder = files.temporaryDirectory.appendingPathComponent("scriba-export-" + UUID().uuidString, isDirectory: true)
        do {
            try files.createDirectory(at: folder, withIntermediateDirectories: true)
            let url = folder.appendingPathComponent(name); try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            DispatchQueue.main.async {
                let controller = UIActivityViewController(activityItems: [url], applicationActivities: nil)
                controller.popoverPresentationController?.sourceView = self.bridge?.viewController?.view
                controller.popoverPresentationController?.sourceRect = CGRect(x: 20, y: 20, width: 1, height: 1)
                controller.completionWithItemsHandler = { _, _, _, error in
                    try? self.files.removeItem(at: folder)
                    if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
                }
                self.bridge?.viewController?.present(controller, animated: true)
            }
        } catch { try? files.removeItem(at: folder); call.reject(error.localizedDescription) }
    }

    /** A single opaque gateway cookie is protected by the device Keychain, never exposed to JS. */
    private var cookieQuery: [String: Any] { [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: "com.aeonbridge.scriba.github", kSecAttrAccount as String: "session"] }
    private func cookie() -> String? {
        var query = cookieQuery; query[kSecReturnData as String] = true
        var value: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &value) == errSecSuccess, let data = value as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    private func storeCookie(_ value: String?) throws {
        SecItemDelete(cookieQuery as CFDictionary)
        guard let value = value else { return }
        var query = cookieQuery; query[kSecValueData as String] = Data(value.utf8)
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else { throw problem("Não foi possível proteger a sessão GitHub no dispositivo.") }
    }
    private func request(_ route: String, body: String? = nil) throws -> (Int, String) {
        guard route.range(of: #"^(status|repositories|select|library|document|document-version|save|rename|token|logout|native/start|native/complete)(\?[^\r\n#]*)?$"#, options: .regularExpression) != nil,
              let url = URL(string: gateway + "/github/" + route), url.host == "scriba.aeonbridge.app" else { throw problem("Rota GitHub inválida.") }
        var request = URLRequest(url: url); request.timeoutInterval = 45; request.httpShouldHandleCookies = false
        request.setValue(gateway, forHTTPHeaderField: "Origin"); request.setValue("1", forHTTPHeaderField: "X-Scriba-Client")
        if let sessionCookie = cookie() { request.setValue("scriba_session=" + sessionCookie, forHTTPHeaderField: "Cookie") }
        if let body = body {
            guard body.utf8.count <= 60 * 1024 * 1024 else { throw problem("Envio maior que 60 MB.") }
            request.httpMethod = "POST"; request.httpBody = Data(body.utf8); request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        let configuration = URLSessionConfiguration.ephemeral; configuration.httpShouldSetCookies = false; configuration.httpCookieStorage = nil; configuration.urlCache = nil
        let session = URLSession(configuration: configuration), wait = DispatchSemaphore(value: 0)
        var result: (Int, String)?, failure: Error?
        session.dataTask(with: request) { data, response, error in
            defer { wait.signal() }
            do {
                if let error = error { throw error }
                guard let http = response as? HTTPURLResponse, http.url?.host == "scriba.aeonbridge.app", let data = data, data.count <= 65 * 1024 * 1024 else { throw self.problem("Resposta GitHub inválida.") }
                if let header = http.value(forHTTPHeaderField: "Set-Cookie"), let range = header.range(of: #"scriba_session=([a-f0-9]{64})"#, options: .regularExpression) {
                    let value = String(header[range]).replacingOccurrences(of: "scriba_session=", with: ""); try self.storeCookie(value)
                }
                result = (http.statusCode, String(data: data, encoding: .utf8) ?? "{}")
            } catch { failure = error }
        }.resume()
        wait.wait(); session.finishTasksAndInvalidate()
        if let error = failure { throw error }
        guard let response = result else { throw problem("Sem resposta do GitHub.") }
        if route == "logout" && response.0 == 200 { try storeCookie(nil) }
        return response
    }
    @objc func githubRequest(_ call: CAPPluginCall) {
        network.async {
            do {
                guard let route = call.getString("route") else { throw self.problem("Rota GitHub inválida.") }
                let (status, text) = try self.request(route, body: call.getString("body")); call.resolve(["status": status, "text": text])
            } catch { call.reject(error.localizedDescription) }
        }
    }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { bridge?.viewController?.view.window ?? ASPresentationAnchor() }
    @objc func githubLogin(_ call: CAPPluginCall) {
        network.async {
            do {
                var random = [UInt8](repeating: 0, count: 32)
                guard SecRandomCopyBytes(kSecRandomDefault, random.count, &random) == errSecSuccess else { throw self.problem("Não foi possível iniciar uma sessão segura.") }
                let verifier = self.base64url(Data(random)), challenge = self.base64url(Data(SHA256.hash(data: Data(verifier.utf8))))
                let body = String(data: try JSONSerialization.data(withJSONObject: ["challenge": challenge]), encoding: .utf8)!
                let (status, text) = try self.request("native/start", body: body)
                guard status == 200, let data = text.data(using: .utf8), let flow = try JSONSerialization.jsonObject(with: data) as? [String: String],
                      let state = flow["state"], let urlString = flow["url"], let url = URL(string: urlString), url.scheme == "https", url.host == "scriba.aeonbridge.app", url.path == "/github/login" else { throw self.problem("Não foi possível iniciar a conexão GitHub.") }
                DispatchQueue.main.async {
                    guard self.authentication == nil else { call.reject("A conexão GitHub já está aberta."); return }
                    let auth = ASWebAuthenticationSession(url: url, callbackURLScheme: "com.aeonbridge.scriba") { callback, error in
                        self.authentication = nil
                        guard error == nil, let callback = callback, callback.host == "github", callback.path == "/callback", URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems?.first(where: { $0.name == "state" })?.value == state else { call.reject("Conexão GitHub cancelada ou inválida."); return }
                        self.network.async {
                            do {
                                let body = String(data: try JSONSerialization.data(withJSONObject: ["state": state, "verifier": verifier]), encoding: .utf8)!
                                let (status, _) = try self.request("native/complete", body: body)
                                guard status == 200 else { throw self.problem("A autorização GitHub expirou. Conecte novamente.") }
                                call.resolve()
                            } catch { call.reject(error.localizedDescription) }
                        }
                    }
                    auth.presentationContextProvider = self; auth.prefersEphemeralWebBrowserSession = true; self.authentication = auth
                    if !auth.start() { self.authentication = nil; call.reject("Não foi possível abrir a autenticação GitHub.") }
                }
            } catch { call.reject(error.localizedDescription) }
        }
    }
    /** Update checks use fixed public endpoints and never include the private gateway session. */
    @objc func updateInfo(_ call: CAPPluginCall) {
        let bundle = Bundle.main
        let version = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
        let build = bundle.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
        #if DEBUG
        call.resolve(["version": version, "build": build, "channel": "development"])
        return
        #else
        let beta = bundle.appStoreReceiptURL?.lastPathComponent == "sandboxReceipt"
        let channel = beta ? "testflight" : "app-store"
        let country = Locale.current.regionCode ?? "US"
        var components = URLComponents(string: "https://itunes.apple.com/lookup")!
        components.queryItems = [URLQueryItem(name: "id", value: "6824664840"), URLQueryItem(name: "country", value: country)]
        let url = beta ? URL(string: "https://scriba.aeonbridge.app/app-updates.json")! : components.url!
        var request = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 10)
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        let configuration = URLSessionConfiguration.ephemeral
        configuration.httpShouldSetCookies = false; configuration.httpCookieStorage = nil; configuration.urlCache = nil
        let session = URLSession(configuration: configuration)
        session.dataTask(with: request) { data, response, _ in
            defer { session.finishTasksAndInvalidate() }
            var result: [String: Any] = ["version": version, "build": build, "channel": channel]
            if let response = response as? HTTPURLResponse, response.statusCode == 200,
               let data = data, data.count <= 65536,
               let catalog = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                result["catalog"] = catalog
            }
            call.resolve(result)
        }.resume()
        #endif
    }

    /** TestFlight users return to TestFlight; App Store users open the app's actual listing. */
    @objc func openUpdate(_ call: CAPPluginCall) {
        guard let channel = call.getString("channel"), ["testflight", "app-store"].contains(channel) else {
            call.reject("Canal de atualização inválido."); return
        }
        let destination = URL(string: channel == "testflight" ? "itms-beta://" : "https://apps.apple.com/app/id6824664840")!
        DispatchQueue.main.async {
            UIApplication.shared.open(destination, options: [:]) { opened in
                if opened { call.resolve() } else { call.reject("Não foi possível abrir o destino de atualização.") }
            }
        }
    }

    @objc func openExternal(_ call: CAPPluginCall) {
        guard let text = call.getString("url"), let url = URL(string: text), url.scheme == "https" else { call.reject("Link externo inválido."); return }
        DispatchQueue.main.async { UIApplication.shared.open(url, options: [:]) { opened in if opened { call.resolve() } else { call.reject("Não foi possível abrir o link.") } } }
    }
}
