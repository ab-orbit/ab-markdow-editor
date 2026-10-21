# Response preparation — Guideline 2.1

Status reported by the owner on 20 October 2026: iOS version 1.13.0 (1) rejected, with a request for information and a physical-device screen recording. This message does not establish the current external TestFlight or DSA status.

Do not send this draft until the recording and physical-device QA are complete. Match the recording, the build selected in App Store Connect and these instructions. The public website deployment does not update the submitted iOS binary.

## Recording and QA still required

Use a physical supported iPhone or iPad running the latest public operating system, as requested by App Review. Record the actual submitted build, starting with launching Scriba from its icon. Record device model, OS version and app version/build in the review notes. Do not describe simulator tests as physical-device tests.

Demonstrate opening a bundled reference note; creating and editing a note; saving and reopening; a diagram and drawing; native Files folder selection and saving; native export/share; and offline use. If demonstrating optional GitHub, show its authorization and disconnection without exposing credentials or tokens. There is no Scriba account registration/deletion or paid-content flow to demonstrate. Confirm these statements against the selected build before sending.

If replacing 1.13.0 (1) with a newer build, test and record that replacement and update all version references. Do not demonstrate new web-only behavior as if it were already in 1.13.0.

## Draft for the App Review reply and App Review Information notes

Hello App Review Team,

Thank you for your message. Please find the requested information below.

1. Physical-device demonstration

[ATTACH THE RECORDING BEFORE SENDING. Add the physical device model, exact OS version, app version/build and attachment filename here. Describe only the testing actually completed.]

2. Purpose and audience

Scriba is a general-purpose Markdown note editor for individuals, including students, writers, researchers and professionals. It helps users write and organize notes, represent ideas with diagrams and drawings, and keep portable Markdown files. It supports private on-device use and offline editing. It is available to the general public and is not restricted to a particular company or its employees.

3. Access and main features

No Scriba account, registration, subscription or purchase is required. Launch the app and open the included pinned reference notes for examples. Create a note to edit Markdown, headings, lists and tables. Use the diagram examples and drawing editor to explore visual content. In Settings, the Files folder selector grants access to a user-selected directory through the native iOS picker. Export opens the native share sheet, including Save to Files. No external sample files or credentials are needed for the core offline editor.

GitHub synchronization is optional and requires an existing GitHub account and a repository the reviewer is authorized to access. It is a client integration with the user's repository, not account creation for Scriba. The app does not create Scriba user accounts. [If review access to this integration requires a dedicated test setup, provide it in the private review fields before sending.]

Notes and drawings are user-authored private documents. Scriba does not operate an in-app public feed, user-profile directory, messaging service or community publishing system. Users control their own files and any repository destination they choose.

4. External services and tools

The editor and diagram/drawing libraries are bundled with the app, including Capacitor, CodeMirror, TipTap, Mermaid, Beautiful Mermaid, Pele, ZenUML and Excalidraw. Core editing and rendering do not require a remote service. Optional GitHub authorization and repository synchronization use GitHub and the Scriba HTTPS synchronization gateway hosted on our server, with Cloudflare providing network infrastructure. Native Files access uses Apple's document picker and the storage provider selected by the user. Scriba does not use an AI service, payment processor or advertising service for its core functionality.

5. Regional availability

The app's features and included content are consistent across regions. Optional GitHub and third-party Files providers depend on those services' availability and the user's permissions. There are no region-specific paid features or content catalogs.

6. Regulated services and third-party content

Scriba is a general-purpose productivity editor and does not provide regulated financial, medical or other professional services. It does not distribute a third-party media catalog. Users import and manage their own documents and images. The bundled third-party software components are identified above. [Confirm distribution-license compliance and provide any applicable notices or authorization if requested; do not claim additional rights or certifications that have not been verified.]

Please let us know if any further access instructions or clarification would assist your review.
