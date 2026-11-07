# Release workflow and state verification

Read current Apple documentation through [the source index](apple-sources.md). Its dated limits are a starting point. Use authorized APIs, project CLIs and the available UI tools; discover their capabilities before choosing a path.

## Scope, identity and source

Record the requested stopping point: prepare, distribute to TestFlight, submit to App Review or release publicly. Preserve an owner's explicit hold. Submission authorization covers ordinary submission work; new legal acceptance or account-access changes follow the active permission policy rather than an invented blanket gate.

Verify Git root and remote before mutations. Identify app, bundle, platform, version/build, archive, source commit and developer team from the project, signed archive and account. Brand, store publisher and signing team may have different names. Do not infer identity from an email address or reuse the reference application's IDs for another product.

For metadata-only work, inspect whether the selected binary remains suitable. A new build adds processing and review risk without fixing missing screenshots or translations. For changed application behavior, sync bundled assets, test the relevant behavior and archive a replacement with an unused build number. Preserve named candidates and their fingerprints before reusing a script's static output path.

Document what tests actually covered. Physical Files providers, camera behavior and supported real-device postures are not established by browser screenshots. Preserve relevant failures and skips alongside scoped successes. Do not clear real libraries, reinstall working user apps or reset simulators containing personal data to manufacture a clean demonstration.

## First-publication prerequisites

If the app has no store record yet, verify the authorized Apple Developer membership, supported distribution account, registered bundle identifier and required capabilities. Inspect the native project, deployment target, supported device families/orientations, app icon, launch behavior, entitlements and signing/provisioning configuration. Create the necessary record using the actual platform, primary language, bundle ID and SKU through supported tools and authorized account access.

Verify name/category, age-rating answers, content rights, copyright, pricing, territories/availability, review contact, support/policy URLs and any reviewer access needed for the actual feature set. Do not assume another product's free business model, contacts, account requirements or encryption declarations. Keep demo credentials and private contacts in their designated private fields/files. Check export compliance for the actual encryption use, including bundled third-party code.

For a web-derived native app, assess useful native/offline behavior and the actual review requirements rather than relying on a PWA score. A PWABuilder report, service-worker registration or browser installation does not constitute an App Store package or Apple approval. Use the project's supported native packaging path and verify that the archive contains the intended application assets.

For an update, inspect the existing app/version state first. Reuse an editable appropriate version or create the needed new version according to the supported store workflow. Do not overwrite a reviewed candidate, silently change the release policy or rebuild solely to fix editable listing metadata.

## Upload diagnosis

1. Confirm the archive's actual identity, distribution signature, team and intended account role.
2. Read the precise failing export/upload step. Separate signing, network, authorization, account-to-team resolution and Apple processing errors.
3. A connected Xcode account and a signed archive do not prove command-line distribution can resolve that team. If the account is appropriate, try the same archive through **Organizer → Distribute App → App Store Connect**. Do not rebuild or bump the number just to switch upload interfaces.
4. Use supported authentication. Do not inspect browser cookies, export private Xcode account storage or copy Keychain credentials into automation. A login required by the platform is completed through its supported flow.
5. Avoid repeated identical retries without a changed condition or diagnostic purpose. Preserve the concise error and next concrete action.

Select App Store Connect distribution for a review candidate. A TestFlight Internal Only build cannot become an external beta/customer release merely by adding someone to a group. Wait for Apple processing and any required export-compliance answers. Then verify that the intended Apple build ID is selected on the intended app version.

## Observe each transition separately

| Observation | What it establishes | Still unproven |
| --- | --- | --- |
| Signed archive exists | A candidate was archived and signed | Upload, processing or distribution |
| Organizer/upload API confirms success | Apple received a binary | Processing, eligibility or selected version |
| Processing complete, compliance satisfied | Build may be eligible for its distribution type | Version selection or tester access |
| App version selects the desired build ID | Official review item points at that binary | TestFlight group assignment or submission |
| Intended TestFlight group shows Testing | That group has an eligible assigned build | Public App Store approval or every tester's installation |
| Add for Review / Ready for Review | Item is prepared for a submission | Final submission |
| Final confirmation and Waiting for Review | Listed items were submitted at the recorded time | Approval or public release |
| Pending Developer Release | Approved version awaits the developer's release action | Public availability |
| Verified storefront availability | Version is available in the inspected storefront | Availability in every territory or device |

Use current UI/API status names rather than treating this table as an immutable enum. Record observation time and selected IDs. Reopen a saved item or use a fresh supported GET to distinguish persistence from stale UI state.

## Diagnose No Builds Available

Inspect the tester's intended group and exact build, rather than only the email list:

- Has Apple finished processing? Are compliance or build validations outstanding?
- Is the build expired, removed from testing or restricted to internal testing?
- Is that build assigned to the intended group? Does it show Testing there?
- For external distribution, are test information and the necessary Beta App Review complete?
- Is an internal tester an eligible App Store Connect user with appropriate app access? An arbitrary email or external invitation is not internal membership.

Keep the person's existing device Apple Account. Do not advise a phone-account change as a substitute for correct distribution. An internal invitation can require new access rights: use only authorized roles and the minimum app access necessary. Do not grant Admin merely to avoid external review. Record invitations and actual build availability as separate outcomes.

## Respond to a rejection

Read the actual guideline message and requested evidence. If it asks for physical-device testing and continuous footage from launch on a supported OS, obtain real footage and the missing device/build facts. Simulator movies, GIFs and unsupported claims do not satisfy that request. Complete independent metadata/media work while the missing artifact is obtained.

Preserve the original owner recording. If unnecessary personal identifiers appear before launch, prepare a separate privacy-reviewed copy while retaining the required launch and continuous demonstrated workflow. Document the edit. Do not infer an exact version/build or latest-OS compliance from footage that does not show it. Reviewer-only footage is not a public marketing asset.

Wait for attachment processing. Verify the **sent** message contains the intended file, and update App Review Information Notes when requested. A saved draft, Continue Draft, Reply, Update Review and final Resubmit can be different steps. Resolve detailed validation errors across all locales, then perform the authorized final submission. Record its confirmation and resulting status.

## Submit the complete requested set

List expected items before the final action: app version plus each requested CPP, or a CPP-only submission if eligible. Check current account eligibility; Apple's CPP documentation has described both distribution prerequisites and first-version combined submissions, so inspect the actual supported flow instead of inventing eligibility.

Verify all required assets have finished processing, all localized metadata persists, the selected build matches the intended candidate and the existing/requested release mode is preserved. Add for Review is preparation. Submit to App Review is the submission action. Compare the final item count and identities with the expected list; submitting one app version does not prove four CPPs were included.

If the version is locked, prepare and validate the replacement package before asking for any remaining state-transition decision. Explain whether removing the submission will affect other items, return it to Developer Rejected or restart review. Use existing authorization when it covers the action. Do not press Release This Version to unlock editing of an older approved candidate.

Finish with the observed state, timestamp, version/build, submission ID/URL, item list/count, release mode and precise blockers. A historical receipt remains useful evidence, but cannot answer what is in the account today.
