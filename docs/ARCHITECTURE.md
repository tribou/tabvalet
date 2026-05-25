*What is this system? — components, data flow, DB schema, external APIs, and directory layout*

# Architecture Specification

This document details the software architecture, execution contexts, database schemas, and message passing protocols for the **Arc Vertical Tabs Sidebar** Chrome Extension.

---

## 1. High-Level Architecture

The extension is designed as a lightweight, zero-overhead Chrome Extension (Manifest V3) that synchronizes local UI interactions inside Chrome's side panel with active browser tabs. It uses standard Chrome Extension APIs without build tools or bundlers, maximizing compatibility and speed.

### System Diagram

```
                 +---------------------------------------------+
                 |              Active Browser Tabs            |
                 +---------------------------------------------+
                        ^                               ^
                        | chrome.tabs                   | storage event
                        v                               |
+------------------------------+                +-------------------------------+
| background.js (Service Worker| <--- messages -| sidepanel.js (UI Controller)   |
|   State Cache & Observers)   | - responses -> |   HTML5 Drag / DOM Render     |
+------------------------------+                +-------------------------------+
                        ^                               ^
                        | storage                       | storage
                        v                               v
                 +---------------------------------------------+
                 |            chrome.storage (Local/Session)   |
                 +---------------------------------------------+
```

---

## 2. Component Execution Contexts

The application runs in three isolated execution contexts:

### 2.1 Background Service Worker (`background.js`)
* **Context**: Extends the browser backend. Runs in an isolated background thread.
* **Role**: Orchestrates extension lifetime events, listens to tab lifecycles (`onUpdated`, `onRemoved`), maintains the session cache of active-to-pinned tab mappings, and modifies tab states via `chrome.tabs`.
* **State Managed**: `activePinnedTabs` map (held in memory and persisted in `chrome.storage.session`).

### 2.2 Sidepanel Interface (`sidepanel.html` & `sidepanel.js`)
* **Context**: HTML5 Document rendered in Chrome's side panel.
* **Role**: Renders the custom tab list, binds keyboard/mouse drag events, handles layout updates (collapsing close buttons, displaying `/` separators), and communicates user interactions back to the service worker.
* **State Managed**: UI states, DOM elements, active search query filters.

### 2.3 Active Browser Tabs (`chrome.tabs` API)
* **Context**: Standard Chrome web pages.
* **Role**: Target of our sync and navigation controls. The extension reads tab URLs, favicons, and titles, and updates tab positions or active states directly.

---

## 3. Data Schema & Persistence

State is persisted locally using the asynchronous `chrome.storage` API. No cloud sync, external databases, or remote telemetry are utilized.

### 3.1 Pinned Tabs Database (`chrome.storage.local`)
Stored under the key `"pinned_tabs"`. It contains an array of `PinnedTab` objects:

```typescript
interface PinnedTab {
  id: string;                 // Unique identifier (timestamp-based: e.g. "pin-1716500000")
  pinnedUrl: string;          // The default bookmarked URL
  activeUrl: string | null;   // Navigated sub-URL (null if inactive or at pinnedUrl)
  title: string;              // Default bookmarked title
  activeTitle: string | null; // Navigated subpage title (null if inactive or at pinnedUrl)
  favIconUrl: string;         // Cached URL/data URI of the page favicon
  order: number;              // Position index for drag-and-drop custom ordering
}
```

### 3.2 Session Mappings (`chrome.storage.session`)
Stored under the key `"active_pinned_tabs"`. It maps open tab IDs to active pinned tab IDs:

```typescript
type ActivePinnedTabs = Record<string, string>; // "openTabId" -> "pinnedTabId"
```

---

## 4. State Transitions & Message Passing

Communication between the Sidepanel UI and Background Worker is standardized through a typed message-passing API:

```
[Sidepanel] -- (action: "mapActiveTab") --> [Background Worker] --> updates storage.session
[Sidepanel] -- (action: "unmapActiveTab") --> [Background Worker] --> removes from storage.session
[Sidepanel] -- (action: "getActiveMap") --> [Background Worker] -- (returns activePinnedTabs) --> [Sidepanel]
```

### Key Workflows:

#### A. Opening a Pinned Tab
1. User clicks a pinned tab row in the sidebar.
2. `sidepanel.js` checks if the pinned tab has an active open tab ID mapped in the session cache.
3. **If mapped**: Switches focus to that tab using `chrome.tabs.update(tabId, { active: true })`.
4. **If NOT mapped**: Opens a new tab pointing to `activeUrl || pinnedUrl`, receives the new `tabId`, and sends a `"mapActiveTab"` message to the background worker to bind the new `tabId` to the `pinnedTabId`.

#### B. Navigating Pinned Tabs (Arc "/" Separator State)
1. User navigates to a new page inside a mapped browser tab.
2. `background.js` listens via `chrome.tabs.onUpdated`.
3. If the tab's new URL differs from its mapped `pinnedUrl` (excluding fragment/hash hashes):
   * Sets `activeUrl = changeInfo.url` and `activeTitle = tab.title`.
4. If the tab navigates back to `pinnedUrl` (or matches it):
   * Resets `activeUrl = null` and `activeTitle = null`.
5. These changes trigger storage listeners in `sidepanel.js`, instantly updating the DOM to display the `[Favicon] / [Navigated Title]` state.

#### C. Navigated Reset Button
1. User clicks the flush-left favicon capsule of a navigated pinned tab.
2. `sidepanel.js` intercepts the click (separate from the title/text block).
3. Executes `chrome.tabs.update(tabId, { url: pinnedUrl })`, navigating the tab back to its base URL.
4. `background.js` detects the navigation, clears the navigated indicators, and updates `chrome.storage.local`.

---

## 5. Repository Directory Layout

```
joyful-pascal/
├── CLAUDE.md                 # Root: Global rules, CLI commands, and index
├── AGENTS.md                 # Root: Pointer redirecting to CLAUDE.md
│
├── manifest.json              # Chrome extension manifest (MV3 config)
├── background.js              # Service Worker entry point
├── sidepanel.html             # Sidebar UI template
├── sidepanel.js               # Sidebar client-side controller
│
├── src/                       # Modular business logic (decoupled from environment)
│   ├── logic/
│   │   └── tab-manager.js     # Tab matching, synchronization, and mappings
│   └── utils/
│       └── url.js             # Pure URL normalization and equivalence matching
│
├── tests/                     # Test Suites & Mocks
│   ├── unit/                  # Fast, offline unit tests (Vitest)
│   │   ├── tab-manager.test.js
│   │   └── url.test.js
│   ├── e2e/                   # Real-browser integration tests (Playwright)
│   │   ├── sidebar.spec.js
│   │   └── fixtures.js
│   ├── setup.js               # Vitest environment setup and jest-chrome mock injection
│   └── playwright.config.js   # Playwright headful configuration
│
├── docs/                      # Architectural, development, and product manuals
│   ├── ARCHITECTURE.md        # [This File]
│   ├── DEVELOPMENT.md         # Naming, design principles, style guidelines
│   ├── PRODUCT.md             # Features, business context, requirements
│   ├── SECURITY.md            # Storage limits, permission scope, secrets
│   └── TESTING.md             # TDD rules, unit/E2E configs
│
├── icons/                     # Extension branding icons (16, 48, 128 px)
└── package.json               # Dependencies, scripts, and package settings
```
