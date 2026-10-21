# Scriba 1.16.1 (13)

Mandatory background autosave now applies to desktop and mobile, including legacy preferences that disabled saving. Automatic saves preserve editing focus and skip commit-message prompts. Version conflicts remain protected. Mobile uses a three-action Import/Export/Settings menu and a two-tab Statistics/Outline information sheet. Outline typography and menu styling are lighter in both themes.

The signed iOS archive succeeded on 21 October 2026. Xcode confirmed successful upload at 09:01:15 Recife. After reauthentication in the existing AeonBridge Chrome profile, App Store Connect confirmed processing complete. Build **1.16.1 (13)** was assigned to the existing internal **Equipe Scriba** group. The group Builds page visibly reports **Testing**, with a 90-day expiry. It is available to that group in TestFlight. [Upload log](upload.log). The App Store review submission is not being resubmitted.

Validation: 72 Node tests; Chromium/WebKit mobile and desktop background-autosave journeys; portrait/landscape cursor preservation; information tabs, global folding, Markdown export and Settings navigation. See [mobile evidence](../mobile-simplification/README.md).

## Availability verification

App Store Connect → Scriba → TestFlight → Internal Testing → Equipe Scriba → Builds showed:

```text
Internal Group · 1 Tester · 4 Builds
Build 1.16.1 (13)
Testing
Expires in 90 days
Platform: iOS
```

No new testers were added. External beta-group distribution and the rejected public App Store review submission were not modified.
