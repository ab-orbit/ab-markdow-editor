/** Store destinations are fixed locally; remote release metadata cannot supply executable links. */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6824664840';
export const TESTFLIGHT_URL = 'itms-beta://';
export interface NativeUpdateInfo {
  /** Installed bundle version and build, read by the native bridge. */
  version: string;
  build: string;
  /** Development builds never advertise a store update. */
  channel: 'app-store' | 'testflight' | 'development';
  /** Public Apple catalog or explicitly promoted TestFlight release metadata. */
  catalog?: unknown;
}
export interface StoreUpdate {
  /** Channel determines the fixed destination and user-facing action. */
  channel: 'app-store' | 'testflight';
  version: string;
  build?: string;
}
/** Numeric dotted comparison avoids lexical mistakes such as 1.9 being newer than 1.10. */
export function compareVersions(left: string, right: string): number | null {
  if (![left, right].every(value => /^\d+(?:\.\d+){0,3}$/.test(value) && value.length < 64)) return null;
  const a = left.split('.').map(BigInt), b = right.split('.').map(BigInt);
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const difference = (a[index] ?? 0n) - (b[index] ?? 0n);
    if (difference !== 0n) return difference > 0n ? 1 : -1;
  }
  return 0;
}
/** Invalid, missing, older or unpromoted releases produce no notice. */
export function availableStoreUpdate(info: NativeUpdateInfo): StoreUpdate | null {
  if (!info.catalog || typeof info.catalog !== 'object') return null;
  if (info.channel === 'app-store') {
    const results = (info.catalog as {results?: unknown}).results;
    if (!Array.isArray(results)) return null;
    const app = results.find(item => item?.trackId === 6824664840 && item?.bundleId === 'com.aeonbridge.scriba');
    return typeof app?.version === 'string' && compareVersions(app.version, info.version) === 1
      ? {channel: 'app-store', version: app.version} : null;
  }
  if (info.channel === 'testflight') {
    const catalog = info.catalog as {schema?: unknown; testflight?: {version?: unknown; build?: unknown; status?: unknown; expiresAt?: unknown}};
    const release = catalog.testflight;
    if (catalog.schema !== 1 || release?.status !== 'testing' || typeof release.version !== 'string' || typeof release.build !== 'string') return null;
    if (typeof release.expiresAt !== 'string' || !Number.isFinite(Date.parse(release.expiresAt)) || Date.parse(release.expiresAt) <= Date.now()) return null;
    const version = compareVersions(release.version, info.version), build = compareVersions(release.build, info.build);
    return build !== null && (version === 1 || version === 0 && build === 1)
      ? {channel: 'testflight', version: release.version, build: release.build} : null;
  }
  return null;
}
