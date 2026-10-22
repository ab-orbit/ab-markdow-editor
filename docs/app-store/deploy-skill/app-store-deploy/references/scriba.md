# Scriba — measured release findings

Verified October 22, 2026. Recheck live state before acting.

- Project: `standalone/markdown-editor` in the AB-POLInSights workspace. Its actual standalone Git release checkout was `/tmp/scriba-release-20261021`, remote `ab-orbit/ab-markdow-editor`; do not commit the parent monorepo by accident.
- Bundle ID: `com.aeonbridge.scriba`; app ID: `6824664840`; scheme: `Scriba`; authorized signing team: Jefferson Cunha. Brand: Aeon Bridge Co. Team choice comes from project/archive data, not the brand.
- Project commands: `npm run ios:sync`, `npm run ios:archive`. Review release scripts before running; native source changes, web assets and build number must be coherent.
- Official rejection: Guideline 2.1, Information Needed — New App Submission. Apple requested supported physical-device QA and a recording on the latest OS beginning with launching the app. The available connected devices were simulators. Simulator tests cannot satisfy this evidence request.
- Build 27 was signed and simulator-tested but CLI export/upload failed four times at `IDEDistributionUploadAccountStep`: account-to-team resolution. Xcode UI showed the account and Admin role; invalid password was not established. Opening `artifacts/ios/Scriba-1.16.1-build27.xcarchive` in Xcode Organizer and using Distribute App → App Store Connect completed the upload at 13:25 Recife. Xcode showed “App 1.16.1 (27) uploaded”; App Store Connect showed Processing. Do not confuse successful upload with completed Apple processing or review submission.
- App Store draft 1.16.1 still selected build 17 when inspected. Update Review warned that a newer build was available. Avoid knowingly submitting the old build as the current implementation.
- Four privacy locales are enabled: Portuguese (Brazil), English (U.S.), French and German. Stable policies: `https://scriba.aeonbridge.app/privacy/pt-BR.html`, `/privacy/en-US.html`, `/privacy/fr-FR.html`, `/privacy/de-DE.html`. `/privacy.html` remains Portuguese with language navigation.
- Privacy source: `docs/privacy/`; generator `scripts/build-privacy-pages.mjs`; browser/HTTP check `scripts/check-privacy-pages.mjs` (supports `PRIVACY_ORIGIN`). Native manifest: `ios/App/App/PrivacyInfo.xcprivacy`.
- The privacy modal keeps locale edits until Save. Verify each resulting URL after saving/reloading. The missing-English validation banner remained stale until reload, then disappeared.
- On this machine, the connected browser extension belonged to another Chrome profile. The authorized App Store tab was in AeonBridge (Work); inspect actual app/tab inventory rather than assuming the profile. CUA native accessibility `setValue` reliably changed inputs and their character counters. Immediate typing/pasting followed by another click sometimes did not; verify actual input values. Refresh AX indices after each UI mutation and after a full-tree refresh.
- Creative assets: `docs/app-store/creative-assets/` and `welcome-assets/`. Requested PNGs: 5244×2950 universal; 3840×2560 and 1920×1280 for 3:2 search creative. They are not native-device screenshots. No App Clip target exists; the App Clip build warning is unrelated.
- Core use requires no Scriba account. GitHub is an optional repository integration, not the primary app identity. Describe the verified selected build and provide review access only when necessary. Keep sign-in-required unchecked for the offline core experience.
- Release mode was manual. Preserve it. Public web deployment and TestFlight promotion do not equal App Review submission.

Detailed dated work: `docs/app-store/submission-20261022/README.md` in the Scriba repository. Avoid storing tokens, private account credentials or personal review-contact fields in the skill.
