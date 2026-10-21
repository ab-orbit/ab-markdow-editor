# PDF import assessment — 21 October 2026

Status: analysis and isolated API probe only. PDF import is not implemented or enabled in this release.

## Proposed flow

Import accepts Markdown and PDF. A PDF selection explains that the selected document will be sent to CALIA (AeonBridge) for conversion and requires an explicit Convert action before upload. Cancellation sends nothing. Existing note content remains intact until conversion succeeds. The existing feather status covers upload/conversion without claiming a fabricated percentage. The returned Markdown becomes a separate automatically saved `.md` note with collision-safe naming; the source PDF remains unchanged. Conversion may change tables, mathematical notation and images, so the interface must not promise exact PDF layout preservation. Offline Markdown import stays available; PDF conversion reports that a connection is required.

The gateway calls the fixed CALIA endpoint `/api/convert/to-markdown?include_raw=false&redact=none`, sends multipart `file` and empty `url`, and validates HTTP status plus the response envelope, `data.success`, and nonempty `data.cleaned_text`. Do not render the JSON or globally replace escaped newlines. Treat converted text as untrusted, using the existing sanitized Markdown renderer. `redact=none` controls returned sentence removal; it is not anonymization, a retention guarantee, or permission to upload personal data. `include_raw=false` reduces the returned payload; it does not mean the PDF was never sent or retained.

An isolated synthetic one-page PDF was sent using `CALIA_API_TOKEN` loaded from the parent repository's ignored `.env`. HTTP 200 in approximately 0.26 seconds, `metadata.function=convert_to_markdown`, `data.success=true`, `data.source=file`, and 73 characters in `cleaned_text`, including the synthetic marker. The original book PDF was not available in Downloads; this is not a large/scanned PDF benchmark. No private book content or credentials are included in this document or release.

The current public OpenAPI describes text PDFs using anydoc and a fallback to markitdown/OCR. This does not establish whether OCR or any other step sends documents to another provider. Retention, logs, backups, processing region, model training, subprocessors and deletion need confirmation from the service implementation/operator before release. Do not promise “no AI”, “no storage” or “no training” based on the response alone.

## Secret and gateway

Recommended architecture: app → HTTPS Scriba conversion gateway → CALIA. The shared service key belongs in a server secret store, or a restricted environment file outside `/var/www/scriba/current` and all static releases (for example `/etc/scriba-conversion.env`, readable only by the service operator). Inject it at runtime and restrict the CALIA credential to conversion, quotas and rotation where supported. Never put it in `VITE_*`, JavaScript, the IPA, Info.plist, source control, localStorage, IndexedDB, export archives, or logs. A build-time `.env` is not a protected client-side vault.

Keychain is appropriate for per-user/session credentials in the native app, not for distributing a universal provider secret to every installation. Web sessions should use an appropriately scoped secure authentication mechanism; no shared permanent token in the frontend. A gateway still needs authentication or short-lived capability verification, per-client quotas, rate/concurrency/size limits, abuse controls and global spending ceilings. CORS and an embedded application token are not authentication. App Attest can strengthen native request verification on supported devices, with a separately designed fallback; it does not cover the browser population or replace quotas.

Scriba's current deployment is static with an isolated GitHub gateway. `/api/*` currently returns 404 and CSP permits only same-origin connections. A dedicated service and fixed conversion route are required; adding a Vite fetch alone will not work safely. Avoid accepting arbitrary upstream URLs or forwarding caller Authorization headers. Upload only the explicitly selected file, never the whole library. Temporary uploads need bounded lifetime and cleanup on success/failure; content and bearer headers must be excluded from logs and caches. Synchronous conversions need timeout/cancel behavior; a client cancellation does not prove CALIA stopped processing. Long conversions should use a confirmed job/status contract rather than automatic repeated uploads.

## Apple review assessment

There is no general prohibition on an app using an external HTTPS conversion API. Compliance depends on the data flow and business model; this assessment is not a guarantee of review approval.

- Guideline 5.1.1 requires an accessible, accurate privacy policy covering data, recipients and retention/deletion.
- Guideline 5.1.2 requires permission before transmitting personal data and explicitly calls out third-party AI. Because an arbitrary PDF can contain personal data, a clear pre-upload disclosure/confirmation is the recommended flow. Identify CALIA/AeonBridge and any actual downstream provider. Do not silently upload as a side effect of selecting a file.
- App Privacy answers must be reevaluated against actual retention. Apple's definition of collection excludes strictly real-time servicing without longer access, but that exemption cannot be assumed while logging/retention remains unverified. Retained document contents may require User Content disclosure; account linkage and other metadata depend on the final implementation. Privacy labels do not replace permission or the privacy policy.
- If conversions are sold as in-app digital functionality/credits, evaluate 3.1.1 and applicable storefront exceptions before introducing payment. Calling a free backend does not itself require IAP.
- Give App Review working service access and explicit test instructions. No conversion feature should be submitted hidden, unavailable, or dependent on an undisclosed customer key.

References checked on 21 October 2026:
- [App Review Guidelines, especially 5.1.1, 5.1.2 and 3.1.1](https://developer.apple.com/app-store/review/guidelines/)
- [App Privacy Details and definition of collection](https://developer.apple.com/app-store/app-privacy-details/)
- [Keychain for user secrets](https://developer.apple.com/documentation/security/using-the-keychain-to-manage-user-secrets)
- [Validating apps connecting to a server](https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server)
- [CALIA API contract](https://aeonbridge.io/calia/openapi.json)

## Recommendation before implementation

Proceed with the gateway architecture and an explicit PDF conversion action after agreeing the service's actual retention/subprocessor policy and access/quota strategy. Preserve local-only Markdown workflows. A per-user key option could use native Keychain, but would introduce credential setup and does not meet the intended transparent import experience. No PDF integration is included in build 14.
