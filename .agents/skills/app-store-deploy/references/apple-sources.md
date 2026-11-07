# Apple publication requirements and verified sources

Verified against public Apple documentation on **2026-11-07**. No authenticated account state was inspected for this audit.

**Recheck live documentation before every release.** The dimensions, names, SDK deadlines, limits, and statuses below are a dated reference, not permanent platform contracts. Discover current App Store Connect device slots and API display-type values; never derive an API enum from a marketing device name.

“Apple requirement” below denotes a documented platform rule. “Workflow quality” denotes a stricter project acceptance recommendation derived from the Scriba publication failures.

## Screenshots and device slots

**Apple requirements, as verified on the date above:** 1–10 screenshots per device size; JPEG/JPG/PNG; no transparency or alpha channel. Current required slots include iPhone with Dynamic Island (medium display), and iPad 13-inch when supporting iPadOS. Landscape dimensions reverse the portrait values below.

| Device slot | Accepted portrait pixels |
|---|---|
| iPhone with Dynamic Island, medium display | 1179 × 2556 or 1206 × 2622 |
| iPad 13-inch | 2064 × 2752 or 2048 × 2732 |
| iPhone Duo outer display | 1398 × 2034 |
| iPhone Duo inner display | 2007 × 2853 |

Apple states that **starting April 2027, Duo screenshots are required for apps using the iOS 27.1 SDK or later**. Do not make this condition universal or retroactive. The corresponding App Store Connect API display-type enums were **not verified**; do not invent names such as `APP_IPHONE_DUO`.

**Workflow quality:** the project may require more than Apple's one-image minimum, demonstrating distinct useful tasks. Define that target in the release plan; do not misrepresent it as Apple's minimum. Validate decoded pixel dimensions and image alpha/opacity locally before upload, and visually inspect each native aspect ratio.

Source: [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications).

## App previews and GIFs

**Apple requirements:** previews accept H.264 in MOV/M4V/MP4, or ProRes 422 HQ in MOV; duration 15–30 seconds, maximum 500 MB and 30 fps. Up to three previews per supported device size/language. GIF is not an accepted App Preview format. Processing may take up to 24 hours. Without a localized preview, Apple may display the next-best language.

The current Duo preview entry accepts **886 × 1920 portrait / 1920 × 886 landscape**, independently of the Duo screenshot resolutions above. Do not assume native screenshot dimensions are valid movie upload dimensions.

**Workflow quality:** inspect actual decoded media tracks, frame dimensions and duration with a media probe; file extension, editing-timeline length and container metadata alone are insufficient evidence. Keep requested GIFs as separate marketing artifacts and create accepted movies for App Store previews. Recompose captures without stretching or disguising the actual app experience.

Source: [App preview specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/app-preview-specifications).

## Localization and fallback

**Apple behavior:** adding a listing language initially copies primary-language screenshots and properties, except description and keywords. Store metadata localization is separate from app UI localization in Xcode. Names and privacy-policy URLs have localized fields and require Save.

**Workflow quality:** verify both app chrome and sample-document language before capturing. Track every requested locale × device slot × orientation × destination, including default listing and each requested Custom Product Page. A locale dropdown, inherited media, scaled assets or “Using Existing Assets” is not proof of locale-correct screenshots. Explicitly replace copied media, expand thumbnails to inspect language, save and reload. Do not interpret fallback as completed localization.

Source: [Localize app information](https://developer.apple.com/help/app-store-connect/manage-app-information/localize-app-information/).

## Default listing versus Custom Product Pages

**Apple behavior:** localized default listings and Custom Product Pages (CPPs) are separate resources. CPPs have their own reference names, URLs, localizations, media and review states. Starting from an existing listing copies its primary localization. CPPs normally appear through their unique links or configured search keywords; other visits show the default listing. Creating default localizations does not create CPPs, and Apple does not require one CPP per language.

**Documentation inconsistency:** the configuration guide says CPP creation requires Ready for Distribution in at least one territory, while the submission guide describes submitting a CPP with an unapproved first app version. Check live account/UI eligibility rather than claiming either path is always available.

**Workflow quality:** resolve the requested deliverable explicitly; when CPPs were requested, record their actual IDs, names, locale coverage, URLs and statuses. A populated default listing does not fulfill that request.

Sources: [Configure multiple product page versions](https://developer.apple.com/help/app-store-connect/create-custom-product-pages/configure-multiple-product-page-versions), [Submit a custom product page](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-a-custom-product-page/).

## Uploaded, assigned, processed and submitted are distinct

**Apple behavior:** Asset Library permits uploading and reviewing media independently of an app version. Media Manager controls device/localization placements. Product Page Information controls media scoped to the version, CPP or optimization treatment. The standard preview/screenshot workflow lists these editable version states: Prepare for Submission, Invalid Binary, Rejected, Metadata Rejected and Developer Rejected. Pending Developer Release is not in that list.

**Workflow quality:** library presence is not placement evidence. Verify the expected locale/device destination, completed processing, final order and persistent visible thumbnails after reload. Record missing, inherited and rejected assets separately. Never report “published screenshots” from upload completion alone.

Source: [Manage your App Store assets](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-your-app-store-assets).

## Review states and manual release

**Apple behavior:** CPP Add for Review reaches Ready for Review; Submit for Review reaches Waiting for Review. Already-approved apps may submit CPPs with or without an app version. CPP screenshots, previews, promotional text and keywords are locked during review. Verify app-version and CPP items separately; adding an item does not submit it.

Removing a submission or pending release returns the app to Developer Rejected and restarts review on resubmission; other included items may also be removed. Preserve this consequence in the release record. Pending Developer Release means accepted but awaiting an explicit release action, separately for each platform.

**Workflow quality:** retain the user's selected manual/automatic release policy. Authorization to submit for review does not itself authorize changing that policy or clicking Release This Version. Inspect current edit locks and use the least disruptive supported correction path within the authorized scope.

Sources: [Submit a CPP](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-a-custom-product-page/), [Remove a submission](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/remove-a-submission-from-review/), [Release options](https://developer.apple.com/help/app-store-connect/manage-your-apps-availability/select-an-app-store-version-release-option), [App and submission statuses](https://developer.apple.com/help/app-store-connect/reference/app-information/app-and-submission-statuses/).

## TestFlight eligibility and minimum privilege

**Apple requirements:** internal testers are App Store Connect users with app access and an eligible role: Account Holder, Admin, App Manager, Developer or Marketing; up to 100. Internal groups need an assigned eligible build; Xcode Cloud builds require manual assignment. Builds marked TestFlight Internal Only cannot be distributed externally or submitted to customers. Builds expire after 90 days.

External testers use a separate group/build flow and any required Beta App Review. The first build requires full review; subsequent builds of that version may not. Do not promise immediate external access.

**Workflow quality:** diagnose “No Builds Available” by checking processing, export compliance, eligible build type, group assignment, expiration, review approval and accepted invitation/account. Supplying an email is not sufficient. Prefer external testing for people who do not need account access. Do not grant App Store Connect roles or broader app access merely to bypass external review without explicit authorization.

Sources: [Add internal testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers/), [Invite external testers](https://developer.apple.com/help/app-store-connect/test-a-beta-version/invite-external-testers/).

## Three separate privacy layers

**Apple requirements:** a privacy-policy URL is required and can be localized. App Privacy answers are app-level, must cover supported platforms and integrated third parties accurately, and must be published. The documentation does not require a different URL string for each language.

Bundled `PrivacyInfo.xcprivacy` files describe collected data and required-reason APIs. Xcode aggregates manifests to assist preparation of accurate privacy labels; manifests do not replace the App Store Connect questionnaire or policy URL.

**Workflow quality:** verify localized URL fields, public reachability and language-appropriate policy content; save and reload. Audit the binary, third-party SDKs, diagnostics, authentication and backend flows before claiming Data Not Collected. Browser-local notes alone are not evidence about every data practice. Check archive resources and privacy-report output independently of the store labels.

Sources: [Manage app privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy), [Privacy manifest files](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files), [Privacy labels and manifests](https://developer.apple.com/app-store/user-privacy-and-data-use/).

## DSA identity, verification and legal ownership

**Apple requirements:** EU trader disclosures involve public business contact information and verification; Apple may require business/address documentation. The Account Holder accepts legal agreements, including the Paid Apps Agreement for paid apps or In-App Purchases. Agreement acceptance cannot be undone.

**Workflow quality:** use the owner's supplied legal name, business facts, address, phone, email and genuine supporting documents. Explain public disclosure before collecting or changing contact data. Never fabricate verification evidence, infer non-trader status merely because the app is free, or version identity documents, OTPs, credentials or signing secrets. Treat login/2FA handoffs, trader declarations and binding legal acceptance according to the active authorization/tool policy; publishing permission is not blanket authority for unrelated legal or account changes. Record missing owner confirmation precisely without repeating previously granted authorization.

Sources: [EU DSA trader requirements](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/), [Sign and update agreements](https://developer.apple.com/help/app-store-connect/manage-agreements/sign-and-update-agreements).
