# Notepad GG

A modern, minimal desktop text editor with a column mode for long heighted texts built on Electron. Fast, keyboard-friendly, and designed to stay out of your way — with a few tricks up its sleeve.
Just did it out of curiosity and solving a issue

# Notepad GG — Main Interface
<p align="center">
  <img src="https://github.com/user-attachments/assets/7ebc4ece-ad8e-4a0c-b9b4-287b62c3bcfe">
</p>


---

## Download

> **[⬇ Download Notepad GG Setup — Windows x64](https://drive.google.com/file/d/1kk7hGyfiGa_exzDT4yjGs_yKLz1tiY24/view?usp=sharing)**

---

## Features

### Editor
- **Default mode** — clean single-column editing with live line numbers, active-line highlight, and smooth scroll sync between gutter and editor
- **Column mode** — reflows your text into newspaper-style columns that fill the editor width; column count auto-adjusts to your window size, or lock a fixed width with the slider
- **Per-file mode memory** — each file remembers whether it was open in Default or Column mode and restores it on next launch
- **Exact cursor restore** — reopens every file at the exact line and character position where you left off, every time
- **Session restore** — all open files, their order, their mode, and their cursor positions are saved on close and fully restored on next launch

### Tabs
- **Multi-tab** — open as many files as you need; tabs scroll horizontally when they overflow
- **Drag to reorder** — grab any tab and drag it to a new position; a ghost clone lifts off the bar showing you where it will land
- **Middle-click to close** — standard browser muscle memory works here
- **Right-click context menu** — rename, copy as, open file location, delete from disk, see last saved time and file size, or close

### Files
- Open, save, save as — with unsaved-changes protection that asks per-file before closing
- `.txt`, `.md`, and `.log` file associations — double-click any of these in Explorer to open directly in Notepad GG
- **Open With** support — right-click any file in Explorer → Open With → Notepad GG

### Appearance
- **Dark / Light / Warm** themes — fully themed, no half-measures
- **Warmth slider** — blend a warm amber tint over the dark theme from 0 to 100%
- **UI scale** — four sizes: Compact, Medium, Comfortable, Spacious
- **10 editor fonts** — DM Mono, JetBrains Mono, Fira Code, Source Code Pro, IBM Plex Mono, Cascadia Code, Space Mono, Nunito, Literata, Atkinson Hyperlegible
- **Font size slider** — 10px to 28px, live preview
- **Custom colors** — override accent, background, text, gutter, and column divider colors with a built-in color picker

### Search
- **Find & Replace** panel (Ctrl+F) floats inside the editor area
- Real-time highlight overlay — all matches lit up behind the text as you type
- Navigate with Enter / Shift+Enter, replace one or all

### Status Bar
- Live line count, character count, cursor position (Ln / Col)
- Mode badge (Default / Column)
- Encoding (UTF-8)
- RAM and CPU usage of the app — updates every 3 seconds

---

## Screenshots


<p align="center">
  <img src="https://github.com/user-attachments/assets/e08d09d5-aaa7-48f8-be87-91e62ecb2e0b"
    width="68%" style="object-fit: cover;" />
  <span style="display:inline-block;width:2px;height:320px;background-color:#ccc;margin:0 5px;"></span>
  <img src="https://github.com/user-attachments/assets/09be04e9-e810-40c1-9b65-d9e7376db2ae"
    width="28%" height="520px" style="object-fit: cover;" />
</p>

---

## Build From Source

**Requirements:** Node.js 18+ and npm

```bash
# Clone the repo
git clone https://github.com/sadman128/notepad-gg
cd notepad-gg

# Install dependencies
npm install

# Run in development
npm start

# Build Windows installer
npm run build:installer

# Build portable
npm run build:portable
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + T` | New tab |
| `Ctrl + W` | Close tab |
| `Ctrl + O` | Open file |
| `Ctrl + S` | Save |
| `Ctrl + Shift + S` | Save As |
| `Ctrl + F` | Find & Replace |
| `Ctrl + 1` | Switch to Default mode |
| `Ctrl + 2` | Switch to Column mode |
| `Ctrl + Tab` | Next tab |
| `Ctrl + Shift + Tab` | Previous tab |
| `Escape` | Close search / menu |

---

## Stack

- **Electron** — desktop shell
- **Vanilla JS** — no framework, no bundler, no dependencies in renderer
- **Google Fonts** — loaded at runtime (requires internet on first launch per font)
- **electron-builder** — packaging and Windows installer

---

## About

This project was built entirely with **[Claude](https://claude.ai)** by Anthropic.

I did not write a single line of code. (yeah ai is super genius now)
But every feature and design is given by me, ai did the work while i designed it. I faced some issues with long heighted text so i wanted a column mode for myself.
If you're curious what that process looks like, this repo is the answer.

---

