# Shellcraft

A floating terminal command explainer for macOS and iTerm2.

Start typing a command and shellcraft appears above your terminal, explaining what it does, breaking down each flag, warning about dangerous operations, and keeping track of what you have run recently.

---

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/musaadhydary/shellcraft/main/install.sh | bash
```

Open a new terminal tab after installing. ShellCraft starts automatically whenever you open iTerm2.

### rRequirements

- macOS 12 or later
- iTerm2
- zsh

---

## Features

**Command Explanation** — describes what the current command does as you type, including a breakdown of every flag

**Pipeline Explanation** — when you pipe commands together (`cmd1 | cmd2 | cmd3`) it explains the full chain as a sentence

**Ghost Hints** — when you type just a command name, the most commonly used flags appear as faded suggestions inline

**TNT Warning** — dangerous commands like `rm -rf`, `git push --force`, and `chmod 777` get flagged before you run them

**Recently Used** — a 6-slot hotbar of your most recent commands; click any slot to copy the full command line to your clipboard

**Exit Code** — shows a checkmark or error code in the titlebar after each command runs

**Complexity Meter** — a 5-pip indicator in the titlebar showing how complex the current command is

---

## Supported Commands

`find` `git` `ls` `grep` `rm` `cd` `npm` `curl` `chmod` `ssh` `mkdir` `cp` `mv` `cat` `kill` `sudo` `brew` `docker` `clear` `echo` `pwd` `which` `touch` `exit` `history` `export` `source` `open` `vim` `nano` `tmux` `python3` `node` `cargo` `sed` `awk` `tar` `ping` `ps` `df` `du` `whoami` `xargs` `wc` `head` `tail` `sort` `uniq`

---

## Usage

ShellCraft runs silently in the background. It appears above your iTerm2 window when you start typing a command and disappears when you run it or clear the buffer.

The window follows your terminal as you move it around the screen.

Click any slot in the recently used hotbar to copy that full command line to your clipboard.

---

## Launch

ShellCraft needs to be started from a terminal session. The install script adds an auto-launch line to your `.zshrc` so it starts with every new terminal tab.

To start it manually:

```bash
shellcraft
```

This launches it as a background process. You can close the terminal window after running it.

---

## Uninstall

```bash
shellcraft uninstall
```

Removes the app, the ZSH plugin, the launcher binary, and all lines added to `~/.zshrc`.

---

## How it Works

ShellCraft is built with [Tauri](https://tauri.app) (Rust and React). A ZSH plugin hooks into the line editor and writes the current buffer to `/tmp/shellcraft_buffer.json` on every keystroke. The Rust backend polls this file every 50ms and emits events to the React frontend. When you press enter, the executed command is written to `/tmp/shellcraft_exec.json` and added to the recently used list.

Window positioning uses the macOS Accessibility API via osascript to read iTerm2's frame, then positions the Tauri window directly above it using physical pixel coordinates. The position updates every 300ms when the window is visible so it follows the terminal as you drag it.

---

## built with

- [Tauri 2](https://tauri.app)
- [React 18](https://react.dev) and TypeScript
- [pixelarticons](https://pixelarticons.com)
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/)
