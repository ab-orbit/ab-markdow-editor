import type { CapacitorConfig } from '@capacitor/cli';

/** App Store builds bundle the editor; production web code is never downloaded or evaluated. */
const config: CapacitorConfig = {
  appId: 'com.aeonbridge.scriba',
  appName: 'Scriba',
  webDir: 'dist-ios',
  loggingBehavior: 'none',
  ios: { contentInset: 'never', preferredContentMode: 'mobile', scheme: 'Scriba' },
};
export default config;
