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
               let controller = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController as? ScribaViewController,
               let view = controller.webView {
                web = view
                if (try? await js("return !!window.Capacitor?.nativePromise && !!document.querySelector('.editor-app')")) as? Bool == true { break }
            }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertNotNil(web)
        try await waitFor("!!document.querySelector('input[aria-label=\"Arquivo Markdown\"]') && !document.querySelector('input[aria-label=\"Arquivo Markdown\"]').disabled")
        fixture = FileManager.default.temporaryDirectory.appendingPathComponent("scriba-native-test-" + UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: fixture, withIntermediateDirectories: true)
    }
    override func tearDown() async throws {
        UserDefaults.standard.removeObject(forKey: "scriba.files.bookmark")
        if let fixture = fixture { try? FileManager.default.removeItem(at: fixture) }
    }
    private func js(_ body: String, args: [String: Any] = [:]) async throws -> Any? {
        try await web.callAsyncJavaScript(body, arguments: args, in: nil, contentWorld: .page)
    }
    private func native(_ method: String, args: [String: Any] = [:]) async throws -> Any? {
        try await js("return await window.Capacitor.nativePromise('ScribaNative',method,options)", args: ["method": method,"options":args])
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

    func testNativeFilesRoundTripConflictsAndReload() async throws {
        try grantFixture()
        let initial = "\u{feff}# Arquivo do Files\r\n\r\nConteúdo original.\r\n"
        try Data(initial.utf8).write(to: fixture.appendingPathComponent("original.md"))
        _ = try await native("authorizeFolder")
        let loaded = try await native("readNotes") as! [String: Any]
        let notes = loaded["notes"] as! [[String: Any]]
        XCTAssertEqual(notes.first?["value"] as? String, initial)
        let body: [String: Any] = ["name":"original.md","value":"# Primeira cópia","files":[]]
        _ = try await native("saveNote", args: body)
        let saved = fixture.appendingPathComponent("scriba/original.md")
        XCTAssertEqual(try String(contentsOf: saved, encoding:.utf8),"# Primeira cópia")
        XCTAssertEqual(try String(contentsOf: fixture.appendingPathComponent("original.md"),encoding:.utf8),initial)
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
        try await expect("return document.documentElement.scrollWidth<=innerWidth+1",equals:true)
        scene.requestGeometryUpdate(.iOS(interfaceOrientations:.portrait))
        for _ in 0..<100 { if web.bounds.height > web.bounds.width { break };try await Task.sleep(nanoseconds:50_000_000) }
        XCTAssertGreaterThan(web.bounds.height,web.bounds.width)
        try await expect("return document.documentElement.scrollWidth<=innerWidth+1",equals:true)
    }

    func testReferenceDiagramsCanvasAndSystemSheets() async throws {
        let controller = (UIApplication.shared.connectedScenes.first as! UIWindowScene).windows.first(where: { $0.isKeyWindow })!.rootViewController as! ScribaViewController
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
        XCTAssertGreaterThan(web.frame.minY,0)
        XCTAssertLessThan(web.frame.maxY,controller.view.bounds.height)
        _ = try await js("document.querySelector('article h1').scrollIntoView();window.dispatchEvent(new KeyboardEvent('keydown',{key:'s',metaKey:true,bubbles:true,cancelable:true}));return true")
        try await waitFor("document.body.textContent.includes('Nota salva neste aplicativo') || [...document.querySelectorAll('dialog[open] button')].some(button=>button.textContent==='Substituir arquivo existente')")
        // Repeated runs may import a newer version of this fictional simulator-only fixture.
        _ = try await js("[...document.querySelectorAll('dialog[open] button')].find(button=>button.textContent==='Substituir arquivo existente')?.click();return true")
        try await waitFor("document.body.textContent.includes('Nota salva neste aplicativo')")
    }

    func testBundledEditorAndPrivatePersistence() async throws {
        XCTAssertEqual(web.url?.scheme,"capacitor")
        try await expect("return document.querySelector('meta[http-equiv=\"Content-Security-Policy\"]').content.includes(\"script-src 'self'\")", equals: true)
        try await expect("return !!document.querySelector('button[aria-label=\"Configurações\"]')", equals: true)
        try await expect("return !!document.querySelector('script[src=\"/register-sw.js\"]')", equals: false)
        // IndexedDB opens and persists in the real native origin, not an ephemeral browser profile.
        let persisted = try await js("""
          const database=await new Promise((resolve,reject)=>{const r=indexedDB.open('scriba-native-test',1);r.onupgradeneeded=()=>r.result.createObjectStore('notes');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
          await new Promise((resolve,reject)=>{const tx=database.transaction('notes','readwrite');tx.objectStore('notes').put('conteúdo privado','fixture');tx.oncomplete=resolve;tx.onerror=reject});
          const value=await new Promise(resolve=>{const r=database.transaction('notes').objectStore('notes').get('fixture');r.onsuccess=()=>resolve(r.result)});database.close();return value;
          """)
        XCTAssertEqual(persisted as? String,"conteúdo privado")
        _ = try await js("document.querySelector('button[aria-label=\"Configurações\"]').click();return true")
        try await waitFor("!!document.querySelector('#settings-page')")
        try await expect("return [...document.querySelectorAll('button')].some(button=>button.textContent.includes('Selecionar pasta em Files'))", equals: true)
        try await expect("return document.body.textContent.includes('Instalar no Mac')", equals: false)
        try await expect("return !!document.querySelector('section[aria-label=\"GitHub remoto\"]')", equals: true)
    }
}
