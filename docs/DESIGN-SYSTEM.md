# Scriba interface system

## Design review: application chrome

### Summary

The interface is a quiet writing workspace: warm paper or charcoal, restrained blue commands, system UI typography, and Scriba's illustrated editorial voice in documents. The revision follows Apple's HIG as cross-platform principles for the Capacitor/WKWebView app, public web app and local Mac browser shell. It does not claim to replace those shells with AppKit/SwiftUI or to certify physical-device accessibility.

The implementation now has one semantic foundation in `src/tokens.css` and `src/ui.css`, explicit surface roles, shared command navigation and shared focus restoration. Component CSS retains layout and authored-content rendering; it no longer defines separate menu-selection palettes.

### Findings addressed

| Severity | Finding | System change | HIG basis |
| --- | --- | --- | --- |
| Critical | Sidebar pin controls could remain 28px on a touch tablet wider than the phone breakpoint. | Coarse-pointer targets are at least 44px; tested command rows are 44–48px or taller. | `accessibility.md › Mobility`: accommodate touch and alternative input. |
| High | Touch hover and automatic focus could paint unrelated commands as primary actions. | Neutral touch-opened menus, fine-pointer hover, one explicit keyboard highlight and separate pressed/disabled states. | `menus.md › Icons`: “Apply a uniform visual treatment across menu items in the same group.” |
| High | Modal form, command-menu and inspector styles shared button rules with different visual meanings. | Explicit `data-ui` roles: `dialog`, `action-menu`, `inspector`, `toolbar`, `diagram`. Separate geometry and states. | `color.md › Best practices`: “Avoid using the same color to mean different things.” |
| High | Dialog typography could fall back to the monospaced technical font; UI sizes varied by component. | System UI stack, semantic body/caption sizes, 17px mobile baseline and a separate document typography contract. | `typography.md › Ensuring legibility`: “Use font sizes that most people can read easily.” |
| High | Native settings displayed web-installation instructions and an inapplicable PWA/offline preparation state. | Platform-aware status; installation/help is collapsed after storage and editing preferences. | `designing-for-ios.md › Best practices`: focus on primary tasks and disclose secondary details. |
| Medium | Safari touch doesn't focus a clicked button, so modal dismissal could lose the invoking control. | A bounded interaction-invoker chain restores the connected control across menus and dialogs. | `accessibility.md › Speech`: keyboard-only navigation must remain usable. |
| Medium | Sidebar, editor, diagram and Whiteboard menus implemented navigation independently. | Shared Arrow/Home/End navigation, Escape, focus return, outside dismissal and one open details menu. | `menus.md › Organization`: logical command groups and consistent behavior. |
| Medium | Inspector statistics and controls didn't consistently scale with interface text. | Adaptive card columns, semantic sizes, wrapping action groups and 200% UI text journeys. | `layout.md › Visual hierarchy`: “Use progressive disclosure to make layouts cleaner and easier to interact with.” |

### Foundation contract

- Use existing semantic palette roles in both themes. New colors belong in `tokens.css`, never in a component.
- `--ui-body-size`, `--ui-caption-size`, `--ui-control-height`, radii, spacing and focus/on-accent roles are the UI vocabulary. Document Avenir typography, math, code and authored drawing colors remain separate.
- Menus are neutral command lists, not primary-button stacks. Icons in a group have consistent size/weight. Keyboard focus has one selected row; hover never pretends to be persistent selection.
- Only a true primary outcome uses `data-prominent` or the form-submit treatment. Other actions retain neutral surfaces.
- Inputs retain labels, visible focus, secure password semantics and a mobile text size of at least 16px. Native iOS UI body sizing uses the system body font metric.
- Use `EditorDialog` for ordinary dialogs and inspectors. Its variant defines the surface, keyboard behavior and focus return. An expanded command surface uses `data-ui="action-menu"`; details-based command menus use the shared helpers in `components/ui/actionMenu.ts`.
- Floating toolbars, command menus and inspectors share a regular translucent material, backdrop blur, a fine highlighted edge and a restrained shadow. Document content stays opaque. Reduced transparency and increased/forced contrast use opaque surfaces; native UIKit accessibility preferences are read through the bridge. This is a WebKit/CSS adaptation, not a claim to use UIKit UIGlassEffect.

### Interaction inventory

| Area | Shared foundation / adaptation | Verification |
| --- | --- | --- |
| First launch and welcome | Current-language authored welcome, pinned and opened in Read; restore personal drafts thereafter | Four-locale browser journeys; native first-launch/restoration XCTest |
| Note list, search, pinning, creation | System font, scaled captions, unframed header icons, touch targets and shared note commands | Source audit; desktop command journeys and mobile import journeys |
| Document presentation modes | Five icon/label modes, one selected state, common toolbar geometry | Editing-mode journey |
| Formatted writing, headings, links, icons, tables | Shared toolbar; portal heading menu; common field/dialog primitives | Heading/link/icon journeys; existing table/editor behavior retained |
| Markdown source and inline code | CodeMirror syntax and author source preserved; common surrounding controls | Editor tests and browser mode transitions |
| Import, export, Save As | Native picker/share where supported; common command menu and dialog surfaces | Mobile import and export/menu journeys; server save invariants |
| Statistics and outline | Inspector variant; adaptive statistics grid; regular-weight hierarchy; visible tabs and focus | Portrait/landscape, 200% text and both appearances |
| Diagram engine, source, zoom and export | Common control sizing, semantic captions, shared export command surface | Diagram source audit and browser renderer journeys |
| Excalidraw modal and Whiteboard | Shared toolbar and export surface, wrapping controls; SDK root tokens retained | Canvas/Whiteboard regression journeys |
| Settings, language and preferences | Labelled fields, consistent control geometry and disclosure of secondary help | Desktop/tablet/mobile settings journeys |
| GitHub account and repository destination | One searchable picker, automatic activation, shared fields/feedback and active destination summary | Isolated picker and storage regression journeys |
| Local Git folder/switching | Same settings and dialog primitives; reviewed preservation/sync behavior retained | Server/HTTP integration tests |
| Conflicts, reload and destructive confirmation | Shared dialog geometry; native confirmations retained for destructive loss | Existing preservation tests; common modal keyboard checks |
| Errors, notices and update prompts | Semantic icon/label, bounded rounded surface, explicit dismiss, no autosave success spam | Feedback/update journeys and source audit |
| Loading and empty workspace | Branded local feather/status label; reduced motion; clear next action | Loader source audit and existing document-loading behavior |
| About, support and privacy | Secondary disclosure, system UI typography, native external link handling | Settings and metadata checks |

### What works

Scriba's identity stays in the scribe illustration, Avenir document typography and calm editorial writing. Navigation uses familiar back, pencil/Done, information and More controls. Core writing remains offline-capable; the optional GitHub flow does not become an onboarding gate. System Files/share controls keep their platform presentation.

### Platform notes

Phone controls remain compact and safe-area aware. Larger views retain sidebars and the five labeled document modes; dialogs and menus adapt without exposing hidden phone editing bars. Physical VoiceOver, OS Dynamic Type changes, Files-provider behavior and Apple's requested launch recording still require actual supported-device QA. Browser/simulator evidence is not represented as that physical-device evidence.

[Visual and execution evidence](evidence/apple-design/README.md).

### Material refinement

`liquid-glass.md › The two layers` limits glass to the functional layer. The mobile action capsule and back control float over scrolling content; desktop controls share a rounded material bar. Notes, diagrams and settings content do not become glass cards. `liquid-glass.md › Tauri and Electron` describes the webview approximation with backdrop blur, semantic translucent fills and a native accessibility fallback.

Changing the interface language while a bundled welcome is open opens its separate localized file. Pending welcome edits are saved first; ordinary notes are never translated or replaced. Legacy welcome filenames are recognized without overwriting those files.
