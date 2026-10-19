import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** Reproducible signing uses an explicitly selected team; no account, password or key is embedded. */
const team = process.env.SCRIBA_APPLE_TEAM_ID;
if (!team || !/^[A-Z0-9]{10}$/.test(team)) throw new Error('Set SCRIBA_APPLE_TEAM_ID to the authorized ten-character Apple Developer Team ID. The account must be available in Xcode.');
const root = fileURLToPath(new URL('../', import.meta.url));
const artifacts = fileURLToPath(new URL('../artifacts/ios/', import.meta.url));
const run = (command, args) => { const result = spawnSync(command, args, { cwd: root, env: process.env, stdio: 'inherit' }); if (result.error) throw result.error; if (result.status !== 0) process.exit(result.status || 1); };
await mkdir(artifacts, { recursive: true });
run('npm', ['run', 'ios:sync']);
run('xcodebuild', ['-project', 'ios/App/App.xcodeproj', '-scheme', 'Scriba', '-configuration', 'Release', '-destination', 'generic/platform=iOS', '-archivePath', `${artifacts}/Scriba.xcarchive`, `DEVELOPMENT_TEAM=${team}`, '-allowProvisioningUpdates', 'archive']);
const options = `${artifacts}/ExportOptions.plist`;
await writeFile(options, `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>method</key><string>app-store-connect</string><key>teamID</key><string>${team}</string><key>signingStyle</key><string>automatic</string><key>manageAppVersionAndBuildNumber</key><false/><key>uploadSymbols</key><true/></dict></plist>`);
run('xcodebuild', ['-exportArchive', '-archivePath', `${artifacts}/Scriba.xcarchive`, '-exportOptionsPlist', options, '-exportPath', artifacts, '-allowProvisioningUpdates']);
