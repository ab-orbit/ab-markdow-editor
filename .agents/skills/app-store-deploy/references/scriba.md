# Scriba — historical publication findings

**Snapshot: 7 November 2026. These are dated observations, not live App Store Connect state or current Apple requirements.** Recheck the account, selected binary, enabled locales, device slots and review messages. Prefer the latest dated receipt over older summary prose: the older App Store README still called build 29 current when build 31 had a later submission receipt.

Historical links below are pinned to public commit `ed7c81bf46430e45ba380be76040250fda3a9586`. Its November media evidence and capture scripts were absent from the main branch examined during this audit. Inspect the pinned implementation before reusing it; do not assume a current checkout contains those files.

## Project and binary identity

| Field | Historical value |
| --- | --- |
| Standalone repository | `ab-orbit/ab-markdow-editor` |
| Native bundle ID | `com.aeonbridge.scriba` |
| App Store Connect app ID | `6824664840` |
| Xcode project / scheme | `ios/App/App.xcodeproj` / `Scriba` |
| Brand | Aeon Bridge Co. |
| Public release mode | **Manual** |
| Latest recorded submitted binary | **1.17.2 (31)** |
| Application source commit for that binary | `32209de1da517ea2578386f10f47bd19217fd2ba` |
| Toolchain for that binary | Xcode 27.1 / iPhoneOS 27.1 SDK |

Source also existed under `standalone/markdown-editor` inside an AB-POLInSights monorepo, while release checkouts had their own Git root. Verify root and remote before Git writes. Select the signing team from the authorized account and actual archive; a brand or email is not a Team ID.

The iOS app bundles its editor with Capacitor. A website deployment, Mac launcher fix or simulator install does not update an existing archive/upload. Record the actual candidate's source commit, version/build, archive path, bundled-file fingerprint and Apple build ID.

### Source recipes

Use a verified unused build number and authorized signing team. The historical [archive script](https://github.com/ab-orbit/ab-markdow-editor/blob/ed7c81bf46430e45ba380be76040250fda3a9586/scripts/archive-ios.mjs) invokes `ios:sync`, archives Release for `generic/platform=iOS`, and exports with `method=app-store-connect`. Preserve its static archive output under a unique candidate name before another archive is created.

```sh
npm ci
npm run check:locales
SCRIBA_APPLE_TEAM_ID="$AUTHORIZED_TEAM_ID" \
SCRIBA_IOS_BUILD_NUMBER="$NEXT_BUILD_NUMBER" npm run ios:archive

xcodebuild -project ios/App/App.xcodeproj -scheme Scriba \
  -destination "platform=iOS Simulator,id=$DISPOSABLE_SIMULATOR_UDID" \
  -derivedDataPath "$ISOLATED_DERIVED_DATA" CODE_SIGNING_ALLOWED=NO test
```

Do not prepare a new binary solely to resubmit metadata for a suitable candidate already approved by the owner. The October 27 record identifies an unnecessary build 28 preparation while build 27 was the binary actually resubmitted.

## Account, upload and TestFlight

- Build 27 repeatedly failed CLI distribution at `IDEDistributionUploadAccountStep` although the authorized account/role was visible in Xcode. An invalid password was not established. **Organizer → Distribute App → App Store Connect** uploaded the same signed archive. Avoid identical failed retries and never extract stored account secrets to work around team resolution.
- After later owner authentication, build 28 was uploaded and validated but not selected for official review. Verify the selected Apple build independently of upload success.
- Build 27 was later observed **Testing** in **Equipe Scriba** (internal) and **Scriba Beta** (external), after processing, test notes and beta submission. A tester email alone does not establish build availability. Processing, group availability, beta review, official review and public release are distinct outcomes.
- Some later store actions retained an older public TestFlight update-manifest promotion. Promote that metadata only after the intended testers actually have the replacement available.

Sources: [October 22 upload/review record](https://github.com/ab-orbit/ab-markdow-editor/blob/ed7c81bf46430e45ba380be76040250fda3a9586/docs/app-store/submission-20261022/README.md), [October 27 build/selection record](https://github.com/ab-orbit/ab-markdow-editor/blob/ed7c81bf46430e45ba380be76040250fda3a9586/docs/app-store/submission-20261027/README.md), [update promotion rules](https://github.com/ab-orbit/ab-markdow-editor/blob/ed7c81bf46430e45ba380be76040250fda3a9586/docs/APP-UPDATES.md).

## Four-language metadata and privacy

Recorded locales were **pt-BR, en-US, de-DE and fr-FR**. Localize both actual application controls and sample-document content; selecting English in App Store Connect does not translate Portuguese captures. Filename prefixes are useful provenance but do not replace visual inspection.

The [metadata source](https://github.com/ab-orbit/ab-markdow-editor/blob/ed7c81bf46430e45ba380be76040250fda3a9586/docs/app-store/submission-20261106/localizations.json) includes name, subtitle, description, promotional text, keywords, What's New and support/marketing URLs per locale. Actual blockers included missing **German description, keywords and support URL**, plus **English support URL**. Read detailed locale errors before diagnosing Apple's infrastructure from a generic summary.

Public policies used `https://scriba.aeonbridge.app/privacy/<locale>.html`; `/privacy.html` retained Portuguese navigation. Tools were `scripts/build-privacy-pages.mjs` and `scripts/check-privacy-pages.mjs`, with `PRIVACY_ORIGIN` selecting the checked host. Recheck live HTTP availability, language and factual content. Native privacy manifests, App Privacy labels, public policies and the optional privacy-choice URL are different records. Saved locale edits required a reload to clear one stale missing-English banner.

The recorded builds had an offline core without a Scriba account and optional GitHub repository authorization. Their business-model notes described a free version without purchases. Recheck those facts against the future selected binary instead of copying old claims.

## Localized media and Custom Product Pages

Five selected scenes were **reading, writing, outline, diagrams and whiteboard**. The library scene was captured for QA and excluded from the final store selection.

| Historical device slot | Native PNG screenshot | Prepared MP4 App Preview |
| --- | --- | --- |
| iPhone with Dynamic Island, medium | 1206 × 2622 | 886 × 1920 |
| iPhone Duo, outer display | 1398 × 2034 | 886 × 1920 |
| iPad 13-inch | 2064 × 2752 | 1200 × 1600 |

Each of four locales received **five PNGs and one MP4 in each of three slots**: **60 unique screenshots, 12 App Previews and 12 separate GIFs**. These are recorded release sizes/counts, not universal requirements. Duo was populated independently; ordinary iPhone assets did not fill its slot.

The default page's localized listings were separate from four **Custom Product Pages**: Scriba PT-BR, EN-US, DE-DE and FR-FR. EN/DE/FR CPPs explicitly populated **primary pt-BR plus target locale**, across all three device slots. The PT page used pt-BR. Maintain a **page × locale × device** matrix to expose inherited primary-language assets and empty device slots.

Captures came from the actual bundled app in isolated simulators with fictional translated notes. Preserve application pixels. Header/search creative exports were separate from native screenshots. An unrelated App Clip warning did not justify creating an App Clip target.

### Capture and preparation recipes

The [capture orchestrator](https://github.com/ab-orbit/ab-markdow-editor/blob/ed7c81bf46430e45ba380be76040250fda3a9586/scripts/capture-appstore-media.mjs) accepts `iphone-medium`, `iphone-duo` or `ipad-13` and refuses simulators unless named `Scriba Store …` or `Scriba PDF Review …`. `SCRIBA_MEDIA_LOCALE` optionally restricts capture to one locale. It captures native pixels/recordings and writes a manifest; it performs no upload.

```sh
SCRIBA_MEDIA_DERIVED=/absolute/isolated-derived-data \
SCRIBA_MEDIA_OUTPUT=/absolute/native-captures \
node scripts/capture-appstore-media.mjs DEVICE_UDID iphone-duo

uv run --script scripts/prepare-appstore-media.py iphone-duo \
  --source /absolute/native-captures --output /absolute/prepared-media \
  --ffmpeg /absolute/ffmpeg --ffprobe /absolute/ffprobe
```

The [preparation script](https://github.com/ab-orbit/ab-markdow-editor/blob/ed7c81bf46430e45ba380be76040250fda3a9586/scripts/prepare-appstore-media.py) checks dimensions/opacity, removes only entirely opaque alpha, preserves aspect ratio through padding and generates separate GIFs/MP4s. The recorded accepted previews were **20 seconds, 30 fps, H.264 High level 4.0, silent stereo AAC**, with a final real frame held to reach the chosen duration. Probe the **encoded output**: an earlier simulator container appeared long enough, but decoded below 15 seconds and Apple rejected it.

### Processing and replacement pitfalls

Filename/count audits initially showed all expected media but did **not** prove processing completion. Apple still blocked review for uploading/processing assets. Completed media exposed edit/reorder/removal controls in the observed UI, and final **Add for Review** validation established readiness. Reopen/reload and inspect processing state rather than treating attachment presence as completion.

Replacing one asset after layout reflow removed its neighboring outline image. Refresh UI state and identify the actual asset; replacing the complete affected ordered set restored all five scenes. Stale large-iPhone associations were removed while originals remained in Asset Library. Do not permanently delete source files merely to clear fallback or a legacy device slot.

Source: [November media, CPP and processing record](https://github.com/ab-orbit/ab-markdow-editor/blob/ed7c81bf46430e45ba380be76040250fda3a9586/docs/app-store/submission-20261106/README.md).

## Physical evidence and honest testing limits

Apple's actual Guideline 2.1 request required supported **physical-device** QA and a recording beginning at launch; simulators could not satisfy it. The owner supplied physical-iPhone footage. Preserve originals; a separate copy removed only introductory device identifiers while retaining Home Screen launch and the continuous workflow. That reviewer-only video was not published as marketing material. AVFoundation worked when ffprobe could not load a Homebrew dylib, avoiding a system-package repair.

Wait for attachment processing, verify the **sent reply** includes the recording, update **App Review Information Notes** when requested, and separately use **Resubmit to App Review**. A saved draft, processed attachment or cleared metadata errors did not establish resubmission. Build 27 reached historical **Waiting for Review** only after those steps.

The [build 29 record](https://github.com/ab-orbit/ab-markdow-editor/blob/ed7c81bf46430e45ba380be76040250fda3a9586/docs/app-store/submission-20261028/README.md) distinguishes real simulator posture/keyboard testing from physical QA and discloses untested active inner-camera/cross-app Split View behavior. The older recording did not establish physical testing of build 29 or 31. Do not infer an exact build, complete physical coverage or latest-OS compliance from footage that does not establish it.

For build 31, a broad native run had four older UI scenarios fail with six assertions. A subsequent selected run passed **12 tests, 0 failures, 1 manual-capture-session skip**; the JavaScript suite then passed **101 tests**. Report scoped successes and earlier coverage limits rather than claiming every UI test passed.

## Final historical five-item submission

The [receipt](https://github.com/ab-orbit/ab-markdow-editor/blob/ed7c81bf46430e45ba380be76040250fda3a9586/docs/app-store/submission-20261106/review-submission.json) recorded **“5 Items Submitted”** at `2026-11-07T03:53:42Z`: iOS **1.17.2 (31)** plus four Custom Product Pages. Submission ID: `525b3c94-9a54-4b88-b19b-a214bf897077`. Public release remained **manual**. This proves the historical submission, not subsequent approval or public availability.

Reopen the [Apple submission](https://appstoreconnect.apple.com/apps/6824664840/distribution/reviewsubmissions/details/525b3c94-9a54-4b88-b19b-a214bf897077) within the user's authorized store workflow to verify current state. Do not persist real tester identities, passwords, verification codes, tax identifiers, private contacts, trader documents or reviewer-only recordings in this reusable skill.
