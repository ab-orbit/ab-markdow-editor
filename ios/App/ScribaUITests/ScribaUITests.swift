import XCTest
import UIKit

/** Actual device rotation complements hosted bridge tests, including iPad window geometry. */
final class ScribaUITests: XCTestCase {
    /** Capture the full display and normalize UIKit orientation instead of cropping a rotating app window. */
    private func capture(_ name: String, to folder: URL) throws {
        let image = XCUIScreen.main.screenshot().image
        let format = UIGraphicsImageRendererFormat(); format.scale = image.scale
        let normalized = UIGraphicsImageRenderer(size: image.size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: image.size))
        }
        try XCTUnwrap(normalized.pngData()).write(to: folder.appendingPathComponent(name))
    }

    func testRotationAndStoreScreenshots() throws {
        continueAfterFailure = false
        let app = XCUIApplication(bundleIdentifier: "com.aeonbridge.scriba")
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
}
