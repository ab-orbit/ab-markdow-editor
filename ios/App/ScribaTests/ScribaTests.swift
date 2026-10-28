import XCTest
import WebKit
import UIKit
@testable import App

/** These tests exercise the real bundled WKWebView and Swift bridge on an isolated simulator. */
@MainActor
final class ScribaTests: XCTestCase {
    private var web: WKWebView!
    private var fixture: URL!

    override func setUp() async throws {
        continueAfterFailure = true
        for _ in 0..<200 {
            if let scene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
               let controller = scribaController(scene.windows.first(where: { $0.isKeyWindow })?.rootViewController),
               let view = controller.webView {
                web = view
                if (try? await js("return !!window.Capacitor?.nativePromise && !!document.querySelector('.editor-app')")) as? Bool == true { break }
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertNotNil(web)
        // Bridge regression assertions use Portuguese; device-language behavior has separate UI coverage.
        if (try? await js("return document.documentElement.lang")) as? String != "pt-BR" {
            _ = try? await js("localStorage.setItem('scriba-language','pt');location.reload();return true")
        }
        try await waitFor("!!document.querySelector('input[aria-label=\"Arquivo Markdown\"]') && !document.querySelector('input[aria-label=\"Arquivo Markdown\"]').disabled")
        fixture = FileManager.default.temporaryDirectory.appendingPathComponent("scriba-native-test-" + UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: fixture, withIntermediateDirectories: true)
    }
    override func tearDown() async throws {
        _ = try? await js("localStorage.removeItem('scriba-language');return true")
        UserDefaults.standard.removeObject(forKey: "scriba.files.bookmark")
        if let fixture = fixture { try? FileManager.default.removeItem(at: fixture) }
    }
    private func scribaController(_ root: UIViewController?) -> ScribaViewController? {
        if let navigation = root as? UINavigationController { return navigation.topViewController as? ScribaViewController }
        return root as? ScribaViewController
    }
    private func js(_ body: String, args: [String: Any] = [:]) async throws -> Any? {
        try await web.callAsyncJavaScript(body, arguments: args, in: nil, contentWorld: .page)
    }
    private func native(_ method: String, args: [String: Any] = [:]) async throws -> Any? {
        try await js("return await window.Capacitor.nativePromise('ScribaNative',method,options)", args: ["method": method,"options":args])
    }

    /** Passive session: real hinge and rotation actions are performed in Device Hub.
        The file handshake records observations; it never fabricates UIKit geometry. */
    func testDuoRealPostureSession() async throws {
        guard #available(iOS 27.1, *) else { throw XCTSkip("Requires iPhone Duo reserved regions.") }
        executionTimeAllowance = 1_200
        let originalWeb = web
        let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let commandURL = directory.appendingPathComponent("duo-posture-command.json")
        let resultURL = directory.appendingPathComponent("duo-posture-results.json")
        let readyURL = directory.appendingPathComponent("duo-posture-ready.json")
        try? FileManager.default.removeItem(at: commandURL)
        defer { try? FileManager.default.removeItem(at: readyURL) }
        var snapshots = [[String: Any]]()
        var lastID = ""
        var finished = false
        try JSONSerialization.data(withJSONObject: ["ready": true]).write(to: readyURL, options: .atomic)
        for _ in 0..<10_000 {
            if let data = try? Data(contentsOf: commandURL),
               let command = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let id = command["id"] as? String, id != lastID {
                lastID = id
                if command["finish"] as? Bool == true { finished = true; break }
                let label = (command["label"] as? String ?? id).replacingOccurrences(of: "/", with: "-")
                let layout = try await native("workspaceLayout") as! [String: Any]
                if let expected = command["expectPosture"] as? String {
                    XCTAssertEqual(layout["posture"] as? String, expected, label)
                }
                XCTAssertTrue(web === originalWeb, "A posture change must preserve the WKWebView.")
                let metrics = try await js("""
                    const rect=element=>{if(!element)return null;const r=element.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}};
                    const root=document.querySelector('[data-document-scroll]');
                    const workbench=document.querySelector('[data-markdown-workbench]');
                    const anchor=root&&[...root.querySelectorAll('h1,h2,h3,p,table,figure')].find(item=>item.getBoundingClientRect().bottom>root.getBoundingClientRect().top+8);
                    return {width:innerWidth,height:innerHeight,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,
                        arrangement:document.querySelector('.editor-app')?.dataset.workspaceArrangement,
                        mode:workbench?.dataset.mode,workbench:rect(workbench),library:rect(document.querySelector('#recent-notes')),
                        outline:rect(document.querySelector('[aria-label="Índice da nota"]')),
                        reading:rect(root),scrollTop:root?.scrollTop,anchor:anchor?.textContent?.slice(0,160),anchorTop:anchor&&root?anchor.getBoundingClientRect().top-root.getBoundingClientRect().top:null,
                        title:document.querySelector('article h1')?.textContent,sourceLength:document.querySelector('.cm-content')?.textContent?.length,
                        nativeChrome:document.documentElement.dataset.nativeChrome,
                        focusedTag:document.activeElement?.tagName,
                        viewport:{offsetTop:visualViewport?.offsetTop,height:visualViewport?.height,scrollY},
                        sourceAnchors:root?.querySelectorAll('[data-source-from][data-source-to]').length,
                        richText:rect(document.querySelector('[role="textbox"][aria-label="Texto da nota"]')),
                        tables:[...document.querySelectorAll('article table')].map(table=>({width:table.scrollWidth,viewport:table.parentElement.clientWidth}))};
                    """) as! [String: Any]
                XCTAssertEqual(metrics["pageOverflow"] as? Bool, false, label)
                if let prefix = command["anchorPrefix"] as? String {
                    XCTAssertTrue((metrics["anchor"] as? String ?? "").hasPrefix(prefix), "The same section must stay at the reading position: " + label)
                    XCTAssertLessThan(abs(metrics["anchorTop"] as? Double ?? .infinity), 32, "The outline's section must remain visible at the top: " + label)
                }
                let workspaceRect = metrics["workbench"] as? [String: Any]
                XCTAssertGreaterThanOrEqual(workspaceRect?["y"] as? Double ?? 0, -2, "The keyboard must not pan the entire editor above its native viewport: " + label)
                XCTAssertLessThan(abs(web.scrollView.contentOffset.y), 2, "Only inner document panes may scroll: " + label)
                var snapshot: [String: Any] = ["label":label,"native":layout,"web":metrics,"sameWebView":web === originalWeb,
                    "webScrollOffset":["x":web.scrollView.contentOffset.x,"y":web.scrollView.contentOffset.y],
                    "webFrame":["x":web.frame.minX,"y":web.frame.minY,"width":web.frame.width,"height":web.frame.height]]
                if let scene = web.window?.windowScene { snapshot["orientation"] = scene.interfaceOrientation.rawValue }
                snapshots.append(snapshot)
                if let window = web.window {
                    let image = UIGraphicsImageRenderer(bounds: window.bounds).image { _ in window.drawHierarchy(in: window.bounds, afterScreenUpdates: true) }
                    try image.pngData()?.write(to: directory.appendingPathComponent("duo-posture-\(label).png"))
                    let attachment = XCTAttachment(image: image); attachment.name = label; attachment.lifetime = .keepAlways; add(attachment)
                }
                try JSONSerialization.data(withJSONObject:snapshots,options:[.prettyPrinted,.sortedKeys]).write(to:resultURL,options:.atomic)
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertTrue(finished,"Finish the passive session through its documented file handshake.")
        XCTAssertTrue(Set(snapshots.compactMap { ($0["native"] as? [String: Any])?["posture"] as? String }).isSuperset(of:["closed","partiallyOpen","fullyOpen"]),"Record all three actual Device Hub postures.")
    }

    /** Run with scripts/test-duo-resize.mjs, which drives Apple's real appResize session. */
    func testDuoNativeWorkspaceResizing() async throws {
        guard #available(iOS 27.1, *) else { throw XCTSkip("Requires the native adaptive bars in iOS 27.1.") }
        let controller = try XCTUnwrap(scribaController(web.window?.rootViewController))
        let originalWeb = web
        try await waitFor("document.documentElement.dataset.nativeChrome==='true'")
        let source = "# Acervo Aurora\n\nUma pesquisa começa com uma pergunta e continua em qualquer formato.\n\n## Fontes e evidências\n\n| Fonte | Responsável | Próximo passo |\n|---|---|---|\n| Entrevistas | Equipe de pesquisa | Revisar transcrições |\n| Arquivo histórico | Curadoria | Conferir datas e referências |\n\n## Plano de trabalho\n\n- [ ] Ler as evidências\n- [ ] Escrever a síntese\n\n" + (1...18).map { "Parágrafo \($0): a mesma nota acompanha o espaço disponível sem perder seu conteúdo.\n\n" }.joined()
        _ = try await js("const transfer=new DataTransfer();transfer.items.add(new File([source],filename,{type:'text/markdown'}));const input=document.querySelector('input[aria-label=\"Arquivo Markdown\"]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true",args:["source":source,"filename":"Aurora-\(UUID().uuidString.prefix(4)).md"])
        try await waitFor("!!document.querySelector('article h1') && document.querySelector('article h1').textContent.includes('Acervo Aurora') && !document.querySelector('[aria-label=\"Bancada Markdown\"]').getAttribute('aria-busy').includes('true')")
        _ = try await js("window.__duoDocument=document.querySelector('[data-document-scroll]');return true")
        let directory = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0]
        let request = directory.appendingPathComponent("duo-resize-request.json")
        defer { try? FileManager.default.removeItem(at:request) }
        var snapshots = [[String:Any]]()
        // Return to the initial supported compact window to prove round-trip continuity.
        for (index,size) in [(480,700),(950,650),(650,940),(480,700)].enumerated() {
            let phase:[String:Any] = ["phase":index,"width":size.0,"height":size.1]
            try JSONSerialization.data(withJSONObject:phase).write(to:request,options:.atomic)
            var resized = false
            for _ in 0..<300 {
                if let window=web.window, abs(window.bounds.width-CGFloat(size.0))<2, abs(window.bounds.height-CGFloat(size.1))<2 { resized=true;break }
                try await Task.sleep(nanoseconds:100_000_000)
            }
            XCTAssertTrue(resized,"appResize did not reach phase \(index); actual window \(String(describing:web.window?.bounds)). Run the documented orchestrator.")
            if !resized { break }
            try await Task.sleep(nanoseconds:400_000_000)
            let nativeLayout = try await native("workspaceLayout") as! [String:Any]
            XCTAssertEqual(nativeLayout["nativeChrome"] as? Bool,true)
            XCTAssertGreaterThan(nativeLayout["width"] as? Double ?? 0,250)
            XCTAssertGreaterThan(nativeLayout["height"] as? Double ?? 0,100)
            XCTAssertTrue(web===originalWeb,"Resizing must never recreate the WebKit editor.")
            try await expect("return window.__duoDocument===document.querySelector('[data-document-scroll]') && document.documentElement.scrollWidth<=innerWidth+1",equals:true)
            if index > 0 {
                try await expect("const root=document.querySelector('[data-document-scroll]'),anchor=window.__duoReadingAnchor;return anchor?.isConnected && Math.abs(anchor.getBoundingClientRect().top-root.getBoundingClientRect().top)<32",equals:true)
            }
            try await expect("return getComputedStyle(document.querySelector('[aria-label=\"Bancada Markdown\"] > header')).display==='none'",equals:true)
            let items=controller.toolbarItems ?? []
            XCTAssertTrue(items.contains(where:{$0.accessibilityIdentifier=="scriba.command.save"}))
            XCTAssertTrue(items.contains(where:{$0.accessibilityIdentifier=="scriba.command.view"}))
            let snapshot=try await js("return {width:innerWidth,height:innerHeight,arrangement:document.querySelector('.editor-app').dataset.workspaceArrangement,library:!!document.querySelector('#recent-notes'),mode:document.querySelector('[aria-label=\"Bancada Markdown\"]').dataset.mode,title:document.querySelector('article h1')?.textContent}") as! [String:Any]
            snapshots.append(["phase":index,"native":nativeLayout,"web":snapshot])
            if let window=web.window {
                let image=UIGraphicsImageRenderer(bounds:window.bounds).image { _ in window.drawHierarchy(in:window.bounds,afterScreenUpdates:true) }
                let attachment=XCTAttachment(image:image);attachment.name="Duo scene \(size.0)×\(size.1)";attachment.lifetime = .keepAlways;add(attachment)
                try image.pngData()?.write(to:directory.appendingPathComponent("duo-resize-\(index).png"))
            }
            if index == 0 {
                // Preserve a middle-of-document reading position, not just its DOM instance.
                _ = try await js("const root=document.querySelector('[data-document-scroll]'),anchor=[...root.querySelectorAll('p')].find(item=>item.textContent.startsWith('Parágrafo 6:'));if(!anchor)throw new Error('Missing reading fixture');window.__duoReadingAnchor=anchor;root.scrollTop+=anchor.getBoundingClientRect().top-root.getBoundingClientRect().top;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return true")
            }
        }
        XCTAssertEqual(snapshots.count,4)
        try JSONSerialization.data(withJSONObject:snapshots,options:[.prettyPrinted,.sortedKeys]).write(to:directory.appendingPathComponent("duo-resize-results.json"),options:.atomic)
        _ = try await js("window.dispatchEvent(new CustomEvent('scriba:native-command',{detail:'mode:source'}));return true")
        try await waitFor("document.querySelector('[aria-label=\"Bancada Markdown\"]').dataset.mode==='source'")
        try await expect("return document.querySelector('.cm-content').textContent.includes('Acervo Aurora')",equals:true)
        _ = try await js("window.dispatchEvent(new CustomEvent('scriba:native-command',{detail:'mode:read'}));return true")
        try await waitFor("document.querySelector('article h1')?.textContent.includes('Acervo Aurora')===true")
    }
    func testUpdateBridgeReportsInstalledMetadataAndRejectsUnknownChannels() async throws {
        let info = try await native("updateInfo") as? [String: Any]
        XCTAssertEqual(info?["version"] as? String, "1.17.0")
        XCTAssertNotNil(info?["build"] as? String)
        XCTAssertEqual(info?["channel"] as? String, "development")
        let rejected = try await js("try { await window.Capacitor.nativePromise('ScribaNative','openUpdate',{channel:'untrusted'}); return false; } catch { return true; }")
        XCTAssertEqual(rejected as? Bool, true)
    }
    /** Automatic appearance releases UIKit's override so system changes reach WKWebView. */
    func testAutomaticAppearanceFollowsNativeSystem() async throws {
        let controller = try XCTUnwrap(scribaController(web.window?.rootViewController))
        _ = try await native("appearance", args:["dark":true,"automatic":false,"red":20,"green":20,"blue":20])
        XCTAssertEqual(controller.overrideUserInterfaceStyle, .dark)
        _ = try await native("appearance", args:["dark":false,"automatic":false,"red":255,"green":255,"blue":255])
        XCTAssertEqual(controller.overrideUserInterfaceStyle, .light)
        _ = try await native("appearance", args:["dark":false,"automatic":true,"red":255,"green":255,"blue":255])
        XCTAssertEqual(controller.overrideUserInterfaceStyle, .unspecified)
    }

    /** Reproduce the Mac bookmark path without the incompatible minimal flag. */
    func testFolderBookmarkOptionsAndRoundTrip() throws {
        XCTAssertEqual(ScribaNative.folderBookmarkOptions(isIOSAppOnMac: true), [])
        XCTAssertEqual(ScribaNative.folderBookmarkOptions(isIOSAppOnMac: false), .minimalBookmark)
        for onMac in [true, false] {
            let data = try fixture.bookmarkData(options: ScribaNative.folderBookmarkOptions(isIOSAppOnMac: onMac), includingResourceValuesForKeys: nil, relativeTo: nil)
            var stale = false
            let restored = try URL(resolvingBookmarkData: data, options: .withoutUI, relativeTo: nil, bookmarkDataIsStale: &stale)
            XCTAssertEqual(restored.standardizedFileURL.path, fixture.standardizedFileURL.path)
            XCTAssertFalse(stale)
        }
    }

    private func grantFixture() throws {
        let bookmark = try fixture.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
        UserDefaults.standard.set(bookmark, forKey: "scriba.files.bookmark")
    }
    private func expect(_ source: String, equals expected: Bool) async throws {
        let result = try await js(source)
        XCTAssertEqual(result as? Bool, expected, source)
    }
    private func waitFor(_ expression: String) async throws {
        for _ in 0..<200 {
            if (try await js("return " + expression)) as? Bool == true { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTFail("Native editor did not become ready: " + expression)
    }

    func testNativeRenamePreservesContentImagesAndRejectsConflicts() async throws {
        try grantFixture()
        _ = try await native("authorizeFolder")
        let original = "\u{feff}# Whiteboard\r\n\r\n![pixel](assets/pixel.png)\r\n\r\n```excalidraw\r\n{\"type\":\"excalidraw\",\"elements\":[],\"files\":{}}\r\n```\r\n"
        let pixel = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVf0AAAAASUVORK5CYII="
        _ = try await native("saveNote", args:["name":"boards/whiteboard.md","value":original,"files":[["path":"assets/pixel.png","data":pixel]]])
        let note = try await native("document",args:["name":"boards/whiteboard.md"]) as! [String:Any]
        let version = note["version"] as! String
        _ = try await native("renameNote",args:["name":"boards/whiteboard.md","newName":"boards/Project.md","version":version])
        let directory=fixture.appendingPathComponent("scriba/boards",isDirectory:true)
        let moved=directory.appendingPathComponent("Project.md")
        // Compare bytes: Foundation's String file initializer consumes the UTF-8 BOM.
        XCTAssertEqual(try Data(contentsOf:moved),Data(original.utf8))
        XCTAssertFalse(FileManager.default.fileExists(atPath:directory.appendingPathComponent("whiteboard.md").path))
        XCTAssertEqual(try Data(contentsOf:directory.appendingPathComponent("assets/pixel.png")),Data(base64Encoded:pixel))
        try Data("# Keep".utf8).write(to:directory.appendingPathComponent("Existing.md"))
        let occupied=try await js("try {await Capacitor.nativePromise('ScribaNative','renameNote',options);return false}catch{return true}",args:["options":["name":"boards/Project.md","newName":"boards/Existing.md","version":version]])
        XCTAssertEqual(occupied as? Bool,true)
        XCTAssertEqual(try String(contentsOf:directory.appendingPathComponent("Existing.md"),encoding:.utf8),"# Keep")
        try Data("# External edit".utf8).write(to:moved)
        let stale=try await js("try {await Capacitor.nativePromise('ScribaNative','renameNote',options);return false}catch{return true}",args:["options":["name":"boards/Project.md","newName":"boards/Other.md","version":version]])
        XCTAssertEqual(stale as? Bool,true)
        XCTAssertEqual(try String(contentsOf:moved,encoding:.utf8),"# External edit")
        XCTAssertFalse(FileManager.default.fileExists(atPath:directory.appendingPathComponent("Other.md").path))
    }

    func testNativeFilesRoundTripConflictsAndReload() async throws {
        try grantFixture()
        let initial = "\u{feff}# Arquivo do Files\r\n\r\nConteúdo original.\r\n"
        try Data(initial.utf8).write(to: fixture.appendingPathComponent("original.md"))
        _ = try await native("authorizeFolder")
        let loaded = try await native("readNotes") as! [String: Any]
        let notes = loaded["notes"] as! [[String: Any]]
        // The native decoder consumes the UTF-8 encoding marker, not document text.
        XCTAssertEqual(notes.first?["value"] as? String, "# Arquivo do Files\r\n\r\nConteúdo original.\r\n")
        let body: [String: Any] = ["name":"original.md","value":"# Primeira cópia","files":[]]
        _ = try await native("saveNote", args: body)
        let saved = fixture.appendingPathComponent("scriba/original.md")
        XCTAssertEqual(try String(contentsOf: saved, encoding:.utf8),"# Primeira cópia")
        XCTAssertEqual(try Data(contentsOf: fixture.appendingPathComponent("original.md")),Data(initial.utf8))
        try Data("# Alterado por outro aplicativo".utf8).write(to:saved)
        let conflict = try await js("try {await Capacitor.nativePromise('ScribaNative','saveNote',note);return false} catch(error){return String(error.message).includes('mudou fora')}",args:["note":body])
        XCTAssertEqual(conflict as? Bool,true)
        let document = try await native("document",args:["name":"original.md"]) as! [String:Any]
        XCTAssertEqual(document["value"] as? String,"# Alterado por outro aplicativo")
        _ = try await native("saveNote",args:["name":"original.md","value":"# Edição reconciliada","files":[]])
        let escape = try await js("try {await Capacitor.nativePromise('ScribaNative','saveNote',{name:'../escape.md',value:'invalid',files:[]});return false} catch{return true}")
        XCTAssertEqual(escape as? Bool,true)
        XCTAssertFalse(FileManager.default.fileExists(atPath: fixture.appendingPathComponent("escape.md").path))
        let version = try await native("documentVersion",args:["name":"original.md"]) as! [String:Any]
        XCTAssertEqual((version["version"] as? String)?.count,64)
        try FileManager.default.removeItem(at:saved)
        let removed = try await native("documentVersion",args:["name":"original.md"]) as! [String:Any]
        XCTAssertTrue(removed["version"] is NSNull)
        _ = try await native("disconnectFolder")
        let disconnected = try await native("folderStatus") as! [String:Any]
        XCTAssertEqual(disconnected["label"] as? String,"")
    }

    func testLandscapeAndPortraitLayout() async throws {
        guard #available(iOS 16, *) else { return }
        // iPad rotation is driven by XCUIDevice in the UI target; geometry requests
        // alone do not simulate rotating a tablet's physical display.
        guard UIDevice.current.userInterfaceIdiom == .phone else { return }
        let scene = UIApplication.shared.connectedScenes.first as! UIWindowScene
        scene.requestGeometryUpdate(.iOS(interfaceOrientations:.landscapeLeft))
        for _ in 0..<100 { if web.bounds.width > web.bounds.height { break };try await Task.sleep(nanoseconds:50_000_000) }
        XCTAssertGreaterThan(web.bounds.width,web.bounds.height)
        // UIKit geometry and WKWebView's viewport update on separate layout passes.
        try await waitFor("innerWidth>innerHeight && document.documentElement.scrollWidth<=innerWidth+1")
        try await expect("return document.documentElement.scrollWidth<=innerWidth+1",equals:true)
        scene.requestGeometryUpdate(.iOS(interfaceOrientations:.portrait))
        for _ in 0..<100 { if web.bounds.height > web.bounds.width { break };try await Task.sleep(nanoseconds:50_000_000) }
        XCTAssertGreaterThan(web.bounds.height,web.bounds.width)
        try await waitFor("innerHeight>innerWidth && document.documentElement.scrollWidth<=innerWidth+1")
        try await expect("return document.documentElement.scrollWidth<=innerWidth+1",equals:true)
    }

    func testReferenceDiagramsCanvasAndSystemSheets() async throws {
        let controller = try XCTUnwrap(scribaController(web.window?.rootViewController))
        let fixtureURL = Bundle(for: Self.self).url(forResource: "StoreReference", withExtension: "md")!
        let source = try String(contentsOf: fixtureURL, encoding: .utf8)
        _ = try await js("""
          document.querySelector('button[aria-label="Voltar ao editor"]')?.click();
          const input=document.querySelector('input[aria-label="Arquivo Markdown"]');
          const transfer=new DataTransfer();transfer.items.add(new File([source],'Ideias.md',{type:'text/markdown'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;
          """, args: ["source": source])
        try await waitFor("!!document.querySelector('article h1') && document.querySelector('article h1').textContent.includes('Um lugar')")
        for index in 0..<3 {
            _ = try await js("document.querySelectorAll('article figure')[index]?.scrollIntoView({block:'center'});return true", args: ["index":index])
            try await waitFor("document.querySelectorAll('article figure')[\(index)]?.dataset.diagramState==='ready' || document.querySelectorAll('article figure')[\(index)]?.dataset.excalidrawState==='ready'")
        }
        try await expect("return performance.getEntriesByType('resource').filter(entry=>/^https?:/.test(entry.name)).length===0", equals: true)
        _ = try await js("document.querySelector('figure[data-excalidraw-state] button[aria-label=\"Editar desenho Excalidraw\"]').click();return true")
        try await waitFor("!!document.querySelector('dialog[open] canvas.interactive')")
        try await waitFor("!!document.querySelector('dialog[open] button[aria-label=\"Aplicar desenho à nota\"]:not(:disabled)')")
        _ = try await js("document.querySelector('dialog[open] button[aria-label=\"Fechar editor Excalidraw\"]').click();return true")
        try await waitFor("!document.querySelector('dialog[open]')")
        // Verify the actual native Files picker and share sheet presentation, then exercise cancellation.
        let pickerTask = Task { try await native("chooseFolder") }
        for _ in 0..<100 { if controller.presentedViewController is UIDocumentPickerViewController { break };try await Task.sleep(nanoseconds:50_000_000) }
        let picker = try XCTUnwrap(controller.presentedViewController as? UIDocumentPickerViewController)
        picker.delegate?.documentPickerWasCancelled?(picker);picker.dismiss(animated:false)
        do { _ = try await pickerTask.value;XCTFail("Cancelled Files selection should reject") } catch { }
        for _ in 0..<100 { if controller.presentedViewController == nil { break };try await Task.sleep(nanoseconds:50_000_000) }
        let shareTask = Task { try await native("shareFile",args:["name":"Ideias.md","data":Data(source.utf8).base64EncodedString()]) }
        for _ in 0..<100 { if controller.presentedViewController is UIActivityViewController { break };try await Task.sleep(nanoseconds:50_000_000) }
        let sheet = try XCTUnwrap(controller.presentedViewController as? UIActivityViewController)
        sheet.completionWithItemsHandler?(nil,false,nil,nil);sheet.dismiss(animated:false);_ = try await shareTask.value
        let contentFrame = web.convert(web.bounds, to: controller.view)
        let safeFrame = controller.view.safeAreaLayoutGuide.layoutFrame
        XCTAssertGreaterThanOrEqual(contentFrame.minY,safeFrame.minY-1)
        XCTAssertLessThanOrEqual(contentFrame.maxY,safeFrame.maxY+1)
        _ = try await js("document.querySelector('article h1').scrollIntoView();window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',metaKey:true,bubbles:true,cancelable:true}));return true")
        try await waitFor("document.body.textContent.includes('Nota salva neste aplicativo') || [...document.querySelectorAll('dialog[open] button')].some(button=>button.textContent==='Substituir arquivo existente')")
        // Repeated runs may import a newer version of this fictional simulator-only fixture.
        _ = try await js("[...document.querySelectorAll('dialog[open] button')].find(button=>button.textContent==='Substituir arquivo existente')?.click();return true")
        try await waitFor("document.body.textContent.includes('Nota salva neste aplicativo')")
    }

    func testFirstLaunchWelcomeAndDraftRestoration() async throws {
        // Only this isolated simulator's fixture databases are reset; no device or user library is used.
        _ = try await js("""
          for (const [name,store] of [['ab-markdown-drafts','drafts'],['scriba-private-notes','library']]) {
            const db=await new Promise((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
            if(db.objectStoreNames.contains(store))await new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
          }
          localStorage.setItem('scriba-language','en');localStorage.removeItem('scriba-welcome-opened');location.reload();return true;
          """)
        try await waitFor("document.querySelector('article h1')?.textContent==='Welcome to Scriba'")
        try await waitFor("!!document.querySelector('input[aria-label=\"Markdown file\"]') && !document.querySelector('input[aria-label=\"Markdown file\"]').disabled")
        try await expect("return document.documentElement.dataset.platform==='ios' && localStorage.getItem('scriba-welcome-opened')==='1'", equals: true)
        try await waitFor("document.querySelector('article img')?.complete && document.querySelector('article img')?.naturalWidth>0")
        try await expect("return !document.querySelector('#recent-notes')", equals: true)
        try await waitFor("document.querySelectorAll('article [data-document-icon] svg').length===8")
        _ = try await js("""
          const db=await new Promise(resolve=>{const r=indexedDB.open('scriba-private-notes');r.onsuccess=()=>resolve(r.result)});
          const state=await new Promise(resolve=>{const r=db.transaction('library').objectStore('library').get('state');r.onsuccess=()=>resolve(r.result)});db.close();
          if(!state.pins.includes('Welcome_to_Scriba_EN.md'))throw new Error('Welcome is not pinned');return true;
          """)
        // A restored personal draft wins even when a migration has no welcome-opened marker.
        _ = try await js("""
          const db=await new Promise(resolve=>{const r=indexedDB.open('ab-markdown-drafts');r.onsuccess=()=>resolve(r.result)});
          await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite'),store=tx.objectStore('drafts'),r=store.index('updatedAt').openCursor(null,'prev');r.onsuccess=()=>{if(!r.result){reject(new Error('Missing initial draft'));return;}const draft=r.result.value;store.put({...draft,name:'Personal.md',loadedName:'Personal.md',value:'# Personal draft\\n\\nPreserved.',baseline:'',version:null,autoSavePaused:true,assets:[]});};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();
          localStorage.removeItem('scriba-welcome-opened');location.reload();return true;
          """)
        try await waitFor("document.querySelector('article h1')?.textContent==='Personal draft'")
    }

    func testBundledEditorAndPrivatePersistence() async throws {
        XCTAssertEqual(web.url?.scheme,"capacitor")
        try await expect("return document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]').content.includes(\"script-src 'self'\")", equals: true)
        // Mobile settings are reached through the visible note menu, not a desktop-only button.
        _ = try await js("""
          const direct=document.querySelector('button[aria-controls="settings-page"]');
          if(document.documentElement.dataset.nativeChrome==='true')window.dispatchEvent(new CustomEvent('scriba:native-command',{detail:'settings'}));
          else if(direct?.getClientRects().length)direct.click();
          else document.querySelector('button[aria-label="Mais opções da nota"]')?.click();
          return true;
          """)
        try await waitFor("!!document.querySelector('#settings-page') || !!document.querySelector('dialog[open] [role=menu]')")
        _ = try await js("if(!document.querySelector('#settings-page'))[...document.querySelectorAll('dialog[open] button')].find(button=>button.textContent==='Configurações')?.click();return true")
        try await waitFor("!!document.querySelector('#settings-page')")
        try await expect("return !!document.querySelector('script[src=\"/register-sw.js\"]')", equals: false)
        // IndexedDB opens and persists in the real native origin, not an ephemeral browser profile.
        let persisted = try await js("""
          const database=await new Promise((resolve,reject)=>{const r=indexedDB.open('scriba-native-test',1);r.onupgradeneeded=()=>r.result.createObjectStore('notes');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
          await new Promise((resolve,reject)=>{const tx=database.transaction('notes','readwrite');tx.objectStore('notes').put('conteúdo privado','fixture');tx.oncomplete=resolve;tx.onerror=reject});
          const value=await new Promise(resolve=>{const r=database.transaction('notes').objectStore('notes').get('fixture');r.onsuccess=()=>resolve(r.result)});database.close();return value;
          """)
        XCTAssertEqual(persisted as? String,"conteúdo privado")
        try await expect("return [...document.querySelectorAll('button')].some(button=>button.textContent.includes('Escolher pasta'))", equals: true)
        try await expect("return document.body.textContent.includes('Instalar no Mac')", equals: false)
        // GitHub setup is intentionally hidden until the user chooses that destination.
        try await expect("return !!document.querySelector('section[aria-label=\"GitHub remoto\"]')", equals: false)
        _ = try await js("[...document.querySelectorAll('button')].find(button=>button.textContent==='Conectar GitHub').click();return true")
        try await waitFor("!!document.querySelector('section[aria-label=\"GitHub remoto\"]')")
    }
}
