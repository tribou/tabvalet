# Design Specification: Chrome Vertical Tabs Sidebar (Arc-lite)

Detailed architecture and design spec for a Google Chrome extension that implements a vertical sidebar tab manager duplicating the core pinned, unpinned, and drag-and-drop tab behaviors of Arc Browser.

---

## 1. Goal Description & Scope

The extension provides a premium, high-performance side panel vertical tab manager in Google Chrome. It replicates Arc's iconic pinned/temporary divider structure, drag-to-pin mechanism, and "/" navigation reset pattern.

### Core Features

1. **Two-Way Real-time Tab Sync**: A standard list of vertical "Temporary Tabs" reflecting the current window's open tabs 1-to-1.
2. **Persistent Pinned Tabs**: An upper list of persistent bookmarks ("Pinned Tabs") stored in a local database.
3. **Continuous Drag-to-Pin Dropzones**: Zero-margin vertical drop zones that touch the horizontal divider directly, allowing seamless drag-and-drop of open tabs to pin/unpin them.
4. **Arc "/" Navigation State**:
   * If a pinned tab navigates away from its default URL, a `/` separator is inserted: `[Favicon] / [Navigated Title]`.
   * A full-height, borderless, flush-left hover block (using the standard tab hover color `rgba(255, 255, 255, 0.08)`) encapsulates the favicon.
   * Clicking this favicon block instantly resets the tab back to its original pinned default URL.
   * Clicking the text or the `/` switches to the tab normally without resetting.
5. **Clean Interaction Details**:
   * Close buttons on all tabs are completely hidden unless hovered.
   * Smooth CSS micro-animations on hover, activation, and drop highlights.

---

## 2. Technical Architecture & Components

The system operates across three core execution contexts using asynchronous message passing:

```
[ Active Browser Tabs ] <--- chrome.tabs / chrome.storage ---> [ background.js (Service Worker) ]
                                                                       ^
                                                                       | (Message Passing / Event Sync)
                                                                       v
                                                               [ sidepanel.html / sidepanel.js ]
```

### 2.1 Manifest Configuration (`manifest.json`)
Declares permissions and component entry points under Manifest V3:
* **Permissions**:
  * `"sidePanel"`: Registers the custom sidebar hosted in Chrome's side panel.
  * `"tabs"`: Monitors updates, tab state, active focuses, and handles tab creations/navigations.
  * `"storage"`: Persists the `pinned_tabs` database across browser sessions.
  * `"contextMenus"`: Standardizes right-click behavior.
* **Declarations**:
  * `"background": { "service_worker": "background.js" }`
  * `"side_panel": { "default_path": "sidepanel.html" }`

### 2.2 Background Controller (`background.js`)
* **Triggering**: Configures Chrome to open the sidebar upon clicking the extension icon via `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.
* **State Map**: Maintains an in-memory map of `activePinnedTabs` (`tabId` -> `pinnedTabId`) to track which open tabs belong to which pinned bookmarks.
* **Navigation Listener**: Listens to `chrome.tabs.onUpdated`. If a tab mapped to a pinned bookmark changes URL:
  * Compares the new URL to the default `pinnedUrl`.
  * If different, updates the `activeUrl` and `activeTitle` in `chrome.storage.local` to trigger the `/` navigated indicator.
  * If matching, clears the navigated indicators.
* **Tab Closures**: Listens to `chrome.tabs.onRemoved` to clean up mappings and reset the navigated indicators for closed tabs.

### 2.3 Sidepanel Interface (`sidepanel.html` & `sidepanel.js`)
* **Styling (`sidepanel.css`)**: Implements the premium glassmorphic obsidian theme. Uses HSL tailored dark styling (`#121214` and `#16161a`).
* **Layout Grid**:
  * A full-width search input at the top.
  * A pinned dropzone container supporting row tabs.
  * A borderless horizontal divider (`.section-divider`) with `margin: 0`.
  * A temporary dropzone container supporting row tabs.
* **Click Targets**:
  * `.favicon-wrapper` is styled with `height: 100%`, `padding-left: 10px`, and negative margins to align perfectly flush-left in navigated tabs. It highlights with `rgba(255,255,255,0.08)` on hover.
  * Clicking the wrapper triggers the URL reset in the active tab; clicking the title triggers a normal tab focus.
* **Drag-and-Drop API**: Implements native HTML5 Drag and Drop (`draggable="true"` on tabs). Dropping a tab above or below the divider triggers message passing to the background worker to toggle the pinned status.

---

## 3. Data Schema & State Management

Tab persistence is stored inside `chrome.storage.local` under the `pinned_tabs` key.

### 3.1 Pinned Tab Interface
```typescript
interface PinnedTab {
  id: string;             // Unique identifier (UUID or timestamp)
  pinnedUrl: string;      // The default/saved bookmark URL (e.g., https://github.com/inbox)
  activeUrl: string | null;// The currently navigated sub-URL; null if tab is inactive/closed
  title: string;          // Default display title
  activeTitle: string | null; // The navigated subpage title
  favIconUrl: string;     // URL to site favicon
  order: number;          // Position index for custom drag sorting
}
```

### 3.2 Workflow State Transitions

```
[Click Pinned Tab] ---> Tab open? ---> YES ---> Focus Tab
                          |
                          v
                          NO  ---> Open new tab at activeUrl || pinnedUrl
                              ---> Map tabId to pinnedId in Background Worker
```

```
[Navigate Away] ---> chrome.tabs.onUpdated ---> newUrl == pinnedUrl?
                                                   |
                                                   +---> YES ---> Clear navigated state, hide "/"
                                                   +---> NO  ---> Update activeUrl, show "/"
```

```
[Click Favicon Button] ---> chrome.tabs.update(tabId, { url: pinnedUrl })
                         ---> Clear navigated state, hide "/"
```

---

## 4. UI Layout & CSS Rules

### 4.1 Stretched Borderless Reset Target
```css
/* Zero left padding lets child favicon wrapper sit perfectly flush left */
.tab-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 38px;
  padding: 0 10px 0 0;
  border-radius: 6px;
  background: transparent;
  cursor: grab;
  position: relative;
  overflow: hidden;
}

/* Stretched, full-height click target block */
.tab-row.navigated .favicon-wrapper {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px 0 10px;
  margin-right: 8px;
  cursor: pointer;
  background: transparent;
}

/* Unified hover highlight */
.tab-row.navigated .favicon-wrapper:hover {
  background: rgba(255, 255, 255, 0.08);
}
```

### 4.2 Close Button Visibility on Hover
```css
.tab-row .close-btn {
  opacity: 0;
  transition: opacity 0.15s ease, background 0.15s;
}
.tab-row:hover .close-btn {
  opacity: 0.7;
}
.tab-row .close-btn:hover {
  opacity: 1 !important;
  background: rgba(255, 255, 255, 0.1);
  color: #ff453a;
}
```

---

## 5. Verification Plan

### 5.1 Automated and API Integration Tests
1. **Sync Operations**:
   * Verify that opening a native Chrome tab automatically inserts it into the temporary list in the sidebar.
   * Verify that closing a temporary tab in the sidebar calls `chrome.tabs.remove(tabId)` and destroys the tab.
2. **Navigation Tracking**:
   * Verify that navigating within a mapped pinned tab triggers `chrome.tabs.onUpdated` and correctly updates the `activeUrl` in `chrome.storage.local`.
   * Verify that clicking the favicon zone navigates the tab back to the `pinnedUrl` and clears the `/` state.

### 5.2 Manual UI Verification
1. **Drag-and-Drop Pinning**:
   * Drag a temporary tab above the divider. Ensure it moves to the pinned section and persists after closing and reopening Chrome.
   * Drag a pinned tab below the divider. Ensure it is deleted from the `pinned_tabs` store and becomes a temporary tab.
2. **Hover Polish**:
   * Verify that the close "x" icon is 100% invisible unless hovering.
   * Verify that the navigated favicon reset capsule aligns flush against the left sidebar panel edge when hovered.
