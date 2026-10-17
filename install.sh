#!/bin/bash
# Install a self-contained local web application; no administrator privileges required.
set -euo pipefail
if [[ "$(uname -s)" != Darwin ]]; then
  echo 'Este instalador é para macOS.' >&2
  exit 1
fi
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_DIR="$HOME/Library/Application Support/AB Markdown"
APPLICATIONS_DIR="${MARKDOWN_APPLICATIONS_DIR:-$HOME/Applications}"
DESKTOP_DIR="${MARKDOWN_DESKTOP_DIR:-$HOME/Desktop}"
mkdir -p "$STATE_DIR" "$APPLICATIONS_DIR" "$DESKTOP_DIR"
chmod 700 "$STATE_DIR"
WORK_DIR="$(mktemp -d "$STATE_DIR/install.XXXXXX")"
trap 'rm -rf "$WORK_DIR"' EXIT

# Bundle an official runtime rather than a host binary with external dylib dependencies.
case "$(uname -m)" in arm64) NODE_ARCH=arm64 ;; x86_64) NODE_ARCH=x64 ;; *) echo 'Arquitetura não suportada.' >&2; exit 1 ;; esac
NODE_DIST='https://nodejs.org/dist/latest-v22.x'
echo 'Baixando o Node.js oficial…'
curl --fail --location --silent --show-error "$NODE_DIST/SHASUMS256.txt" -o "$WORK_DIR/SHASUMS256.txt"
NODE_ARCHIVE="$(awk -v suffix="-darwin-$NODE_ARCH.tar.gz" 'index($2,suffix) && substr($2,length($2)-length(suffix)+1)==suffix {print $2; exit}' "$WORK_DIR/SHASUMS256.txt")"
[[ -n "$NODE_ARCHIVE" ]] || { echo 'Runtime Node.js não encontrado.' >&2; exit 1; }
curl --fail --location --silent --show-error "$NODE_DIST/$NODE_ARCHIVE" -o "$WORK_DIR/$NODE_ARCHIVE"
(cd "$WORK_DIR" && awk -v name="$NODE_ARCHIVE" '$2==name' SHASUMS256.txt | shasum -a 256 -c -)
tar -xzf "$WORK_DIR/$NODE_ARCHIVE" -C "$WORK_DIR"
NODE_HOME="$WORK_DIR/${NODE_ARCHIVE%.tar.gz}"
export PATH="$NODE_HOME/bin:$PATH"
NODE_BIN="$NODE_HOME/bin/node"
NPM_BIN="$NODE_HOME/bin/npm"
# Git is required for repository access; macOS may prompt for its command line tools.
if ! git --version >/dev/null 2>&1; then
  xcode-select --install || true
  echo 'Conclua a instalação das ferramentas Git do macOS e execute ./install.sh novamente.' >&2
  exit 1
fi
cd "$SOURCE_DIR"
echo 'Instalando dependências e compilando o editor…'
"$NPM_BIN" ci --no-audit --no-fund
"$NPM_BIN" run build

APP_DIR="$WORK_DIR/AB Markdown.app"
RESOURCES="$APP_DIR/Contents/Resources"
mkdir -p "$APP_DIR/Contents/MacOS" "$RESOURCES/scripts"
cp -R dist server native "$RESOURCES/"
cp scripts/launch.mjs scripts/stop.mjs "$RESOURCES/scripts/"
cp -R "$NODE_HOME" "$RESOURCES/runtime"
"$RESOURCES/runtime/bin/node" --version
printf '%s\n' "${PATH#*:}" > "$RESOURCES/runtime-path.txt"
cat > "$APP_DIR/Contents/MacOS/ABMarkdown" <<'LAUNCHER'
#!/bin/bash
set -euo pipefail
RESOURCES="$(cd "$(dirname "$0")/../Resources" && pwd)"
exec "$RESOURCES/runtime/bin/node" "$RESOURCES/scripts/launch.mjs"
LAUNCHER
chmod +x "$APP_DIR/Contents/MacOS/ABMarkdown"
cat > "$APP_DIR/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>AB Markdown</string>
<key>CFBundleDisplayName</key><string>AB Markdown</string>
<key>CFBundleIdentifier</key><string>com.aeonbridge.markdown</string>
<key>CFBundleVersion</key><string>1.0.0</string>
<key>CFBundleShortVersionString</key><string>1.0.0</string>
<key>CFBundleExecutable</key><string>ABMarkdown</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleIconFile</key><string>AppIcon</string>
<key>LSUIElement</key><true/>
</dict></plist>
PLIST
"$NODE_BIN" scripts/create-icon.mjs "$WORK_DIR/icon.png"
mkdir "$WORK_DIR/AppIcon.iconset"
for SIZE in 16 32 128 256 512; do
  sips -z "$SIZE" "$SIZE" "$WORK_DIR/icon.png" --out "$WORK_DIR/AppIcon.iconset/icon_${SIZE}x${SIZE}.png" >/dev/null
  DOUBLE=$((SIZE * 2))
  sips -z "$DOUBLE" "$DOUBLE" "$WORK_DIR/icon.png" --out "$WORK_DIR/AppIcon.iconset/icon_${SIZE}x${SIZE}@2x.png" >/dev/null
done
iconutil -c icns "$WORK_DIR/AppIcon.iconset" -o "$RESOURCES/AppIcon.icns"
plutil -lint "$APP_DIR/Contents/Info.plist"

# Replace only our own application and desktop link; never remove unrelated files.
TARGET_APP="$APPLICATIONS_DIR/AB Markdown.app"
if [[ -e "$TARGET_APP" ]]; then
  APP_ID=$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$TARGET_APP/Contents/Info.plist" 2>/dev/null || true)
  [[ "$APP_ID" == com.aeonbridge.markdown ]] || { echo "Já existe outro aplicativo em $TARGET_APP" >&2; exit 1; }
  "$NODE_BIN" scripts/stop.mjs
  rm -rf "$TARGET_APP"
fi
mv "$APP_DIR" "$TARGET_APP"
/usr/bin/osascript -l JavaScript "$SOURCE_DIR/scripts/set-finder-icon.jxa.js" "$TARGET_APP/Contents/Resources/AppIcon.icns" "$TARGET_APP"
DESKTOP_LINK="$DESKTOP_DIR/AB Markdown.app"
if [[ -L "$DESKTOP_LINK" ]]; then
  [[ "$(readlink "$DESKTOP_LINK")" == "$TARGET_APP" ]] || { echo "Já existe outro atalho em $DESKTOP_LINK" >&2; exit 1; }
  rm "$DESKTOP_LINK"
elif [[ -e "$DESKTOP_LINK" ]]; then
  /usr/bin/osascript -l JavaScript "$SOURCE_DIR/scripts/create-desktop-alias.jxa.js" "$TARGET_APP" "$DESKTOP_LINK" --check || { echo "Já existe outro arquivo em $DESKTOP_LINK." >&2; exit 1; }
fi
/usr/bin/osascript -l JavaScript "$SOURCE_DIR/scripts/create-desktop-alias.jxa.js" "$TARGET_APP" "$DESKTOP_LINK"
touch "$TARGET_APP"
echo "Instalado: $TARGET_APP"
echo "Ícone na Mesa: $DESKTOP_LINK"
if [[ "${MARKDOWN_NO_OPEN:-0}" != 1 ]]; then open "$TARGET_APP"; fi
