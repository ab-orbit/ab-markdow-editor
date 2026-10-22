# Scriba interface foundation — evidence

All screenshots use isolated libraries with Scriba's bundled welcome content; no private user note or repository is shown.

| Surface | Light | Dark |
| --- | --- | --- |
| Mobile export | [390×844](light-390x844-1x-export.png) | [390×844](dark-390x844-1x-export.png) |
| Landscape export | [844×390](light-844x390-1x-export.png) | [844×390](dark-844x390-1x-export.png) |
| 200% UI export | [390×844](light-390x844-2x-export.png) | [390×844](dark-390x844-2x-export.png) |
| Statistics | [390×844](light-390x844-1x-statistics.png) | [390×844](dark-390x844-1x-statistics.png) |
| Outline | [390×844](light-390x844-1x-outline.png) | [390×844](dark-390x844-1x-outline.png) |
| Settings | [390×844](light-390x844-1x-settings.png) | [390×844](dark-390x844-1x-settings.png) |
| Link dialog | [Desktop](light-1440-link-dialog.png) | [Desktop](dark-1440-link-dialog.png) |
| Reading / outline | [Desktop](light-1440-reading-outline.png) | [Desktop](dark-1440-reading-outline.png) |

`apple-design.smoke.mjs` checks neutral touch-opened export rows, one keyboard-selected row, computed AA text contrast, 44px targets, Escape/focus return, light/dark, phone portrait/landscape, 200% UI text, statistics/outline and settings overflow. `design-system-journeys.smoke.mjs` exercises desktop/tablet note/export/portal menus, heading keyboard navigation, link/icon dialogs, outline and settings/GitHub entry. Tests support Chromium and WebKit.

[Audit, contract and full interaction inventory](../../DESIGN-SYSTEM.md). Physical-device review evidence is separate.
