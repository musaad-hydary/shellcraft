#!/bin/bash

set -e

REPO="musaad-hydary/shellcraft"
APP_PATH="$HOME/Applications/shellcraft.app"
BIN_DIR="$HOME/.local/bin"
BIN_PATH="$BIN_DIR/shellcraft"
ZSH_PLUGIN_PATH="$HOME/.shellcraft/shellcraft.zsh"
ZSHRC="$HOME/.zshrc"

RED='\033[0;31m'
GREEN='\033[0;32m'
DIM='\033[2m'
NC='\033[0m'

print_step() { echo -e "${GREEN}==>${NC} $1"; }
print_dim()  { echo -e "${DIM}$1${NC}"; }
print_err()  { echo -e "${RED}error:${NC} $1"; exit 1; }

# uninstall
if [[ "$1" == "uninstall" ]]; then
  print_step "Uninstalling shellcraft..."
  pkill -x shellcraft 2>/dev/null || true
  rm -rf "$APP_PATH"
  rm -rf "/Applications/shellcraft.app"
  rm -f "$BIN_PATH"
  rm -f "$HOME/.shellcraft/shellcraft.zsh"
  sed -i '' '/shellcraft/d' "$ZSHRC" 2>/dev/null || true
  rm -rf "$HOME/.shellcraft"
  rm -f /tmp/shellcraft_buffer.json
  rm -f /tmp/shellcraft_exec.json
  rm -f /tmp/shellcraft.pipe
  echo -e "${GREEN}shellcraft uninstalled.${NC}"
  echo "  open a new terminal tab to complete removal."
  exit 0
fi

echo ""
echo "  shellcraft — terminal command explainer"
echo ""

# check macOS
[[ "$(uname)" == "Darwin" ]] || print_err "shellcraft only supports macOS"

# check iTerm2
if ! osascript -e 'id of application "iTerm2"' &>/dev/null 2>&1; then
  echo -e "${RED}warning:${NC} iTerm2 not found — shellcraft works best with iTerm2"
  echo "  download at https://iterm2.com"
  echo ""
fi

# kill existing instance
pkill -x shellcraft 2>/dev/null || true

# download latest release
print_step "Downloading shellcraft..."
RELEASE_JSON=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest")
LATEST=$(echo "$RELEASE_JSON" | grep '"tag_name"' | sed 's/.*"tag_name": "\(.*\)".*/\1/')
ASSET_URL=$(echo "$RELEASE_JSON" | grep '"browser_download_url"' | grep '\.dmg' | sed 's/.*"browser_download_url": "\(.*\)".*/\1/')

if [[ -z "$LATEST" ]]; then
  print_err "Could not fetch latest release. Check https://github.com/$REPO/releases"
fi
if [[ -z "$ASSET_URL" ]]; then
  print_err "Could not find DMG in latest release. Check https://github.com/$REPO/releases"
fi

print_dim "  version $LATEST"

TMP_DIR=$(mktemp -d)
DMG_PATH="$TMP_DIR/shellcraft.dmg"

curl -fsSL "$ASSET_URL" -o "$DMG_PATH" \
  || print_err "Download failed. Check https://github.com/$REPO/releases"

# install app
print_step "Installing shellcraft.app..."
mkdir -p "$HOME/Applications"
MOUNT_DIR=$(mktemp -d)
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_DIR" -quiet
rm -rf "$APP_PATH"
cp -r "$MOUNT_DIR/shellcraft.app" "$APP_PATH"
hdiutil detach "$MOUNT_DIR" -quiet
rm -rf "$TMP_DIR"

# remove quarantine
xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null || true

# install zsh plugin
print_step "Installing ZSH plugin..."
mkdir -p "$HOME/.shellcraft"
curl -fsSL "https://raw.githubusercontent.com/$REPO/main/shell/shellcraft.zsh" \
  -o "$ZSH_PLUGIN_PATH" \
  || print_err "Failed to download ZSH plugin"

# create bin launcher
print_step "Installing shellcraft command..."
mkdir -p "$BIN_DIR"
cat > "$BIN_PATH" << BINEOF
#!/bin/bash
if [[ "\$1" == "uninstall" ]]; then
  curl -fsSL https://raw.githubusercontent.com/musaad-hydary/shellcraft/main/install.sh | bash -s uninstall
  exit 0
fi
pkill -x shellcraft 2>/dev/null || true
sleep 0.2
$HOME/Applications/shellcraft.app/Contents/MacOS/shellcraft &
disown
echo "shellcraft started"
BINEOF
chmod +x "$BIN_PATH"

# add to .zshrc using individual echo calls to avoid heredoc issues
if ! grep -q "shellcraft" "$ZSHRC" 2>/dev/null; then
  echo "" >> "$ZSHRC"
  echo "# shellcraft — terminal command explainer" >> "$ZSHRC"
  echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$ZSHRC"
  echo "source ~/.shellcraft/shellcraft.zsh" >> "$ZSHRC"
  echo "if ! pgrep -x shellcraft > /dev/null; then" >> "$ZSHRC"
  echo "  ~/Applications/shellcraft.app/Contents/MacOS/shellcraft &" >> "$ZSHRC"
  echo "  disown" >> "$ZSHRC"
  echo "fi" >> "$ZSHRC"
  print_dim "  added to ~/.zshrc"
else
  print_dim "  ~/.zshrc already configured"
fi

# launch
print_step "Launching shellcraft..."
"$HOME/Applications/shellcraft.app/Contents/MacOS/shellcraft" &
disown

echo ""
echo -e "${GREEN}shellcraft installed successfully!${NC}"
echo ""
echo "  open a new terminal tab, then start typing commands in iTerm2."
echo "  shellcraft will appear automatically above your terminal."
echo ""
echo "  to restart:   shellcraft"
echo "  to uninstall: shellcraft uninstall"
echo "               or: curl -fsSL https://raw.githubusercontent.com/musaad-hydary/shellcraft/main/install.sh | bash -s uninstall"
echo ""