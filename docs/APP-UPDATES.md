# Application update notices

An unobtrusive, dismissible notice checks for a newer release on startup and when returning to the app (at most once every five minutes), with an hourly retry. Offline failures are silent. Checks do not include notes, credentials or device identifiers. The interface is translated into Portuguese, English, German and French.

## Native App Store

The Swift bridge reads the installed bundle version/build and checks Apple's public software lookup for app `6824664840` in the current locale's region. The response must identify the Scriba bundle and a numerically newer public version. No catalog result, old/malformed metadata, or an unpublished App Store version produces no notice. The action opens the fixed listing `https://apps.apple.com/app/id6824664840`.

## TestFlight

Release builds whose App Store receipt is `sandboxReceipt` check `https://scriba.aeonbridge.app/app-updates.json` instead. Debug builds identify themselves as development and do not query a release catalog. TestFlight compares both version and build number and rejects expired promotions; the action opens TestFlight with `itms-beta://`. It never sends a TestFlight user to the public App Store listing.

**Promote metadata only after Apple processing finishes and the build is available to the intended testers.** Upload success alone is insufficient. Update `public/app-updates.json` to the confirmed version/build, keep `schema: 1` and `status: "testing"`, set `expiresAt` to its actual ISO expiry time, and publish it with the public web release. The current confirmed promotion is 1.16.1 (17), verified as Testing in App Store Connect for both Equipe Scriba (internal) and Scriba Beta (external) on 22 October 2026.

App Store availability comes from Apple, not the TestFlight manifest. Remote metadata cannot change the locally fixed update destinations. The native transport uses ephemeral networking and a 10-second timeout; its response is limited to 64 KB.

## Web/PWA and local Mac web application

The existing service worker identifies an installed waiting update. The notice appears in the editor, not only Settings. “Update now” first flushes the active editor and persists its latest draft, then explicitly activates the waiting worker and reloads. “Remind me later” dismisses the notice for this session. Editing never triggers an automatic reload. If another app window is open, its old static assets remain cached so it can finish editing. A local Mac installation only detects updates already installed in its local web resources; it is not redirected to an unrelated store product.

## Rollout limitation

Existing native build 13 does not contain this new checker. Users must install a subsequent native build once before future update notices can appear. Web users receive the feature through the public web deployment. This implementation does not itself upload a new TestFlight build or claim that an unreleased App Store update exists.

## Verification

- `node --test tests/app-updates.test.mjs`: numeric version/build comparison, exact app identity, malformed/old/unpromoted catalog rejection, fixed destinations.
- `node tests/app-updates.smoke.mjs` (also `MARKDOWN_BROWSER=webkit`): actual editor UI with native transport fixtures, correct App Store/TestFlight buttons, one native opening and dismissal.
- `node tests/web-update.smoke.mjs`: a waiting-worker fixture verifies draft preservation before explicit reload.
- `node tests/web-update-worker.smoke.mjs`: generated worker activation, multiwindow asset retention, API cache exclusion.
- Simulator XCTest `testUpdateBridgeReportsInstalledMetadataAndRejectsUnknownChannels`: real native metadata bridge and rejected invalid channel. Release simulator compilation covers the public lookup branch.

[Visual evidence](evidence/app-updates/README.md).

References: [Apple software lookup](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/LookupExamples.html), [App Store receipt URL](https://developer.apple.com/documentation/foundation/bundle/appstorereceipturl).
