# Compact document actions

Desktop and mobile share a formatting / information / more-options group. Edit modes, import/export, save, save as, copy, rename, navigation, appearance and settings are available from the contextual menu. Injected application actions retain their existing callbacks and receive visible labels from their localized accessibility names. The format selector remains in the header.

Formatting is collapsed initially and opens with the B I U control. Information reuses the existing statistics, dates and outline inspector. Native dialog focus containment, Escape, arrow navigation and outside dismissal remain shared with other menus.

Validated with the actual component in Chromium on desktop and mobile: secondary actions absent from the compact header; mode selection changes to Source; information opens Statistics; formatting opens the editing toolbar. The header smoke also verifies long-name truncation and one-row Whiteboard layout.

![Desktop menu](desktop-menu.png)
![Information](desktop-info.png)
![Mobile menu](mobile-menu.png)

No App Store Connect submission was performed.
