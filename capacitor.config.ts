import type { CapacitorConfig } from '@capacitor/cli';

/** App Store builds bundle the editor; production web code is never downloaded or evaluated. */
const config: CapacitorConfig = {
  appId: 'com.aeonbridge.scriba',
  appName: 'Scriba',
  webDir: 'dist-ios',
  loggingBehavior: 'none',
  // Notes, source, settings and canvas own their inner scrolling. Letting the
  // outer WKWebView scroll can pan the whole workspace above its native bars
  // when a live caret moves during a Duo rotation with the keyboard visible.
  ios: { contentInset: 'never', scrollEnabled: false, preferredContentMode: 'mobile', scheme: 'Scriba' },
};
export default config;
