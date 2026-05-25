# TabValet: Pinned Vertical Tabs

A premium Google Chrome Extension that replicates a clean vertical tab management experience with persistent pinned shortcuts and normal tabs inside Chrome's native side panel.

This extension bridges the visual and functional gap in standard Chrome vertical tabs by implementing a hybrid bookmark-navigation system, custom pinned/normal dividers, drag-and-drop mechanics, and favicon capsule resets (reminiscent of the Arc Browser layout).

---

## 🌟 Key Features

* **Two-Tiered Tab Structure**:
  * **Pinned Tabs (Upper)**: Persistent, bookmark-like anchors that remain in the sidebar even if their associated browser tabs are closed.
  * **Normal Tabs (Lower)**: A 1-to-1 representation of the current window's open tabs, clean and easily dismissible.
* **Drag-to-Pin Dropzones**: Drag normal tabs above the horizontal divider to pin them as permanent shortcuts, or drag pinned tabs below to unpin them.
* **Hybrid "/" Navigation State**: 
  * If a pinned tab navigates away from its default URL, the sidebar displays: `[Favicon] / [Navigated Title]`.
  * **Quick Reset**: Click the custom, full-height favicon capsule to instantly return the tab to its original pinned URL.
* **Obsidian Dark Theme**: A high-end dark user interface using glassmorphic HSL dark colors (`#121214` and `#16161a`), smooth transitions, and hover-triggered controls (like close "x" buttons) to eliminate visual noise.

---

## 🚀 Getting Started

### Prerequisites
* **Google Chrome** (v114+ for side panel support)
* **Node.js** (v18+) and **npm**

### Installation

To load the extension locally for development:

1. Clone or download this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. In the top-right corner, toggle **Developer mode** on.
4. In the top-left corner, click **Load unpacked**.
5. Select the repository root folder (`joyful-pascal` / `sidebar-extension`).
6. Click the Extensions icon (🧩) in the Chrome toolbar and click the **TabValet** icon (or open the Side Panel using the browser UI) to start.

---

## 🛠️ Development & Testing

This project prioritizes high performance and simplicity. It uses **Vanilla JS (ES Modules)** and **Vanilla CSS** with no build steps or bundlers to keep the extension lightweight.

### Setting Up Your Dev Environment

If you want to run the automated tests or contribute to the project, you must first install the development dependencies:

```bash
npm install
```

### Available Scripts

Once dependencies are installed, you can run these commands in the terminal from the project root:

```bash
# Run unit and logic tests via Vitest
npm test

# Run Vitest in interactive watch mode
npm run test:watch

# Run Playwright end-to-end integration tests (headful)
npm run test:e2e

# Start Playwright test runner UI for interactive debugging
npm run test:e2e:ui
```

### Core Architecture Principles
* **Decoupled Logic**: Files in `src/logic/` and `src/utils/` must remain pure (no references to `chrome.*` APIs, `window`, or `document`) so they can be unit-tested efficiently.
* **Side-Effect Glue**: Impure files like `background.js` and `sidepanel.js` handle Chrome APIs, event bindings, and DOM manipulations, applying decisions calculated by the pure logic layers.

---

## 🤝 Contributing

We welcome contributions! Please adhere to the following conventions when making changes:

### Coding Style & Conventions
* **Styles**: Do not use TailwindCSS or preprocessors. Modify `sidepanel.html` and use standard Vanilla CSS.
* **File Naming**: Use `kebab-case` for all files, directories, CSS classes, and HTML IDs (e.g. `tab-manager.js`, `.close-btn`).
* **JavaScript Naming**: Use `camelCase` for variables and functions (e.g. `pinnedTabs`, `normalizeUrl()`).
* **Git Commits**: Keep commit messages to a single line using `git commit -m "..."`. Prefer Conventional Commits format (e.g. `feat: ...`, `fix: ...`).
* **Bug Fixes**: All bug fixes must follow Test-Driven Development (TDD)—write a failing unit or integration test before implementing the fix.

---

## 💬 Frequently Asked Questions (FAQ)

### Q: The sidebar is currently on the right side of my browser. Can I move it to the left?

**Yes!** The side panel is managed natively by Google Chrome, which allows you to position it on either the left or right side. To move it to the left:

1. Click the **three-dot menu icon** (⋮) in the top-right corner of Google Chrome.
2. Select **Settings** from the dropdown menu.
3. In the left-hand navigation pane, click on **Appearance**.
4. Locate the **Side panel position** setting and change the dropdown option from *Show on right* to **Show on left**.

The vertical tabs sidebar will instantly move to the left side of your browser screen.
