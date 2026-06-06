#!/bin/bash

set -e

REPO="musaad-hydary/shellcraft"
APP_NAME="shellcraft"
APP_PATH="/Applications/shellcraft.app"
BIN_PATH="/usr/local/bin/shellcraft"
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
  rm -f "$BIN_PATH"
  rm -f "$ZSH_PLUGIN_PATH"
  sed -i '' '/shellcraft/d' "$ZSHRC" 2>/dev/null || true
  rm -rf "$HOME/.shellcraft"
  rm -f /tmp/shellcraft_buffer.json
  rm -f /tmp/shellcraft_exec.json
  echo -e "${GREEN}shellcraft uninstalled.${NC}"
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

# download latest release
print_step "Downloading shellcraft..."
LATEST=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name"' | sed 's/.*"tag_name": "\(.*\)".*/\1/')
if [[ -z "$LATEST" ]]; then
  print_err "Could not fetch latest release. Check https://github.com/$REPO/releases"
fi
print_dim "  version $LATEST"

TMP_DIR=$(mktemp -d)
DMG_PATH="$TMP_DIR/shellcraft.dmg"

curl -fsSL "https://github.com/$REPO/releases/download/$LATEST/shellcraft.dmg" -o "$DMG_PATH" \
  || print_err "Download failed. Check https://github.com/$REPO/releases"

# install app
print_step "Installing shellcraft.app..."
MOUNT_DIR=$(mktemp -d)
hdiutil attach "$DMG_PATH" -mountpoint "$MOUNT_DIR" -quiet
rm -rf "$APP_PATH"
cp -r "$MOUNT_DIR/shellcraft.app" "$APP_PATH"
hdiutil detach "$MOUNT_DIR" -quiet
rm -rf "$TMP_DIR"

# remove quarantine
xattr -dr com.apple.quarantine "$APP_PATH" 2>/dev/null || true

# create bin launcher
print_step "Installing shellcraft command..."
mkdir -p /usr/local/bin
cat > "$BIN_PATH" << 'EOF'
#!/bin/bash
# kill existing instance
pkill -x shellcraft 2>/dev/null || true
sleep 0.2
# launch as background process
/Applications/shellcraft.app/Contents/MacOS/shellcraft &
disown
echo "shellcraft started"
EOF
chmod +x "$BIN_PATH"

# install zsh plugin
print_step "Installing ZSH plugin..."
mkdir -p "$HOME/.shellcraft"
curl -fsSL "https://raw.githubusercontent.com/$REPO/main/shell/shellcraft.zsh" \
  -o "$ZSH_PLUGIN_PATH" \
  || print_err "Failed to download ZSH plugin"

# add to .zshrc
ZSHRC_SOURCE="source $ZSH_PLUGIN_PATH"
ZSHRC_LAUNCH="# auto-launch shellcraft in background"$'\n'"if ! pgrep -x shellcraft > /dev/null; then"$'\n'"  /Applications/shellcraft.app/Contents/MacOS/shellcraft &"$'\n'"  disown"$'\n'"fi"

if ! grep -q "shellcraft" "$ZSHRC" 2>/dev/null; then
  echo "" >> "$ZSHRC"
  echo "# shellcraft — terminal command explainer" >> "$ZSHRC"
  echo "$ZSHRC_SOURCE" >> "$ZSHRC"
  echo "$ZSHRC_LAUNCH" >> "$ZSHRC"
  print_dim "  added to ~/.zshrc"
else
  print_dim "  ~/.zshrc already configured"
fi

# grant accessibility permission prompt
print_step "Requesting Accessibility permission..."
echo ""
echo "  shellcraft needs Accessibility access to read your terminal's position."
echo "  A permission dialog may appear — please allow it."
echo ""
/Applications/shellcraft.app/Contents/MacOS/shellcraft &
disown
sleep 1

echo ""
echo -e "${GREEN}shellcraft installed successfully!${NC}"
echo ""
echo "  start a new terminal tab or run:"
echo "  source ~/.zshrc"
echo ""
echo "  then just start typing commands in iTerm2."
echo "  shellcraft will appear automatically above your terminal."
echo ""
echo "  to uninstall:"
echo "  shellcraft uninstall"
echo ""