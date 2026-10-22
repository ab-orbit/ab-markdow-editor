# App Store submission work — October 22, 2026

## Scope and verification

The owner authorized entering localized privacy URLs, fixing submission errors, submitting for App Review, documenting the process and creating a reusable deployment skill. This record distinguishes observed outcomes from pending actions.

## Completed

- Created static privacy pages for pt-BR, en-US, de-DE and fr-FR, preserving the existing Portuguese policy’s factual scope.
- Published all four at `https://scriba.aeonbridge.app/privacy/<locale>.html`; retained `/privacy.html` as Portuguese with language links.
- Verified production HTTP 200, correct HTML language, all five sections and nine paragraphs, contact links, language-switch navigation, desktop/mobile layout and legacy URL.
- Entered the four locale-specific URLs in App Store Connect’s App Privacy editor and saved. After reloading, the missing English privacy URL error disappeared.
- Verified the official version draft remains 1.16.1, selecting build 17, manual release, no mandatory Scriba sign-in.

## Observations that change the workflow

- Native accessibility `setValue` reliably updates App Store Connect inputs and triggers their character counter. Batched typing/pasting and immediate subsequent clicks did not consistently update the field; verify the actual value before proceeding.
- Privacy changes can be edited across locales in the same modal, then saved. A stale validation banner can remain until a reload. Reopen/reload to distinguish a stale warning from an unsaved value.
- The existing App Review rejection is Guideline 2.1. The current review notes explicitly say physical-device QA and a launch-from-icon recording are still required. No attachment was present when inspected.
- `xcrun devicectl list devices` currently exposes simulated devices only. Do not describe a simulator recording as physical-device evidence.

## Additional verified outcomes

- Corrected the Portuguese listing signature from “AB Markdown Editor, por Aeon Bridge Co.” to “Powered by Aeon Bridge Co.” and saved.
- Opened the existing signed build 27 archive through Xcode → Open, then Organizer → Distribute App → App Store Connect → Distribute. Upload completed at 13:25 Recife (16:25 UTC). The archive row showed Uploaded to Apple; App Store Connect showed build 27 Processing.
- This GUI path resolved the upload obstacle without changing credentials. It does not establish the underlying cause of the CLI account-resolution failure.
- Update Review for build 17 showed “Newer Build Available”; canceled that confirmation to avoid submitting the older binary.
- Read the actual Apple review message: physical-device testing and a recording on the latest OS starting at launch are expressly requested. Asked the owner for the recording path and device/OS/build details while continuing independent work.

## Pending verification

Inspect the actual review message, determine all current validation errors, reconcile the selected native build with available uploads, and record the final submission result here. Do not treat clearing metadata validation as App Review approval.

## Evidence

- [Xcode build 27 uploaded](xcode-build27-uploaded.png)
- [Apple processing build 27](app-store-build27-processing.png)
- Saved privacy URLs: [Portuguese](privacy-pt-BR-saved.png), [English](privacy-en-US-saved.png), [French](privacy-fr-FR-saved.png), [German](privacy-de-DE-saved.png)
- [Localized public pages and verification](../../privacy/README.md)
- [Reusable deployment skill](../deploy-skill/app-store-deploy/SKILL.md), also installed in `~/.codex/skills/app-store-deploy/`. Skill frontmatter validation passed.
