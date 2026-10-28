import XCTest
import UIKit
import CoreImage

/** Actual device rotation complements hosted bridge tests, including iPad window geometry. */
final class ScribaUITests: XCTestCase {
    /** A locked outer viewport must retain actual touch scrolling in inner panes. */
    func testDuoInnerSettingsTouchScrolling() throws {
        guard #available(iOS 27.1, *) else { throw XCTSkip("Duo native workspace.") }
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.aeonbridge.scriba")
        app.launchArguments += ["-AppleLanguages", "(pt-BR)", "-AppleLocale", "pt_BR"]
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 25), app.debugDescription)
        let back = app.buttons["scriba.command.settings-back"]
        if !back.waitForExistence(timeout: 3) {
            let more = app.buttons.matching(NSPredicate(format: "identifier == 'BottomOverflowBarButtonItem' OR label == 'More' OR label == 'Mais'")).firstMatch
            XCTAssertTrue(more.waitForExistence(timeout: 20), app.debugDescription); more.tap()
            let settings = app.buttons.matching(NSPredicate(format: "label == 'Configurações' OR label == 'Settings'")).firstMatch
            XCTAssertTrue(settings.waitForExistence(timeout: 10)); settings.tap()
        }
        XCTAssertTrue(back.waitForExistence(timeout: 10))
        let appearance = app.webViews.staticTexts["Aparência"].firstMatch
        XCTAssertTrue(appearance.waitForExistence(timeout: 10))
        XCTAssertTrue(appearance.isHittable)
        let initial = appearance.frame.minY
        let web = app.webViews.firstMatch
        let start = web.coordinate(withNormalizedOffset: CGVector(dx: 0.88, dy: 0.30))
        let end = web.coordinate(withNormalizedOffset: CGVector(dx: 0.88, dy: 0.04))
        start.press(forDuration: 0.08, thenDragTo: end)
        let moved = NSPredicate { _, _ in !appearance.isHittable || appearance.frame.minY < initial - 30 }
        expectation(for: moved, evaluatedWith: app); waitForExpectations(timeout: 10)
        try capture("duo-inner-settings-touch-scroll.png", to: FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0])
        back.tap()
    }
    /** Actual UIKit bar taps, natural typing, persistence and native Files cancellation. */
    func testDuoNativeToolbarWritingAndFiles() throws {
        guard #available(iOS 27.1, *) else { throw XCTSkip("Requires the adaptive native toolbar.") }
        continueAfterFailure=false
        let app=XCUIApplication(bundleIdentifier:"com.aeonbridge.scriba")
        app.launchArguments += ["-AppleLanguages","(pt-BR)","-AppleLocale","pt_BR"]
        XCUIDevice.shared.orientation = .portrait
        app.launch()
        let create=app.buttons["scriba.command.new"]
        XCTAssertTrue(create.waitForExistence(timeout:25));XCTAssertTrue(create.isHittable);create.tap()
        let discard=app.buttons["Descartar e criar"]
        if discard.waitForExistence(timeout:2) { discard.tap() }
        let text=app.webViews.textViews["Texto da nota"]
        XCTAssertTrue(text.waitForExistence(timeout:20));text.tap()
        text.typeText("Caderno de campo\n\nIdeias que acompanham a pesquisa no Duo.")
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout:10))
        let web=app.webViews.firstMatch,keyboard=app.keyboards.firstMatch
        XCTAssertGreaterThan(web.frame.height,100)
        XCTAssertLessThanOrEqual(web.frame.maxY,keyboard.frame.minY+2)
        let output=FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0]
        try capture("duo-native-writing-keyboard.png",to:output)
        XCUIDevice.shared.orientation = .landscapeLeft
        let fitted=NSPredicate { _,_ in web.frame.height>100 && web.frame.maxY<=keyboard.frame.minY+2 }
        expectation(for:fitted,evaluatedWith:app);waitForExpectations(timeout:12)
        app.typeText(" Texto preservado após a mudança de orientação.")
        try capture("duo-native-writing-orientation-request.png",to:output)
        XCUIDevice.shared.orientation = .portrait
        let done=app.buttons["scriba.command.edit"]
        XCTAssertTrue(done.waitForExistence(timeout:10))
        let doneVisible=NSPredicate { _,_ in done.exists && done.isHittable }
        expectation(for:doneVisible,evaluatedWith:app);waitForExpectations(timeout:10);done.tap()
        let save=app.buttons["scriba.command.save"]
        XCTAssertTrue(save.waitForExistence(timeout:10));XCTAssertTrue(save.isHittable);save.tap()
        let saved=app.webViews.descendants(matching:.any).matching(NSPredicate(format:"label == %@ OR value == %@","Tudo salvo","Tudo salvo")).firstMatch
        XCTAssertTrue(saved.waitForExistence(timeout:15))
        try capture("duo-native-reading-saved.png",to:output)
        let open=app.buttons["scriba.command.open"]
        XCTAssertTrue(open.isHittable);open.tap()
        let cancel=app.buttons.matching(NSPredicate(format:"label == 'Cancelar' OR label == 'Cancel'")).firstMatch
        XCTAssertTrue(cancel.waitForExistence(timeout:15))
        try capture("duo-native-files-picker.png",to:output)
        cancel.tap()
        XCTAssertTrue(save.waitForExistence(timeout:10))
        XCTAssertTrue(app.webViews.descendants(matching:.any).matching(NSPredicate(format:"label CONTAINS %@ OR value CONTAINS %@","Ideias que acompanham","Ideias que acompanham")).firstMatch.waitForExistence(timeout:10))
    }
    /** The Duo's outer main screen can be black while the inner screen is active.
        Select an illuminated public XCUIScreen before normalizing its orientation. */
    private func capture(_ name: String, to folder: URL) throws {
        let context = CIContext()
        let images = XCUIScreen.screens.map { $0.screenshot().image }
        let image = images.first { candidate in
            guard let input = CIImage(image: candidate), let average = CIFilter(name: "CIAreaAverage", parameters: [kCIInputImageKey: input, kCIInputExtentKey: CIVector(cgRect: input.extent)])?.outputImage else { return false }
            var pixel = [UInt8](repeating: 0, count: 4)
            context.render(average, toBitmap: &pixel, rowBytes: 4, bounds: CGRect(x: 0, y: 0, width: 1, height: 1), format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
            return Int(pixel[0]) + Int(pixel[1]) + Int(pixel[2]) > 12
        } ?? XCUIScreen.main.screenshot().image
        let format = UIGraphicsImageRendererFormat(); format.scale = image.scale
        let normalized = UIGraphicsImageRenderer(size: image.size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: image.size))
        }
        try XCTUnwrap(normalized.pngData()).write(to: folder.appendingPathComponent(name))
    }

    func testRotationAndStoreScreenshots() throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.aeonbridge.scriba")
        app.launchArguments += ["-AppleLanguages", "(pt-BR)", "-AppleLocale", "pt_BR"]
        app.launch()
        let web = app.webViews.firstMatch
        XCTAssertTrue(web.waitForExistence(timeout: 20))
        let output = FileManager.default.urls(for:.documentDirectory,in:.userDomainMask)[0]
        XCUIDevice.shared.orientation = .portrait
        let portrait = NSPredicate { _,_ in web.frame.height > web.frame.width }
        expectation(for:portrait,evaluatedWith:app);waitForExpectations(timeout:10)
        XCTAssertTrue(app.staticTexts["Um lugar para suas ideias"].firstMatch.waitForExistence(timeout:20))
        try capture("reading-portrait.png", to: output)
        XCUIDevice.shared.orientation = .landscapeLeft
        let landscape = NSPredicate { _,_ in web.frame.width > web.frame.height && app.frame.width > app.frame.height }
        expectation(for:landscape,evaluatedWith:app);waitForExpectations(timeout:10)
        try capture("reading-landscape.png", to: output)
        XCUIDevice.shared.orientation = .portrait
    }

    /** Real keyboard and device rotation must preserve a usable editing surface. */
    func testWritingLandscapeTools() throws {
        guard UIDevice.current.userInterfaceIdiom == .phone else { throw XCTSkip("Phone keyboard geometry is covered on the iPhone destination.") }
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.aeonbridge.scriba")
        app.launchArguments += ["-AppleLanguages", "(pt-BR)", "-AppleLocale", "pt_BR"]
        app.launch()
        XCUIDevice.shared.orientation = .portrait
        let notes = app.buttons["Voltar às notas"]
        XCTAssertTrue(notes.waitForExistence(timeout: 20)); notes.tap()
        let create = app.buttons["Nova nota"]
        XCTAssertTrue(create.waitForExistence(timeout: 10)); create.tap()
        let discard = app.buttons["Descartar e criar"]
        if discard.waitForExistence(timeout: 2) { discard.tap() }
        let text = app.webViews.textViews["Texto da nota"]
        XCTAssertTrue(text.waitForExistence(timeout: 15)); text.tap()
        text.typeText("Landscape writing")
        XCUIDevice.shared.orientation = .landscapeLeft
        XCTAssertTrue(app.keyboards.firstMatch.waitForExistence(timeout: 10))
        let tools = app.buttons["Formatação"]
        XCTAssertTrue(tools.waitForExistence(timeout: 10)); XCTAssertTrue(tools.isHittable); tools.tap()
        let bold = app.buttons["Negrito"]
        XCTAssertTrue(bold.waitForExistence(timeout: 10)); XCTAssertTrue(bold.isHittable); bold.tap()
        app.typeText(" formatted text")
        XCTAssertTrue(tools.isHittable)
        let output = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        try capture("writing-landscape-keyboard.png", to: output)
        // WKWebView exposes differently formatted text runs as separate accessibility elements.
        let formatted = app.webViews.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@ OR value CONTAINS %@", "formatted text", "formatted text")).firstMatch
        XCTAssertTrue(formatted.waitForExistence(timeout: 10))
        XCUIDevice.shared.orientation = .portrait
    }


    /** The native web frame must stay above the docked keyboard in both tablet orientations. */
    func testTabletKeyboardResizesDocument() throws {
        guard UIDevice.current.userInterfaceIdiom == .pad else { throw XCTSkip("Tablet geometry.") }
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.aeonbridge.scriba")
        app.launchArguments += ["-AppleLanguages", "(pt-BR)", "-AppleLocale", "pt_BR"]
        app.launch()
        XCUIDevice.shared.orientation = .portrait
        let notes = app.buttons["Voltar às notas"]
        XCTAssertTrue(notes.waitForExistence(timeout: 20)); notes.tap()
        let create = app.buttons["Nova nota"]
        XCTAssertTrue(create.waitForExistence(timeout: 10)); create.tap()
        let discard = app.buttons["Descartar e criar"]
        if discard.waitForExistence(timeout: 2) { discard.tap() }
        let text = app.webViews.textViews["Texto da nota"]
        XCTAssertTrue(text.waitForExistence(timeout: 15)); text.tap()
        text.typeText("Tablet keyboard writing\n" + (1...18).map { "Document line \($0)" }.joined(separator: "\n"))
        for orientation in [UIDeviceOrientation.portrait, .landscapeLeft] {
            XCUIDevice.shared.orientation = orientation
            let keyboard = app.keyboards.firstMatch
            XCTAssertTrue(keyboard.waitForExistence(timeout: 10))
            let web = app.webViews.firstMatch
            let fitted = NSPredicate { _, _ in
                web.frame.minY >= 0 && web.frame.maxY <= keyboard.frame.minY + 2 && web.frame.height > 100
            }
            expectation(for: fitted, evaluatedWith: app); waitForExpectations(timeout: 10)
            XCTAssertFalse(app.buttons["Fechar lista de notas"].exists)
            app.typeText(" More visible text.")
            let output = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            try capture(orientation == .portrait ? "tablet-writing-portrait.png" : "tablet-writing-landscape.png", to: output)
        }
        XCUIDevice.shared.orientation = .portrait
    }

    /** Automatic language follows the device even when the content of a note is Portuguese. */
    func testEnglishDeviceLanguage() throws {
        XCUIDevice.shared.orientation = .portrait
        let app = XCUIApplication(bundleIdentifier: "com.aeonbridge.scriba")
        app.launchArguments += ["-AppleLanguages", "(en)", "-AppleLocale", "en_US"]
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20))
        let languageHeading = app.staticTexts["Interface language"].firstMatch
        // The native scene can restore the settings route left by bridge regression tests.
        if !languageHeading.waitForExistence(timeout: 3) {
            let openSettings = app.buttons["Settings"]
            if !openSettings.isHittable {
                let more = app.buttons["More options"]
                XCTAssertTrue(more.waitForExistence(timeout: 10))
                more.tap()
            }
            XCTAssertTrue(openSettings.waitForExistence(timeout: 10))
            openSettings.tap()
        }
        XCTAssertTrue(languageHeading.waitForExistence(timeout: 10))
        let back = app.buttons["Return to editor"]
        XCTAssertTrue(back.exists); back.tap()
    }
    func testAdditionalDeviceLanguages() throws {
        XCUIDevice.shared.orientation = .portrait
        let cases = [
            ("de", "de_DE", "Einstellungen", "Weitere Notizoptionen", "Sprache der Benutzeroberfläche", "Zurück zum Editor"),
            ("fr", "fr_FR", "Paramètres", "Plus d'options de notes", "Langue de l’interface", "Retour à l'éditeur"),
            ("ja", "ja_JP", "Settings", "More options", "Interface language", "Return to editor")
        ]
        for (language, locale, settingsLabel, moreLabel, headingLabel, backLabel) in cases {
            let app = XCUIApplication(bundleIdentifier: "com.aeonbridge.scriba")
            app.launchArguments += ["-AppleLanguages", "(\(language))", "-AppleLocale", locale]
            app.launch()
            XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 20))
            let heading = app.staticTexts[headingLabel].firstMatch
            if !heading.waitForExistence(timeout: 3) {
                let settings = app.buttons[settingsLabel]
                if !settings.isHittable {
                    let more = app.buttons[moreLabel]
                    XCTAssertTrue(more.waitForExistence(timeout: 10), language)
                    more.tap()
                }
                XCTAssertTrue(settings.waitForExistence(timeout: 10), language)
                settings.tap()
            }
            XCTAssertTrue(heading.waitForExistence(timeout: 10), language)
            let back = app.buttons[backLabel]
            XCTAssertTrue(back.exists, language)
            back.tap()
            app.terminate()
        }
    }

}
