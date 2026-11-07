# Localized listings, device media and Custom Product Pages

Check [current Apple specifications](apple-sources.md) before generating assets. Use the following workflow for any product; the historical Scriba counts are examples, not platform minima.

## Define destinations before capture

Separate these deliverables:

| Destination | Scope | Evidence of completion |
| --- | --- | --- |
| Default product page | App version, locale, device and media kind | Correct saved assets visible after reload in each requested tuple |
| Custom Product Page (CPP) | Independent page ID, localizations, device media and review state | Actual CPP IDs/URLs, populated tuples and submitted items |
| Header/search artwork | Creative placements with their own current specifications | Accepted placement and inspected crop |
| Public website | Only when requested separately | Deployed page in the requested language |
| Reviewer attachment | Private review thread, attachment and Notes | Processed file in the sent reply; final resubmission is separate |
| Marketing GIF | Local/delivery artifact outside App Preview slots | Useful playable GIF; it never counts as an App Preview |

Create a matrix with one row per **page × locale × device × kind**. Track orientation explicitly when it is in scope, for example with separate local device-slot keys. Record expected screenshot scenes/count, previews, file/hash, UI language, document language, visual inspection and store readback. The [manifest template](../assets/media-matrix.template.json) is intentionally empty; fill it from actual reviewed files, never fabricated proof.

Read the current primary locale and enabled localizations. Apple may copy primary-language screenshots into a new localization. Selecting English in a dropdown or translating description text does not translate those images. Replacing default-page media does not create or populate CPPs. When one CPP per language is requested, also inspect that page's primary localization; Scriba's English, German and French CPPs needed primary Portuguese plus target-language assets.

Capture only the requested device families and placements, while including currently mandatory slots for the build/SDK. Verify Duo outer and inner requirements independently. Ordinary iPhone and Duo native resolutions differ, and their preview dimensions can differ again. Never invent an API display-type enum from a device's marketing name. Consult the actual supported API/schema or current UI.

## Capture a truthful localized experience

1. Use a disposable, clearly named simulator or a device authorized for capture. Keep personal device data, notes, browser profiles and working simulators intact.
2. Install the intended native build. Record device model, OS, build identity and capture settings. Browser-responsive screenshots alone do not establish the native experience.
3. Select the actual app language and load fictional content translated for that language. Verify menus, buttons, navigation, document titles, paragraphs, tables, diagram labels and whiteboard text. Review system UI where it appears.
4. Use scenes that explain real product value. Scriba used reading, writing, outline, diagrams and whiteboard. Prefer distinct tasks over a larger count of nearly identical screens.
5. Capture native pixels in each aspect ratio and inspect the full image. Avoid resizing one phone capture to impersonate Duo or iPad. Keep the app experience intact; separately label any creative composition.
6. Check readability, safe areas, clipping, keyboard state, blank/error screens, personal data and truthful feature availability. Review every locale; filename prefixes are provenance, not language recognition.

Record genuinely performed visual review. The media checker verifies declarations and file properties, not OCR or semantic translation quality. Identical bytes across distinct locales are suspicious; only explicitly reviewed language-neutral media may be reused. Reusing one correctly localized file between the default page and a CPP in the **same** locale is legitimate.

## Prepare images and movies

Validate screenshots against the current destination's exact dimensions and opacity. The helper supports opaque PNG only, although Apple also accepts documented JPEG variants. Use an appropriate real decoder/validator for other formats instead of renaming extensions. Entirely opaque alpha may be removed losslessly with a suitable image tool; preserve application pixels and recheck the result. The checker itself never edits files.

App Previews are movies, not GIFs. Verify the current accepted container, video codec/profile, dimensions, duration, frame rate, size and audio rules in Apple's source. On 2026-11-07, documented duration was 15–30 seconds, with at most 30 fps, 500 MB and three previews per device/language. These are dated facts, not permanent constants.

Probe the final encoded file, not only the editing timeline. Inspect decoded frames as well as container/stream duration: a nominal long recording can have fewer than 15 seconds of actual frames. A 20-second target leaves margin. Preserve aspect ratio using an appropriate truthful layout/padding, and hold a genuine final frame if necessary. Do not stretch the interface or invent user interaction.

Keep GIFs separate and label them as marketing artifacts. If ffprobe cannot load, use a supported native inspector such as AVFoundation and record the same needed facts; do not repair unrelated global packages as a prerequisite unless necessary and authorized. Unverified properties remain blockers. The bundled audit specifically requires a working ffprobe for movie checks, so a native fallback needs its own recorded validation.

## Place and verify every asset

Upload into the appropriate resource, then associate the asset with the actual page, locale and device. Asset Library presence is not placement. Establish the intended ordered scenes and preview position. Wait for processing and inspect rejected/failed assets explicitly; Apple's processing can outlast the upload itself.

Save, reload or issue a fresh supported API GET, and inspect the actual thumbnails/expanded media in every tuple. Check for inherited assets and “Using Existing Assets” fallback. Record the Apple asset ID, page/locale/device, complete processing state and persistent association, not just filenames or counts. The manifest's store fields are supplied readback evidence, not automatic live verification.

When removing stale media, remove the association needed to clear the wrong slot or fallback; keep original library files unless deletion is truly intended. Refresh UI state before each positional mutation. If layout reflow causes uncertainty, inspect/rebuild the complete affected ordered set rather than trusting an old thumbnail index.

Run both local and readback audits from [the manifest contract](media-manifest.md). Report their limited scope. A successful local file audit cannot establish Apple processing, translation quality, privacy compliance, review eligibility or submission.

## Locked states and complete submissions

Check version and CPP editability separately. Prepare complete replacement assets and translations before resolving a locked state. If cancellation is necessary and not already authorized, present the concrete replacement and explain that removal may affect other submission items and restart review. Never release an older pending version to unlock editing.

Verify each CPP's own status and requested item list. Add for Review is not final submission. An app plus four CPPs should produce five expected review items; compare their identities, not just the count. Preserve the existing/requested release mode and capture the final confirmation. Do not describe pending assets as published or a prepared CPP as reviewed.
