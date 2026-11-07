import AuthenticationServices
import Capacitor
import CryptoKit
import Security
import UIKit
import UniformTypeIdentifiers

/** The native container delegates status-bar appearance to the current document. */
class ScribaNavigationController: UINavigationController {
    override var childForStatusBarStyle: UIViewController? { topViewController }
    override var childForStatusBarHidden: UIViewController? { topViewController }
}

/** Bar descriptors contain presentation and command identifiers, never executable JavaScript. */
private struct WorkspaceChromeDescriptor {
    let id: String
    let title: String
    let symbol: String
    let enabled: Bool
    let selected: Bool
    let priority: String
    let children: [WorkspaceChromeDescriptor]

    init?(_ value: [String: Any], depth: Int = 0) {
        guard depth < 4, let id = value["id"] as? String, !id.isEmpty,
              let title = value["title"] as? String, !title.isEmpty else { return nil }
        self.id = String(id.prefix(128))
        self.title = String(title.prefix(256))
        symbol = String((value["symbol"] as? String ?? "").prefix(128))
        enabled = value["enabled"] as? Bool ?? true
        selected = value["selected"] as? Bool ?? false
        priority = value["priority"] as? String ?? "standard"
        children = (value["children"] as? [[String: Any]] ?? []).prefix(40).compactMap {
            WorkspaceChromeDescriptor($0, depth: depth + 1)
        }
    }
}

/** Native capabilities are registered only in the bundled editor, never in a remote web view. */
@objc(ScribaViewController)
class ScribaViewController: CAPBridgeViewController {
    var darkChrome = true
    private weak var workspacePlugin: ScribaNative?
    private var lastWorkspaceLayout: NSDictionary?
    private var lastWorkspaceChrome: NSDictionary?
    private var workspacePosture = "unavailable"
    private var workspaceItems: [String: UIBarButtonItem] = [:]
    private var workspaceOverflow: [WorkspaceChromeDescriptor] = []
    private var workspaceCommandID: String?

    override var preferredStatusBarStyle: UIStatusBarStyle { darkChrome ? .lightContent : .darkContent }
    override func capacitorDidLoad() {
        // Capacitor makes WKWebView the root view. A separate container can reserve
        // safe areas without recursively resizing that root during UIKit layout.
        if let web = webView {
            let container = UIView()
            container.addSubview(web); web.translatesAutoresizingMaskIntoConstraints = false
            view = container
            let contentGuide: UILayoutGuide
            if #available(iOS 26.0, *) {
                contentGuide = container.layoutGuide(for: .safeArea(cornerAdaptation: .horizontal))
            } else {
                contentGuide = container.safeAreaLayoutGuide
            }
            NSLayoutConstraint.activate([
                web.topAnchor.constraint(equalTo: contentGuide.topAnchor),
                web.bottomAnchor.constraint(equalTo: container.keyboardLayoutGuide.topAnchor),
                web.leadingAnchor.constraint(equalTo: contentGuide.leadingAnchor),
                web.trailingAnchor.constraint(equalTo: contentGuide.trailingAnchor)
            ])
            if #available(iOS 27.1, *) {
                container.addInteraction(UIHingeInteraction { [weak self] _, update in
                    guard let self else { return }
                    switch update.hinge?.status {
                    case .unknown?: self.workspacePosture = "unknown"
                    case .closed?: self.workspacePosture = "closed"
                    case .partiallyOpen?: self.workspacePosture = "partiallyOpen"
                    case .fullyOpen?: self.workspacePosture = "fullyOpen"
                    case nil: self.workspacePosture = "unavailable"
                    @unknown default: self.workspacePosture = "unknown"
                    }
                    // Hinge updates and safe-area changes may arrive before final layout.
                    self.view.setNeedsLayout()
                })
                registerForTraitChanges(UITraitCollection.systemTraitsAffectingVerticalBarEdge) { (self: ScribaViewController, _) in
                    self.view.setNeedsLayout()
                }
                navigationItem.style = .editor
                navigationItem.largeTitleDisplayMode = .never
                navigationItem.verticalBarCompressionBehavior = .prefersBarItems
            }
            if #available(iOS 17.0, *) {
                registerForTraitChanges([UITraitPreferredContentSizeCategory.self, UITraitLayoutDirection.self]) { (self: ScribaViewController, _) in
                    self.view.setNeedsLayout()
                }
            }
        }
        let plugin = ScribaNative()
        workspacePlugin = plugin
        bridge?.registerPluginInstance(plugin)
        webView?.allowsBackForwardNavigationGestures = false
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        publishWorkspaceLayout()
    }

    override func viewSafeAreaInsetsDidChange() {
        super.viewSafeAreaInsetsDidChange()
        view.setNeedsLayout()
    }

    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        // Older supported releases do not provide automatic trait tracking.
        if #unavailable(iOS 17.0) { view.setNeedsLayout() }
    }

    /** Geometry is always read from this web view, after constraints have adapted to the scene. */
    func currentWorkspaceLayout() -> [String: Any] {
        guard let web = webView else { return ["nativeChrome": false, "width": 0, "height": 0,
            "verticalBarEdge": "none", "posture": "unavailable", "occlusions": [],
            "keyboardVisible": false, "textScale": 1] }
        var payload: [String: Any] = [
            "nativeChrome": false, "width": Double(web.bounds.width), "height": Double(web.bounds.height),
            "verticalBarEdge": "none", "posture": workspacePosture, "occlusions": [],
            "keyboardVisible": view.keyboardLayoutGuide.layoutFrame.minY < view.safeAreaLayoutGuide.layoutFrame.maxY - 1,
            "textScale": Double(UIFontMetrics(forTextStyle: .body).scaledValue(for: 17, compatibleWith: traitCollection) / 17)
        ]
        if #available(iOS 27.1, *) {
            payload["nativeChrome"] = navigationController is ScribaNavigationController
            let leadingIsLeft = view.effectiveUserInterfaceLayoutDirection == .leftToRight
            switch traitCollection.verticalBarEdge {
            case .leading: payload["verticalBarEdge"] = leadingIsLeft ? "left" : "right"
            case .trailing: payload["verticalBarEdge"] = leadingIsLeft ? "right" : "left"
            case .unspecified: break
            @unknown default: break
            }
            payload["occlusions"] = web.reservedRegions(kind: .occlusion).compactMap { region -> [String: Double]? in
                guard region.isActive else { return nil }
                return workspaceRect(region.frame.intersection(web.bounds))
            }
            let divisions = web.reservedRegions(kind: .division).compactMap { region -> [String: Double]? in
                guard region.isActive else { return nil }
                return workspaceRect(region.frame.intersection(web.bounds), allowLine: true)
            }
            if let rect = divisions.first {
                payload["division"] = rect
            }
        }
        return payload
    }

    private func workspaceRect(_ rect: CGRect, allowLine: Bool = false) -> [String: Double]? {
        // A division may be a line rather than an occluding strip; preserve its position.
        guard !rect.isNull, !rect.isInfinite, (allowLine ? max(rect.width, rect.height) > 0 : !rect.isEmpty),
              rect.minX.isFinite, rect.minY.isFinite, rect.width.isFinite, rect.height.isFinite else { return nil }
        return ["x": Double(rect.minX), "y": Double(rect.minY), "width": Double(rect.width), "height": Double(rect.height)]
    }

    /** Resize notifications preserve the editor instance and coalesce identical native layout passes. */
    func publishWorkspaceLayout() {
        guard let web = webView, web.bounds.width > 0, web.bounds.height > 0 else { return }
        let payload = currentWorkspaceLayout()
        let comparable = payload as NSDictionary
        guard lastWorkspaceLayout?.isEqual(comparable) != true else { return }
        lastWorkspaceLayout = comparable
        workspacePlugin?.publishWorkspaceLayout(payload)
    }

    /** Native menus send identifiers back to the existing document actions. */
    private func sendWorkspaceCommand(_ id: String) {
        workspaceCommandID = id
        workspacePlugin?.notifyListeners("workspaceCommand", data: ["id": id])
    }

    @available(iOS 27.1, *)
    private func workspaceMenuElement(_ descriptor: WorkspaceChromeDescriptor, ancestorEnabled: Bool = true) -> UIMenuElement {
        let enabled = ancestorEnabled && descriptor.enabled
        let image = descriptor.symbol.isEmpty ? nil : UIImage(systemName: descriptor.symbol)
        if !descriptor.children.isEmpty {
            return UIMenu(title: descriptor.title, image: image, children: descriptor.children.map {
                workspaceMenuElement($0, ancestorEnabled: enabled)
            })
        }
        return UIAction(title: descriptor.title, image: image, identifier: UIAction.Identifier(descriptor.id),
                        attributes: enabled ? [] : [.disabled], state: descriptor.selected ? .on : .off) { [weak self] _ in
            self?.sendWorkspaceCommand(descriptor.id)
        }
    }

    @available(iOS 27.1, *)
    private func workspaceBarItem(_ descriptor: WorkspaceChromeDescriptor) -> UIBarButtonItem {
        let representation = workspaceMenuElement(descriptor)
        let item: UIBarButtonItem
        if let menu = representation as? UIMenu {
            item = UIBarButtonItem(image: menu.image, menu: menu)
            item.title = descriptor.title
        } else {
            item = UIBarButtonItem(primaryAction: representation as? UIAction)
        }
        item.accessibilityLabel = descriptor.title
        item.accessibilityIdentifier = "scriba.command." + descriptor.id
        item.isEnabled = descriptor.enabled
        item.isSelected = descriptor.selected
        item.axisBehavior = .verticalPreferred
        item.visibilityPriority = descriptor.priority == "high" ? .high : (descriptor.priority == "low" ? .low : .standard)
        item.menuRepresentation = representation
        registerWorkspaceItem(descriptor, item: item)
        return item
    }

    /** Descendant commands resolve to the current parent item after asynchronous chrome updates. */
    private func registerWorkspaceItem(_ descriptor: WorkspaceChromeDescriptor, item: UIBarButtonItem) {
        workspaceItems[descriptor.id] = item
        descriptor.children.forEach { registerWorkspaceItem($0, item: item) }
    }

    /** UIKit owns placement and overflow; no native bar dimensions are inferred from device names. */
    func updateWorkspaceChrome(_ options: [String: Any]) {
        guard #available(iOS 27.1, *), navigationController is ScribaNavigationController else { return }
        let comparable = options as NSDictionary
        guard lastWorkspaceChrome?.isEqual(comparable) != true else { return }
        lastWorkspaceChrome = comparable
        navigationItem.title = String((options["title"] as? String ?? "Scriba").prefix(256))
        let descriptors: (String) -> [WorkspaceChromeDescriptor] = { key in
            (options[key] as? [[String: Any]] ?? []).prefix(40).compactMap { WorkspaceChromeDescriptor($0) }
        }
        workspaceItems.removeAll()
        navigationItem.leadingItemGroups = descriptors("navigation").map { workspaceBarItem($0).creatingFixedGroup() }
        let tools = descriptors("toolbar").map { workspaceBarItem($0) }
        setToolbarItems(tools, animated: false)
        navigationController?.setToolbarHidden(tools.isEmpty, animated: false)
        workspaceOverflow = descriptors("overflow")
        navigationItem.additionalOverflowItems = workspaceOverflow.isEmpty ? nil : UIDeferredMenuElement.uncached { [weak self] completion in
            guard let self else { completion([]); return }
            completion(self.workspaceOverflow.map { self.workspaceMenuElement($0) })
        }
        view.setNeedsLayout()
    }

    /** Theme changes update both the document and the system-owned chrome. */
    func applyWorkspaceAppearance(color: UIColor, style: UIUserInterfaceStyle) {
        view.backgroundColor = color
        webView?.backgroundColor = color
        overrideUserInterfaceStyle = style
        if let navigation = navigationController {
            navigation.overrideUserInterfaceStyle = style
            navigation.view.backgroundColor = color
            let barAppearance = UINavigationBarAppearance()
            barAppearance.configureWithDefaultBackground()
            navigation.navigationBar.standardAppearance = barAppearance
            navigation.navigationBar.scrollEdgeAppearance = barAppearance
            navigation.navigationBar.compactAppearance = barAppearance
            let toolbarAppearance = UIToolbarAppearance()
            toolbarAppearance.configureWithDefaultBackground()
            navigation.toolbar.standardAppearance = toolbarAppearance
            navigation.toolbar.scrollEdgeAppearance = toolbarAppearance
            navigation.toolbar.compactAppearance = toolbarAppearance
            navigation.setNeedsStatusBarAppearanceUpdate()
        }
        setNeedsStatusBarAppearanceUpdate()
    }

    /** System sheets track their actual command item while a Duo bar changes axis. */
    func configureWorkspacePopover(_ popover: UIPopoverPresentationController?) {
        guard let popover else { return }
        if #available(iOS 27.1, *), navigationController is ScribaNavigationController {
            if let command = workspaceCommandID, let source = workspaceItems[command] {
                popover.sourceItem = source
                return
            }
            if let source = navigationItem.overflowPresentationSource {
                popover.sourceItem = source
                return
            }
        }
        popover.sourceView = webView ?? view
        popover.sourceRect = .null
    }
}

/** Files access uses a user-granted security-scoped bookmark; credentials remain native. */
@objc(ScribaNative)
class ScribaNative: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate, ASWebAuthenticationPresentationContextProviding {
    let identifier = "ScribaNative"
    let jsName = "ScribaNative"
    let pluginMethods: [CAPPluginMethod] = [
        "folderStatus", "chooseFolder", "authorizeFolder", "disconnectFolder", "readNotes", "saveNote",
        "document", "documentVersion", "renameNote", "shareFile", "githubRequest", "githubLogin", "openExternal", "appearance", "accessibilityPreferences", "updateInfo", "openUpdate", "workspaceLayout", "workspaceChrome", "openNote"
    ].map { CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise) }

    private let defaults = UserDefaults.standard
    private let files = FileManager.default
    private let worker = DispatchQueue(label: "com.aeonbridge.scriba.files", qos: .userInitiated)
    private let network = DispatchQueue(label: "com.aeonbridge.scriba.network", qos: .userInitiated)
    private let gateway = "https://scriba.aeonbridge.app"
    private let bookmarkKey = "scriba.files.bookmark"
    private var pickerCall: CAPPluginCall?
    private var notePickerCall: CAPPluginCall?
    private weak var notePickerController: UIDocumentPickerViewController?
    private var authentication: ASWebAuthenticationSession?

    @objc func workspaceLayout(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let controller = self.bridge?.viewController as? ScribaViewController else {
                call.reject("Os controles nativos estão indisponíveis.")
                return
            }
            controller.view.layoutIfNeeded()
            call.resolve(controller.currentWorkspaceLayout())
        }
    }

    @objc func workspaceChrome(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            (self.bridge?.viewController as? ScribaViewController)?.updateWorkspaceChrome(call.options as? [String: Any] ?? [:])
            call.resolve()
        }
    }

    /** Retain only the newest geometry until JavaScript subscribes, not every resize frame. */
    func publishWorkspaceLayout(_ payload: [String: Any]) {
        retainedEventArguments?.removeObject(forKey: "workspaceLayout")
        notifyListeners("workspaceLayout", data: payload, retainUntilConsumed: true)
    }

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
            let style: UIUserInterfaceStyle = call.getBool("automatic") == true ? .unspecified : (controller.darkChrome ? .dark : .light)
            controller.applyWorkspaceAppearance(color: color, style: style)
            call.resolve()
        }
    }

    private func problem(_ message: String) -> NSError { NSError(domain: "Scriba", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
    private func hash(_ bytes: Data) -> String { SHA256.hash(data: bytes).map { String(format: "%02x", $0) }.joined() }
    private func base64url(_ data: Data) -> String { data.base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "") }

    /** iOS-on-Mac adds security scope itself, which conflicts with minimalBookmark. */
    static func folderBookmarkOptions(isIOSAppOnMac: Bool = ProcessInfo.processInfo.isiOSAppOnMac) -> URL.BookmarkCreationOptions {
        isIOSAppOnMac ? [] : .minimalBookmark
    }

    private func selectedParent() throws -> URL? {
        guard let bookmark = defaults.data(forKey: bookmarkKey) else { return nil }
        var stale = false
        let url = try URL(resolvingBookmarkData: bookmark, options: .withoutUI, relativeTo: nil, bookmarkDataIsStale: &stale)
        if stale {
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            defaults.set(try url.bookmarkData(options: Self.folderBookmarkOptions(), includingResourceValuesForKeys: nil, relativeTo: nil), forKey: bookmarkKey)
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
            guard self.notePickerCall == nil else { call.reject("Feche a seleção de arquivo antes de escolher uma pasta."); return }
            guard self.pickerCall == nil else { call.reject("A seleção de pasta já está aberta."); return }
            self.pickerCall = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
            picker.allowsMultipleSelection = false; picker.delegate = self
            self.bridge?.viewController?.present(picker, animated: true)
        }
    }

    /** A native Files picker preserves user activation for toolbar and keyboard Open commands. */
    @objc func openNote(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.notePickerCall == nil, self.pickerCall == nil else {
                call.reject("Já existe uma seleção de arquivo ou pasta aberta.")
                return
            }
            guard let presenter = self.bridge?.viewController, presenter.viewIfLoaded?.window != nil,
                  presenter.presentedViewController == nil else {
                call.reject("Feche a janela atual antes de abrir um arquivo.")
                return
            }
            let textTypes = ["md", "markdown", "mdown"].compactMap { UTType(filenameExtension: $0, conformingTo: .plainText) }
            let bearTypes = ["bear"].compactMap { UTType(filenameExtension: $0, conformingTo: .archive) }
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.plainText, .zip] + textTypes + bearTypes, asCopy: true)
            picker.allowsMultipleSelection = false
            picker.shouldShowFileExtensions = true
            picker.delegate = self
            self.notePickerCall = call
            self.notePickerController = picker
            presenter.present(picker, animated: true)
        }
    }

    /** Import reads are coordinated and bounded even if the selected file grows after metadata lookup. */
    private func readPickedNote(_ url: URL) throws -> [String: Any] {
        guard url.isFileURL else { throw problem("Selecione um arquivo local no Files.") }
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        var coordinationError: NSError?
        var result: Result<[String: Any], Error>?
        NSFileCoordinator().coordinate(readingItemAt: url, options: .withoutChanges, error: &coordinationError) { selected in
            result = Result {
                let metadata = try selected.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey, .contentTypeKey])
                let maximumSize = 64 * 1024 * 1024
                guard metadata.isRegularFile == true, metadata.isSymbolicLink != true else {
                    throw problem("Selecione um arquivo Markdown ou pacote ZIP/Bear válido.")
                }
                guard ["md", "markdown", "mdown", "zip", "bear"].contains(selected.pathExtension.lowercased())
                        || metadata.contentType?.conforms(to: .plainText) == true else {
                    throw problem("Selecione um arquivo Markdown ou pacote ZIP/Bear válido.")
                }
                guard (metadata.fileSize ?? 0) <= maximumSize else {
                    throw problem("O arquivo selecionado excede o limite de 64 MB.")
                }
                let input = try FileHandle(forReadingFrom: selected)
                defer { try? input.close() }
                var bytes = Data()
                while let chunk = try input.read(upToCount: min(1024 * 1024, maximumSize - bytes.count + 1)), !chunk.isEmpty {
                    guard chunk.count <= maximumSize - bytes.count else {
                        throw problem("O arquivo selecionado excede o limite de 64 MB.")
                    }
                    bytes.append(chunk)
                }
                return ["name": url.lastPathComponent, "data": bytes.base64EncodedString()]
            }
        }
        if let coordinationError { throw coordinationError }
        guard let result else { throw problem("Não foi possível ler o arquivo selecionado.") }
        return try result.get()
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        if controller === notePickerController {
            notePickerCall?.resolve(["cancelled": true])
            notePickerCall = nil
            notePickerController = nil
            return
        }
        pickerCall?.reject("Seleção de pasta cancelada."); pickerCall = nil
    }
    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if controller === notePickerController {
            guard let call = notePickerCall else { return }
            guard let url = urls.first else {
                notePickerCall = nil
                notePickerController = nil
                call.resolve(["cancelled": true])
                return
            }
            worker.async {
                let result = Result { try self.readPickedNote(url) }
                DispatchQueue.main.async {
                    self.notePickerCall = nil
                    self.notePickerController = nil
                    switch result {
                    case .success(let note): call.resolve(note)
                    case .failure(let error): call.reject("Não foi possível abrir o arquivo selecionado. \(error.localizedDescription)")
                    }
                }
            }
            return
        }
        guard let call = pickerCall, let url = urls.first else { return }
        pickerCall = nil
        worker.async {
            let accessed = url.startAccessingSecurityScopedResource()
            defer { if accessed { url.stopAccessingSecurityScopedResource() } }
            do {
                let folder = url.appendingPathComponent("scriba", isDirectory: true)
                try self.files.createDirectory(at: folder, withIntermediateDirectories: true)
                let bookmark = try url.bookmarkData(options: Self.folderBookmarkOptions(), includingResourceValuesForKeys: nil, relativeTo: nil)
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
                (self.bridge?.viewController as? ScribaViewController)?.configureWorkspacePopover(controller.popoverPresentationController)
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
