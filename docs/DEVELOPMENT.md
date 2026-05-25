*How do we write code here? — naming conventions, design principles, error handling, reliability strategy, and planned stack*

# Development Guidelines

This document outlines the coding style, structural design principles, naming conventions, and reliability strategies for developing features in the **TabValet** codebase.

---

## 1. Core Development Philosophy

Our technology stack prioritizes simplicity, raw performance, and browser-native technologies:
- **No Bundlers / No Build Phase**: We write code that runs directly in Google Chrome. We avoid compiling, transpiling, or bundling production code (no Webpack, Babel, or Rollup).
- **Native ES Modules**: Production scripts use standard JavaScript ES Modules (`import`/`export`).
- **Dual module context**: The repository operates in a dual environment:
  - **Extension Context**: Runs native ES Modules directly in the browser (e.g. `background.js` and `sidepanel.js` import from `src/logic/` and `src/utils/`).
  - **Testing/Dev Context**: Node.js operates in **CommonJS** mode (defined by `"type": "commonjs"` in `package.json`). Testing configs and Playwright fixtures use CommonJS syntax (`require`/`module.exports`). Vitest bridges the gap by transpiling ES Modules on the fly inside unit tests.

---

## 2. Decoupling Pure Logic from Impure Contexts

To keep the codebase highly testable and robust, we separate **pure logic** (which can be unit-tested anywhere) from **impure side effects** (which depend on browser DOM or Chrome Extension APIs).

### 2.1 Pure Functions (`src/logic/` and `src/utils/`)
* **Rule**: Files in these folders must NOT reference `chrome.*` APIs, `window`, `document`, or perform DOM operations.
* **Purpose**: Performs calculations, comparisons, mappings, string operations, or data transformations.
* **Benefit**: Allows 100% test coverage with sub-millisecond, zero-dependency Vitest unit tests.
* **Example**: `src/utils/url.js` provides `normalizeUrl(url)` which is a deterministic, pure string transformation.

### 2.2 Impure Glue Code (`background.js` and `sidepanel.js`)
* **Rule**: Performs DOM manipulations, event binding, chrome state observation, and asynchronous messaging.
* **Strategy**: Gather state from Chrome APIs, pass it into pure business logic modules to calculate the new desired state, and then apply that returned state back to the DOM or Chrome windows.

---

## 3. Style & Design Guidelines (Vanilla CSS)

We do not use TailwindCSS or CSS preprocessors. The visual interface is hand-crafted using standard **Vanilla CSS** inside the browser side panel.

### Premium Obsidian Design Tokens:
- **Primary Background**: `#121214` (Deep obsidian dark mode).
- **Secondary / Card Background**: `#16161a` (Glassmorphic dark card overlay).
- **Hover Highlights**: `rgba(255, 255, 255, 0.08)` (Subtle, sleek glass overlays).
- **Text Color**: Primary `#e4e4e7` (high contrast zinc white), Secondary `#9ca3af` (neutral gray).
- **Theme Accents**: Sleek blue `#3b82f6` or neutral borders `rgba(255, 255, 255, 0.1)`.

### Interactive Details:
- All interactive controls (close buttons, action buttons) must be completely hidden or low-opacity by default, transitioning to active/visible smoothly upon hover (`transition: opacity 0.15s ease`).
- Click targets for favicon-capsule resets must extend to the full height of the tab row and be flush-left to mimic premium sidepanel UX.

---

## 4. Naming Conventions

Maintain strict structural consistency by adhering to these naming styles:

| Asset | Convention | Example |
| --- | --- | --- |
| **Files & Folders** | `kebab-case` | `tab-manager.js`, `playwright.config.js` |
| **JavaScript Variables** | `camelCase` | `activePinnedTabs`, `pinnedTabId` |
| **JavaScript Functions** | `camelCase` | `calculateTabMappings()`, `normalizeUrl()` |
| **CSS Classes** | `kebab-case` | `.tab-row`, `.favicon-wrapper`, `.close-btn` |
| **HTML Element IDs** | `kebab-case` | `pinned-container`, `search-input` |
| **Git Branches** | `kebab-case` | `feature/drag-to-reorder`, `bugfix/removed-listener` |

---

## 5. Error Handling & Reliability Strategy

Because extension service workers are short-lived and can sleep, robust error handling is required to prevent broken states:

### 5.1 Asynchronous Chrome APIs
Always handle errors when executing asynchronous Chrome operations. Chrome APIs do not always throw modern promise exceptions; check `chrome.runtime.lastError` or catch block rejections:

```javascript
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error("Error setting panel behavior:", error));
```

### 5.2 Storage Integrity
When reading/writing data to `chrome.storage.local` or `chrome.storage.session`:
- Always provide fallback defaults in case keys are uninitialized (e.g. `const tabs = result.pinned_tabs || []`).
- Sanitize URLs and titles before writing to storage to avoid injecting corrupted or massive payloads.
