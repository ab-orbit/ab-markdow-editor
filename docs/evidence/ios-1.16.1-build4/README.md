# Scriba 1.16.1 (4)

This build includes the compact mobile formatting capsule and floating, horizontally scrollable formatting tools; caret visibility during rotation and keyboard resizing; aligned Excalidraw font controls; and bounded, scrollable mobile drawing properties and font sheets. Desktop formatting remains available.

Validation:

- Signed ARM64 archive and App Store IPA export succeeded.
- 63 Node tests passed: [output](unit-tests.log).
- Six native iPhone simulator tests passed, including rotation and typing with the real software keyboard: [output](native-iphone-tests.log).
- Real Excalidraw browser checks passed in [Chromium](chrome-properties.log) and [WebKit](webkit-properties.log), at 390px, 440px and desktop widths.
- [Mobile drawing screenshots](../font-picker-alignment/README.md).
- [Mobile writing screenshots](../mobile-writing/).

Physical-device testing remains with the owner. Apple upload, processing and tester availability are distinct steps; upload status is recorded after Xcode confirms completion.

Xcode confirmed “App upload complete: App 1.16.1 (4) uploaded” on 20 October 2026. App Store Connect processing and TestFlight tester availability have not yet been verified. This upload does not resubmit the rejected App Store version.

## Apple Silicon Mac availability — 20 October 2026

Enabled Mac testing in both existing groups: Equipe Scriba (internal) and Scriba Beta (external). Added build 1.16.1 (4) to Equipe Scriba; App Store Connect reports Testing. External build review/distribution was not changed.

Enabled and saved “Make this app available” under iPhone and iPad Apps on Apple Silicon Macs in Pricing and Availability. Reloading the page confirmed the checkbox remains enabled; minimum OS is Automatic (macOS 12.0). The optional developer compatibility attestation was not submitted without native runtime QA. App Store approval remains pending resolution of the existing rejection.

On this Mac, TestFlight now displays “Currently Testing”, build 1.16.1 (4), an Install button, and “Compatibility, Works on this Mac”. The earlier iOS-only incompatibility message is gone. This is iOS-on-Apple-Silicon distribution, not an Intel macOS build or a separate native macOS target.
