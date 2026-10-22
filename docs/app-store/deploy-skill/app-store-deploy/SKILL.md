---
name: app-store-deploy
description: Prepare, upload, localize and submit an Apple App Store release, diagnose Xcode distribution and App Store Connect validation failures, and record verifiable release evidence. Use for App Store or TestFlight deployment workflows.
---

# App Store deployment

Complete the user's authorized release workflow and verify the resulting state in App Store Connect. Upload, TestFlight distribution, adding an item to review, submitting for review, approval and public release are separate outcomes. Never report a later state merely because an earlier step succeeded.

## Establish the release

Read the repository’s release instructions and existing rejection messages. Identify the bundle ID, developer team, App Store app ID, version, build and release mode from actual project/archive/store data. A brand name is not a developer team ID. Preserve manual release unless the user requests a change.

Identify the exact native binary being submitted. A web deployment, simulator install or changed source directory does not update an archived/uploaded binary. Record source commit, archive path, version/build, signing team, upload outcome and selected store build. Do not replace the user's unrelated local or device data while testing.

## Build and upload

Use the project's existing sync/archive commands. Verify that bundled web assets, native configuration and privacy manifest match the intended release. Run checks appropriate to changed behavior. Distinguish physical-device QA from simulator/browser testing.

Prefer existing supported credentials and tooling. When a CLI upload fails, read the failing distribution step rather than guessing that the password is invalid. A signed archive and a connected Xcode account do not establish that CLI account-to-team resolution works. After confirming account role and team, the same archive can be opened in Xcode Organizer and distributed through App Store Connect. Do not repeat identical failed CLI uploads without a changed condition or diagnostic purpose. Never copy account secrets from Xcode’s stores into scripts or logs.

Use App Store Connect distribution, not “TestFlight Internal Only”, for a binary intended for App Review. Wait for upload confirmation and Apple processing; verify export compliance and eligibility before selecting the build. Check for an old selected build when Apple reports “Newer Build Available”. Replace the selection only after the desired replacement is available; removing a selected build is not deleting the uploaded binary.

## Metadata and privacy

Check all enabled localizations, not just the primary language. Required privacy URLs can be missing in English even when Portuguese is complete. Publish stable, public HTTPS policy pages before entering them. Verify HTTP 200, correct language and actual policy content without login. Translate verified data practices; do not invent retention periods, compliance claims or analytics exclusions.

In App Privacy, enter the matching URL for each locale and save. Reopen or reload to confirm persistence and clear stale validation messages. The optional User Privacy Choices URL is a distinct field; do not fill it merely to silence a warning. Native privacy manifests, store privacy labels and the public privacy policy serve different purposes and must remain factually consistent.

Screenshots must show the app in use and match the device slot’s dimensions. Marketing creative assets are separate from native screenshots. The creative Asset Library is separate from App Clip metadata; do not add an App Clip to solve an unrelated asset error. Consult current Apple size requirements and preview cropping.

## Review and completion

Open the actual review message and satisfy its specific requests. If Apple requests a physical-device recording, use a real supported device and the requested OS. Start at app launch when requested; match the recording to the selected build. Ask for the missing recording/device details early and continue independent metadata work. Never manufacture QA, attachments, credentials, rights or device evidence.

For a rejected submission, distinguish “Update Review” from final “Resubmit to App Review”. Inspect the returned validation messages, resolve each verified issue, then verify the submission status and timestamp. User authorization to submit covers the ordinary submission action; respect any separately required confirmation for new legal agreements, credential changes or financial commitments. Preserve release mode.

If a required owner-supplied artifact, device or Apple processing blocks completion, finish independent work, document the precise blocker and provide the smallest next action. Do not claim submission succeeded or bypass an Apple requirement.

Maintain a release record of errors, fixes, evidence, selected binary, unresolved requirements and final observed status. Record only reusable findings in this skill; keep app-specific identifiers and dated outcomes in a reference. Read [Scriba findings](references/scriba.md) when working on Scriba.

## Official references

Verify changing requirements against Apple’s current documentation:

- https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/
- https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds/
- https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
- https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications/
- https://developer.apple.com/app-store/review/guidelines/
