# Folder authorization on iOS-on-Mac

## Evidence

Scriba 1.16.1, iPhone/iPad edition running on macOS, rejected multiple local folders. The native unified log at 06:51:39 and 06:52:42 on 2026-10-23 reports:

```
kCFURLBookmarkCreationMinimalBookmarkMask cannot be used with scoped bookmarks
```

The picker callback creates the `scriba` subdirectory and then creates a bookmark to the selected parent. Both bookmark creation sites (initial selection and stale-bookmark renewal) previously passed `.minimalBookmark` unconditionally. On iOS-on-Mac the platform supplies security scope, making that option incompatible. The shared catch reported the bookmark failure as a folder authorization failure.

## Change

Use empty bookmark creation options when `ProcessInfo.processInfo.isiOSAppOnMac` is true; retain `.minimalBookmark` on iPhone/iPad. Apply the policy to both initial selection and stale renewal. Keep the selected security-scoped URL and balanced access calls; do not reconstruct a URL from its path or discard existing authorization on failure.

## Validation and limits

- Xcode native tests on the isolated iOS 18.6 simulator: 2 passed, 0 failed.
- Both option branches create and resolve a real directory bookmark.
- Existing bridge round-trip test covers note/attachment writes, reads, revision conflicts and reload.
- The installed affected Mac app successfully opened GitHub settings and loaded its repository list; search became enabled. No repository was selected and no user note was uploaded. A persistent disabled GitHub button was not reproduced.
- The corrected native binary has not yet been installed on the affected Mac. Folder selection and persistence after restart there remain required release checks. Simulator success does not prove macOS security-scope behavior.
- Existing notes and installed-app data were not reset. App Store review build 27 was not replaced.

Reference: [Apple directory access documentation](https://developer.apple.com/documentation/uikit/providing-access-to-directories).
