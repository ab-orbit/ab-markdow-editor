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

- Apple processing completed. Build 27 became Ready to Submit. Added Equipe Scriba and Scriba Beta, supplied the test plan and submitted the beta distribution with automatic tester notifications enabled. The resulting list showed build 27 **Testing**, assigned to both groups. This is TestFlight distribution, not official App Store approval.

## Pending verification

The official draft was updated from build 17 to build 27 using Delete (selection only) → Add Build → 27 → Done → Save. Manual release was preserved. The requested physical-device recording and QA details remain owner-supplied requirements; no such artifact has been provided. Do not treat clearing metadata validation or TestFlight Testing as App Review approval.

## Evidence

- [Xcode build 27 uploaded](xcode-build27-uploaded.png)
- [Apple processing build 27](app-store-build27-processing.png)
- Saved privacy URLs: [Portuguese](privacy-pt-BR-saved.png), [English](privacy-en-US-saved.png), [French](privacy-fr-FR-saved.png), [German](privacy-de-DE-saved.png)
- [Localized public pages and verification](../../privacy/README.md)
- [Reusable deployment skill](../deploy-skill/app-store-deploy/SKILL.md), also installed in `~/.codex/skills/app-store-deploy/`. Skill frontmatter validation passed.

- [Build 27 Testing in both groups](build27-testing-both-groups.png)

## Metadata validation corrections

With build 27 selected, Update Review returned “Unable to Add for Review” and a generic unexpected-error summary, followed by four specific required-field errors:

1. German — Description.
2. German — Keywords.
3. German — Support URL.
4. English (U.S.) — Support URL.

Completed a German description equivalent to the factual Portuguese feature listing, added localized keywords (86 characters, within the 100-character limit) and the existing public support URL. Added the same verified support URL to the English localization. Saved both locales and repeated Update Review. German source is in `metadata.de-DE.json`. Do not interpret a generic summary as a backend outage before reading the locale-specific details.

## Final observed state for this work session

After the four metadata corrections, Update Review succeeded and opened the existing submission details. Its item is **iOS App 1.16.1 (27) — Ready for Review**. **Resubmit to App Review** is enabled. All reported missing-field validation errors are cleared.

The submission still shows **Unresolved Issues** because the prior Guideline 2.1 information request has not been answered with its required physical-device recording and QA details. The final re-submission was not clicked: the requested evidence was not provided, and only simulated devices were available. This is an evidence prerequisite from Apple's actual review message, not a new approval requirement imposed by the skill.

To finish: install 1.16.1 (27) from TestFlight on supported physical devices; complete QA; supply the launch-from-icon recording on the latest OS plus device model, OS version, build and test results. Attach the recording, update the existing Notes and send a complete reply to App Review. Then use the enabled Resubmit to App Review action and verify Waiting for Review and its timestamp. Do not claim those steps occurred until observed.

[Ready for Review and the outstanding Apple request](build27-ready-for-review-recording-pending.png).

The public application update manifest was not promoted from build 17 during this task. The policies were deployed independently as static pages. The native build remains the previously signed and tested build 27, not a new build incorporating later creative assets or incidental catalog edits.
