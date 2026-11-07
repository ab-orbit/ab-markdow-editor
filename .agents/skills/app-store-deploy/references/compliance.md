# Privacy, identity and review evidence

Use [current official requirements](apple-sources.md) and the actual selected binary. Record factual answers and their source; do not turn a reusable release skill into a store of personal or authentication data.

## Three separate privacy records

1. **Public policy:** verify the URL resolves over HTTPS without login and contains the actual policy. Apple requires a policy URL; it does not universally require a different URL per language. Supplying readable policy content in each supported listing language is the project's quality target. Never invent retention periods, security guarantees or compliance claims during translation.
2. **App Privacy in App Store Connect:** answer for the actual app, integrated SDKs and backend behavior. Publishing the privacy answers is distinct from saving a localized policy URL. Check the app-level state and all required locale URLs after reload.
3. **Native privacy manifest:** verify required-reason API use and bundled declarations match the implementation. A manifest does not answer the store questionnaire or publish the public policy.

The optional User Privacy Choices URL needs a real matching user-facing function; do not populate it simply to silence a warning. A local-first product can still have optional synchronization, diagnostics or SDK data practices. Review those facts before asserting Data Not Collected.

## Localized validation

Inspect detailed errors for every enabled locale. Missing description, keywords or a support URL in a secondary language can be hidden behind a generic validation summary. Use an input method supported by the active UI tool; read the actual field value, save, reload and confirm persistence. An unchanged counter or a successful paste event alone is insufficient.

Keep name, subtitle, description, promotional text, keywords, What's New, support/marketing URLs and privacy policy language consistent with the selected release. Verify each current field's availability and limits instead of hardcoding historical character counts.

## Trader and legal identity

Determine trader status from the owner's actual business activity and instructions. Use owner-provided business records for legal name, address and contact details; a product brand can differ from the Apple enrollment entity. Explain which business contact data Apple will expose publicly. Follow current Apple verification steps for email, phone and evidence documents.

Treat verification codes as short-lived input for the active flow, not reusable data. Keep trader documents, tax identifiers, private addresses, real tester identities and reviewer-only videos in the authorized private release location. Never include them in the public skill, examples, evaluation fixtures or logs.

Accept new legal agreements only through the authorized account holder and the active permission policy. Existing authorization for release work is not a reason to extract credentials or invent rights. Conversely, do not block an already authorized ordinary submission with a new generic permission ritual.

## Review notes and device evidence

Describe the actual business model and login behavior. Optional repository authorization may be different from the product's primary account system; inspect the implementation before using that distinction in a guideline response. Do not invent purchases, subscriptions or reviewer credentials.

Use isolated fictional data for public screenshots and promotional movies. A physical-device review request requires evidence from the requested device/OS/workflow; record what it proves and what remains unknown. Preserve originals and document privacy edits in separate copies. The public website and simulator are useful tests, but do not establish the behavior of a previously uploaded native binary.

Reviewer attachments, store App Previews, GIFs and creative headers have different purposes, technical constraints and audiences. Verify their destination before upload. Finish the requested reply/Notes/resubmission sequence and record the terminal state; an attachment waiting for processing is not a completed response.
