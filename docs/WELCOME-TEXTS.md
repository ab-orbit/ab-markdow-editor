# Localized welcome notes

Four independent Markdown files live in `docs/welcome-texts/`, selected by `server/welcome-texts.json`. Portuguese, English, German and French use the same application-language policy as resource notes: explicit preference, otherwise device language, with English fallback. Each welcome names the matching resource file from `server/reference-texts.json`.

The artwork is byte-for-byte the existing Egyptian scribe image. Every welcome uses the portable relative path `assets/boas-vindas.jpg`. Icons use bundled Lucide vectors through the editor's existing `data-lucide` syntax; there are no emoji or external image/icon requests.

Editorial scope: a short invitation to write, automatic saving, eight primary feature groups, an invitation to explore the localized resource note, storage choices and practical backup guidance. Do not promise PDF import, Google Drive, backlinks, tags, background execution or any other unavailable feature.

On the first launch, with no existing draft or explicit Finder document, the current-language welcome opens in reading mode; its pin is retained and the mobile sidebar stays closed. Later launches restore the user’s working document, including after an application update.

The browser/native library and local Git backend seed each welcome once per destination and locale. Files remain editable normal notes. Persisted markers respect later edits, deletion and unpinning. Name/image collisions preserve user files. Local Git stores the actual resource path in the welcome when collision handling moved or renamed the resource. Device-folder mirroring follows the existing reference-note behavior.

Legacy clients retain their existing initialization contract. Existing legacy welcome notes are not destructively replaced. New current-language clients receive the authored welcome alongside the authored resource note.

Validation: `node --test tests/reference-texts.test.mjs` covers exact artwork, local HTTP initialization, collision handling and user ownership; `node tests/reference-texts.smoke.mjs` (also `MARKDOWN_BROWSER=webkit`) covers rendered notes/icons/images, language switching, English fallback and mobile overflow. [Visual evidence](evidence/welcome-texts/README.md).
