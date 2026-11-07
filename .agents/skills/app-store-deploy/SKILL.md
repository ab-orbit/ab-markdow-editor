---
name: app-store-deploy
description: Prepare, upload, localize, troubleshoot and submit Apple App Store or TestFlight releases with verifiable evidence. Use whenever a task mentions App Store Connect, Xcode distribution, App Review or resubmission, No Builds Available, localized store screenshots or App Previews, Custom Product Pages, iPhone Duo/iPad store assets, privacy/trader validation, or preparing an Apple release for approval. Covers complete publication rounds, including metadata-only changes and release-mode verification.
compatibility: macOS and Xcode for native builds; authorized App Store Connect API or UI access for store actions; Python 3.11+ via uv for read-only media audits; ffprobe for encoded preview validation. Discover the available tools and devices before use.
metadata:
  version: "1.0.0"
---

# App Store deployment

Deliver the user's authorized release outcome and record what Apple actually confirms. An upload, TestFlight assignment, review submission, approval and public release are different outcomes. Preserve the existing or explicitly requested release mode unless the user requests a change. Scriba historically uses manual release.

## Establish scope and current facts

1. Read the repository's release instructions and the actual rejection message, if any. Identify whether the requested stopping point is preparation, TestFlight distribution, review submission or public release. Respect an explicit owner hold until their OK. Authorization to submit covers the ordinary submission action; do not add a redundant generic approval step. Follow the active permission policy for legal agreements, credentials and account access changes.
2. Verify `git rev-parse --show-toplevel` and `git remote -v` before Git writes. A source folder inside a parent monorepo may differ from the standalone release checkout.
3. Discover the actual app ID, bundle ID, platform, developer team, version/build, selected Apple build and release mode. A brand or email is not a Team ID. Historical receipts establish past actions, not live account state.
4. Start a private release record from [the template](assets/release-record.template.json). Record source commit, archive fingerprint, selected build, coverage matrix, blockers and final confirmation. Keep private contacts, tester identities, legal documents and credentials outside the public repository.

Load references when needed:

| Work | Read |
| --- | --- |
| Build, signing, upload, TestFlight, rejection or final submission | [Release workflow](references/release-workflow.md) |
| Translations, screenshots, movies, Duo/iPad or Custom Product Pages | [Localization and media](references/localization-and-media.md) |
| Run the local media checker | [Media manifest contract](references/media-manifest.md) |
| Privacy, trader identity, legal or review evidence | [Compliance](references/compliance.md) |
| Verify changing Apple requirements | [Dated official sources](references/apple-sources.md), then current Apple documentation |
| Work specifically on Scriba | [Historical Scriba findings](references/scriba.md) |

## Identify, test and upload the exact binary

Use existing project sync/archive scripts. For a bundled web app, synchronize native assets before archiving. Record the candidate's source commit, version/build, signing team, archive path and fingerprint. Preserve uniquely named archives: a later build must not silently replace the approved candidate. A website deployment or simulator install does not update an archive or an uploaded binary.

For a first publication, follow the reference's membership, bundle registration, native packaging and store-record prerequisites. Verify required capabilities, metadata, age/content answers, pricing/territories and review access for the actual product; a PWA report does not establish App Store readiness.

Reuse a suitable existing binary for metadata-only corrections. If behavior or bundled assets changed, build and test the replacement. State the scope of successful tests and disclose relevant failures/skips; simulator/browser tests do not prove physical-device behavior.

When CLI distribution fails, inspect its failing step. A signed archive and a connected account do not prove CLI account-to-team resolution works. After checking team and account role, Xcode Organizer can distribute the **same archive**. Avoid identical retries without new evidence. Use supported credentials; never extract Keychain secrets, cookies or account tokens into scripts or logs.

Choose **App Store Connect** distribution for a review candidate, rather than **TestFlight Internal Only**. Verify upload success, Apple processing, export compliance and eligibility. Then inspect the app version's selected build separately from TestFlight group assignment. Do not leave an older selected build merely because the desired binary uploaded successfully.

## Prepare complete localized product pages

Maintain an explicit **page × locale × device × media-kind** matrix. The default page's localizations, Custom Product Pages (CPPs) and public website pages are different deliverables. Resolve an ambiguous request for “product pages” early while continuing independent preparation. Do not create public website pages when the user wants only App Store listings.

Read the current primary locale, enabled locales and device slots. A new localization or CPP may inherit primary-language media. Populate every requested tuple explicitly, including the primary locale on a CPP when required by its configuration. Check both the default listing and each requested CPP; translating one does not populate the other.

Discover current device requirements in Apple's specifications and the actual account. A local slot key is not an Apple API enum. Include Duo outer/inner displays when required by the current SDK, account and task. The reference contains dated dimensions and the April 2027 deadline; recheck before use. Ordinary iPhone images do not establish Duo coverage.

Use genuine app captures from isolated simulators/devices and fictional localized documents. Check **application controls and document content** in every language. Preserve the user's notes, browser profiles and working simulators. Native device captures, creative header/search artwork and reviewer-only physical footage serve different purposes.

For Scriba, the historical quality target was five distinct scenes—reading, writing, outline, diagrams and whiteboard—plus one App Preview for each locale/device, across four locales and three device slots. That is a project target, not Apple's universal minimum. Keep counts and scene choices configurable for another product.

Prepare GIFs as separate marketing deliverables when requested. App Previews require Apple's accepted movie formats. Probe the **encoded output**, including decoded frame duration, dimensions, frame rate, codec and size. A nominal 20-second container can contain less than 15 seconds of usable frames. Target a comfortable duration such as 20 seconds, then verify it. If ffprobe is unavailable, use a supported native media inspector or report the unverified requirement; do not mark it checked.

Run the bundled read-only checker after completing genuine visual inspection:

```sh
uv run --script scripts/audit_media.py /absolute/media-matrix.json \
  --phase local --asset-root /absolute/prepared-media \
  --ffprobe /absolute/ffprobe --output /absolute/local-audit.json
```

Resolve script paths relative to this skill directory. The checker validates file/evidence declarations; it does not recognize screen language, authenticate with Apple, upload media or prove approval. Do not turn evidence flags on to silence failures without the corresponding inspection.

## Upload, associate, process and read back

For each matrix entry: upload, associate with the correct page/locale/device, establish order, wait for processing, save, then reload or issue a fresh supported API read. Inspect the actual displayed images/video, identifiers, status and placement.

Filename prefixes, upload-library presence, matching counts or a local `ok: true` do not establish completed processing or correct placement. Inspect “Using Existing Assets” for unintended fallback. Keep original library files when removing stale page associations. After UI reflow, refresh state and identify the actual asset rather than removing by a stale index; re-audit the complete affected ordered set.

Record the readback evidence and run:

```sh
uv run --script scripts/audit_media.py /absolute/media-matrix.json \
  --phase readback --asset-root /absolute/prepared-media \
  --ffprobe /absolute/ffprobe --output /absolute/store-readback-audit.json
```

If a version is **Pending Developer Release** or otherwise locked, prepare and validate replacement material before resolving the required state transition. Explain the effect of cancellation and check whether existing authorization covers it. Ask only for a missing decision. Do not release an older version to unlock media editing. Treat version edits and independently eligible CPP changes according to their actual states.

## Validate metadata, privacy and tester access

Check every enabled locale's actual saved description, keywords, support/privacy URLs and required fields. A generic validation banner can hide one locale's missing field. Save and reload; confirm field values and persisted state rather than only a click or stale banner. Keep metadata truthful for the selected binary.

Verify public policy pages return useful content without login. Apple privacy-policy URLs, published App Privacy answers and the native privacy manifest are three separate records. Translate verified practices; do not infer “no data collected” from a local-first description. Trader information must come from owner-provided business facts. Do not persist verification codes or legal evidence in the reusable skill.

For **No Builds Available**, inspect the exact build/group: processing, compliance, expiration, distribution type, beta review, group assignment and tester eligibility. An email address alone is not internal tester membership. Do not require the person to replace their device Apple Account or grant broad App Store Connect roles just to bypass external beta review. Follow the least privilege access change actually authorized.

## Satisfy review and verify the terminal state

Read Apple's actual request. If it requires physical-device footage beginning at launch, a simulator movie or GIF cannot satisfy it. Preserve original owner-supplied footage; make any privacy edit in a separate copy and describe it without changing the demonstrated workflow. Ask for the missing artifact/device facts while completing independent work. Do not invent evidence about the exact build or OS.

Wait for reviewer attachment processing and verify the **sent** reply contains the file. Update App Review Information Notes when requested. A saved draft, sent response, processed attachment or cleared validation error is not final resubmission.

Verify the selected binary and complete requested review items, including CPPs. **Add for Review → Ready for Review → Submit to App Review** are separate steps. Capture the final confirmation, observed item count/status, submission ID/URL and timestamp. Reopen to verify persistence. Report only the outcome observed: “submitted” does not mean “approved,” “released” or “available to every tester.”

Finish with the exact version/build, submitted items/locales/devices, release mode, evidence location and any concrete blocker. Commit reusable non-sensitive documentation to the verified project checkout when requested; keep private release evidence in its designated private location.
