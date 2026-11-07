import AppKit

// Read-only acceptance check against an installed bundle and real LaunchServices decisions.
// Usage: xcrun swift tests/macos-associations.smoke.swift /Applications/Scriba.app /path/sample.md /path/sample.markdown
guard CommandLine.arguments.count >= 4 else {
    fputs("Usage: macos-associations.smoke.swift APPLICATION.app SAMPLE.md SAMPLE.markdown\n", stderr)
    exit(2)
}
let appURL = URL(fileURLWithPath: CommandLine.arguments[1]).resolvingSymlinksInPath()
guard let bundle = Bundle(url: appURL),
      bundle.bundleIdentifier == "com.aeonbridge.markdown",
      let types = bundle.infoDictionary?["CFBundleDocumentTypes"] as? [[String: Any]],
      let markdown = types.first(where: { ($0["LSItemContentTypes"] as? [String])?.contains("net.daringfireball.markdown") == true }) else {
    fputs("FAIL: the installed application has no Scriba Markdown declaration\n", stderr)
    exit(1)
}
var failures: [String] = []
if let name = markdown["CFBundleTypeIconFile"] as? String, let resources = bundle.resourceURL {
    let iconURL = resources.appendingPathComponent(name.hasSuffix(".icns") ? name : name + ".icns")
    if let bytes = try? Data(contentsOf: iconURL), String(data: bytes.prefix(4), encoding: .ascii) == "icns" {
        print("PASS: bundled document icon resolves to a real ICNS resource")
    } else { failures.append("document icon does not resolve to a real ICNS resource") }
} else { failures.append("Markdown document icon is missing") }
for sample in CommandLine.arguments.dropFirst(2) {
    let file = URL(fileURLWithPath: sample)
    guard FileManager.default.fileExists(atPath: file.path) else {
        failures.append("sample does not exist: \(file.lastPathComponent)")
        continue
    }
    let resolved = NSWorkspace.shared.urlForApplication(toOpen: file)?.resolvingSymlinksInPath()
    if resolved == appURL { print("PASS: \(file.lastPathComponent) resolves to Scriba") }
    else { failures.append("\(file.lastPathComponent) resolves to \(resolved?.path ?? "no application")") }
}
for failure in failures { fputs("FAIL: \(failure)\n", stderr) }
exit(failures.isEmpty ? 0 : 1)
