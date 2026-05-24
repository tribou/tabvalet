# Chrome Vertical Tabs Sidebar (Arc-lite) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Google Chrome side panel extension from scratch that duplicates the classic Arc vertical sidebar with row tabs, drag-to-pin, and "/" navigation reset behaviors.

**Architecture:** A three-part Chrome Extension (manifest.json, background.js service worker, sidepanel.html/js) utilizing the Chrome Extensions API (sidePanel, storage, tabs) to manage state synchronization and dynamic UI rendering.

**Tech Stack:** Modern JavaScript, HTML5 (Drag & Drop), Vanilla CSS with HSL variables.

---

### Task 1: Project Metadata & Manifest (`manifest.json`)

**Files:**
* Create: `manifest.json`

- [ ] **Step 1: Write manifest file**

Write the complete Manifest V3 declaration with sidePanel, storage, and tabs permissions:

```json
{
  "manifest_version": 3,
  "name": "Arc Vertical Tabs Sidebar",
  "version": "1.0.0",
  "description": "Arc-like vertical tabs sidebar in Google Chrome side panel.",
  "permissions": [
    "sidePanel",
    "storage",
    "tabs",
    "contextMenus"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "action": {
    "default_title": "Open Sidebar"
  },
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: Generate default extension icons**

Since we need actual images to load the extension without warnings, write a simple canvas-based helper script to generate standard square icons, run it, and save the output.

Create scratch file: `scratch/generate-icons.js`
```javascript
const fs = require('fs');
const { createCanvas } = require('canvas');

if (!fs.existsSync('icons')) {
  fs.mkdirSync('icons');
}

const sizes = [16, 48, 128];
sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Elegant blue gradient circle
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#0a84ff');
  grad.addColorStop(1, '#0059b3');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // White inner visual slash "/"
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = size / 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(size * 0.35, size * 0.7);
  ctx.lineTo(size * 0.65, size * 0.3);
  ctx.stroke();
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(`icons/icon${size}.png`, buffer);
  console.log(`Generated icons/icon${size}.png`);
});
```

Install node canvas dependency and run icon generator:
Run: `npm install canvas && node scratch/generate-icons.js`
Expected: File writes to `icons/icon16.png`, `icons/icon48.png`, and `icons/icon128.png`.

- [ ] **Step 3: Commit**

Run:
```bash
git add manifest.json icons/
git commit -m "feat: add manifest.json and base branding icons"
```

---

### Task 2: The Service Worker Controller (`background.js`)

**Files:**
* Create: `background.js`

- [ ] **Step 1: Write the background controller code**

Write the background script to monitor tab closures, active window focuses, tab re-openings, and navigation changes:

```javascript
// Map to track active open tabId -> pinnedTabId
let activePinnedTabs = {};

// Handle side panel trigger upon clicking the action icon
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Error setting panel behavior:", error));
  
  // Set default empty pinned tabs database if not initialized
  chrome.storage.local.get(["pinned_tabs"], (result) => {
    if (!result.pinned_tabs) {
      chrome.storage.local.set({ pinned_tabs: [] });
    }
  });
});

// Listener for active tab updates (detect when pinned tab navigates away)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    const pinnedTabId = activePinnedTabs[tabId];
    if (pinnedTabId) {
      chrome.storage.local.get(["pinned_tabs"], (result) => {
        let pinnedTabs = result.pinned_tabs || [];
        const index = pinnedTabs.findIndex(t => t.id === pinnedTabId);
        if (index !== -1) {
          const originalUrl = pinnedTabs[index].pinnedUrl;
          const newUrl = changeInfo.url;
          
          if (newUrl.split('#')[0] !== originalUrl.split('#')[0]) {
            // Tab has navigated away
            pinnedTabs[index].activeUrl = newUrl;
            pinnedTabs[index].activeTitle = tab.title || "Navigated Tab";
          } else {
            // Returned to default URL
            pinnedTabs[index].activeUrl = null;
            pinnedTabs[index].activeTitle = null;
          }
          
          chrome.storage.local.set({ pinned_tabs: pinnedTabs });
        }
      });
    }
  }
});

// Listener for closed tabs (clean up active mapping)
chrome.tabs.onRemoved.addListener((tabId) => {
  const pinnedTabId = activePinnedTabs[tabId];
  if (pinnedTabId) {
    delete activePinnedTabs[tabId];
    
    // Reset navigated properties when pinned tab closes
    chrome.storage.local.get(["pinned_tabs"], (result) => {
      let pinnedTabs = result.pinned_tabs || [];
      const index = pinnedTabs.findIndex(t => t.id === pinnedTabId);
      if (index !== -1) {
        pinnedTabs[index].activeUrl = null;
        pinnedTabs[index].activeTitle = null;
        chrome.storage.local.set({ pinned_tabs: pinnedTabs });
      }
    });
  }
});

// Handle messages from the Sidepanel UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "mapActiveTab") {
    activePinnedTabs[message.tabId] = message.pinnedTabId;
    sendResponse({ success: true });
  } else if (message.action === "unmapActiveTab") {
    // Find key by value and delete
    for (const [tId, pId] of Object.entries(activePinnedTabs)) {
      if (pId === message.pinnedTabId) {
        delete activePinnedTabs[tId];
      }
    }
    sendResponse({ success: true });
  } else if (message.action === "getActiveMap") {
    sendResponse({ activePinnedTabs });
  }
});
```

- [ ] **Step 2: Commit background worker**

Run:
```bash
git add background.js
git commit -m "feat: add background controller service worker"
```

---

### Task 3: The Sidebar HTML & CSS (`sidepanel.html`)

**Files:**
* Create: `sidepanel.html`

- [ ] **Step 1: Write markup & styled theme**

Create the HTML structure containing search, pinned dropzone, edge-to-edge divider, and temporary dropzone, complete with vanilla CSS styling for the Obsidian dark-mode look:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Arc Sidebar</title>
  <style>
    :root {
      --bg-panel: #16161a;
      --bg-sidebar: #121214;
      --border-color: rgba(255, 255, 255, 0.08);
      --text-active: #ffffff;
      --text-muted: #aeaeb2;
      --hover-bg: rgba(255, 255, 255, 0.05);
      --hover-bg-capsule: rgba(255, 255, 255, 0.08);
      --accent: #0a84ff;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg-sidebar);
      color: var(--text-muted);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
    }

    /* Search bar container */
    .search-container {
      padding: 10px 12px 6px 12px;
      flex-shrink: 0;
    }
    .search-input {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 6px 10px;
      width: 100%;
      color: var(--text-active);
      font-size: 0.8rem;
      outline: none;
      transition: border 0.15s;
    }
    .search-input:focus {
      border-color: var(--accent);
    }

    /* Headers */
    .section-header {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      color: #636366;
      letter-spacing: 0.06em;
      padding: 8px 12px 2px 12px;
      flex-shrink: 0;
    }

    /* Scrollable lists */
    .lists-wrapper {
      flex: 1;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }

    /* FULL-BLEED DROPAREA ZONE */
    .drop-zone {
      min-height: 80px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 0 8px;
      transition: background 0.15s;
      background: transparent;
    }
    .drop-zone.drag-over {
      background: rgba(10, 132, 255, 0.06);
    }

    /* Tab row styling */
    .tab-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 38px;
      padding: 0 10px 0 0; /* ZERO left padding to keep click target flush */
      border-radius: 6px;
      background: transparent;
      cursor: grab;
      position: relative;
      overflow: hidden;
      transition: background 0.15s;
    }
    .tab-row:active {
      cursor: grabbing;
    }
    .tab-row:hover {
      background: var(--hover-bg);
    }
    .tab-row.active {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border-color);
      color: var(--text-active);
    }
    .tab-row.active::before {
      content: '';
      position: absolute;
      left: 0;
      top: 20%;
      height: 60%;
      width: 3px;
      background: var(--accent);
      border-radius: 0 4px 4px 0;
    }

    .tab-info {
      display: flex;
      align-items: center;
      height: 100%;
      width: 82%;
      overflow: hidden;
    }

    /* Clickable Favicon button zone */
    .favicon-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 0 12px;
      transition: background 0.15s;
      cursor: pointer;
    }
    .tab-row:not(.navigated) .favicon-wrapper {
      padding-left: 10px;
      cursor: grab;
    }
    .tab-row.navigated .favicon-wrapper {
      border-right: none;
      padding-left: 10px;
      margin-right: 8px;
      cursor: pointer;
    }
    .tab-row.navigated .favicon-wrapper:hover {
      background: var(--hover-bg-capsule);
    }

    .favicon-img {
      width: 16px;
      height: 16px;
      border-radius: 2px;
    }

    /* Arc Slash */
    .arc-slash {
      color: rgba(255, 255, 255, 0.3);
      font-weight: 400;
      font-size: 0.85rem;
      margin-right: 8px;
      user-select: none;
    }

    .tab-title {
      font-size: 0.8rem;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-muted);
      transition: color 0.15s;
    }
    .tab-row:hover .tab-title, .tab-row.active .tab-title {
      color: var(--text-active);
    }

    /* Close Button (Hidden unless hovered) */
    .close-btn {
      opacity: 0;
      background: transparent;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 0.85rem;
      padding: 2px 6px;
      border-radius: 4px;
      transition: opacity 0.15s, background 0.15s, color 0.15s;
    }
    .tab-row:hover .close-btn {
      opacity: 0.7;
    }
    .close-btn:hover {
      opacity: 1 !important;
      background: rgba(255, 255, 255, 0.1);
      color: #ff453a;
    }

    /* CONTINUOUS DIVIDER WITH ZERO VERTICAL GAPS */
    .section-divider {
      border-top: 1px solid var(--border-color);
      margin: 0;
      position: relative;
      height: 1px;
      background: var(--bg-sidebar);
      flex-shrink: 0;
    }
    .section-divider::after {
      content: 'DRAG ABOVE TO PIN';
      position: absolute;
      top: -5px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-sidebar);
      padding: 0 10px;
      font-size: 0.55rem;
      color: rgba(255, 255, 255, 0.25);
      font-weight: 700;
      letter-spacing: 0.08em;
    }

    /* Custom scrollbar */
    .lists-wrapper::-webkit-scrollbar {
      width: 4px;
    }
    .lists-wrapper::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 2px;
    }
  </style>
</head>
<body>
  
  <div class="search-container">
    <input type="text" class="search-input" id="search-bar" placeholder="Search tabs..." />
  </div>

  <div class="lists-wrapper">
    <!-- Pinned Header -->
    <div class="section-header">Pinned Tabs</div>
    
    <!-- Pinned drop area -->
    <div class="drop-zone" id="pinned-zone">
      <!-- Pinned items dynamically generated -->
    </div>

    <!-- Marginless Separation Line -->
    <div class="section-divider"></div>

    <!-- Temporary Header -->
    <div class="section-header" style="padding-top: 6px;">Temporary Tabs</div>
    
    <!-- Temporary drop area -->
    <div class="drop-zone" id="temp-zone">
      <!-- Temporary open items dynamically generated -->
    </div>
  </div>

  <script src="sidepanel.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit Sidebar markup**

Run:
```bash
git add sidepanel.html
git commit -m "feat: add sidepanel.html with continuous dropzone CSS layout"
```

---

### Task 4: The Sidebar Controller Logic (`sidepanel.js`)

**Files:**
* Create: `sidepanel.js`

- [ ] **Step 1: Write sidebar frontend client script**

Write the complete controller script to synchronize states, listen to drag-and-drop actions, support live query search, track favicon-click reset triggers, and render items cleanly:

```javascript
let pinnedTabs = [];
let openTabs = [];
let activePinnedMap = {};
let draggedTabId = null;

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  loadPinnedTabs();
  syncOpenTabs();
  setupDragAndDrop();
  
  // Set up listeners for browser actions
  chrome.tabs.onCreated.addListener(syncOpenTabs);
  chrome.tabs.onRemoved.addListener(syncOpenTabs);
  chrome.tabs.onUpdated.addListener(syncOpenTabs);
  chrome.tabs.onActivated.addListener(syncOpenTabs);
  
  // Watch storage updates to keep Pinned section up to date
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "local" && changes.pinned_tabs) {
      pinnedTabs = changes.pinned_tabs.newValue || [];
      renderPinnedTabs();
    }
  });

  // Query search bar
  document.getElementById("search-bar").addEventListener("input", filterTabs);
});

// Load pinned tabs from storage
function loadPinnedTabs() {
  chrome.storage.local.get(["pinned_tabs"], (result) => {
    pinnedTabs = result.pinned_tabs || [];
    renderPinnedTabs();
  });
}

// Synchronize open tabs representing the current window
function syncOpenTabs() {
  chrome.windows.getCurrent((win) => {
    chrome.tabs.query({ windowId: win.id }, (tabs) => {
      openTabs = tabs;
      
      // Pull the active map from background worker
      chrome.runtime.sendMessage({ action: "getActiveMap" }, (response) => {
        activePinnedMap = response ? response.activePinnedTabs : {};
        renderTemporaryTabs();
        renderPinnedTabs(); // Re-render pinned tabs to ensure active bar matches
      });
    });
  });
}

// Render Pinned Tabs (Grid/List with Favicon reset `/` support)
function renderPinnedTabs() {
  const container = document.getElementById("pinned-zone");
  container.innerHTML = "";
  
  // Sort pinned tabs by order field
  const sorted = [...pinnedTabs].sort((a, b) => a.order - b.order);
  
  sorted.forEach(tab => {
    // Check if there is an active mapped tab in the current window
    let isActive = false;
    let mappedTabId = null;
    
    for (const [tId, pId] of Object.entries(activePinnedMap)) {
      if (pId === tab.id) {
        mappedTabId = parseInt(tId);
        const openTabExists = openTabs.find(o => o.id === mappedTabId);
        if (openTabExists) {
          isActive = openTabExists.active;
        }
        break;
      }
    }
    
    const isNavigated = !!tab.activeUrl;
    const currentTitle = isNavigated ? tab.activeTitle : tab.title;

    const row = document.createElement("div");
    row.className = `tab-row ${isActive ? 'active' : ''} ${isNavigated ? 'navigated' : ''}`;
    row.draggable = true;
    row.id = `pinned-${tab.id}`;
    
    // Set up dragging listeners
    row.addEventListener("dragstart", (e) => {
      draggedTabId = tab.id;
      e.dataTransfer.setData("text/plain", tab.id);
    });
    
    // Tab Activation Click handler
    row.addEventListener("click", (e) => {
      focusOrCreatePinnedTab(tab);
    });

    const info = document.createElement("div");
    info.className = "tab-info";

    // Favicon reset capsule on left
    const favWrapper = document.createElement("div");
    favWrapper.className = "favicon-wrapper";
    if (isNavigated) {
      favWrapper.title = "Click to reset to default URL";
      favWrapper.addEventListener("click", (e) => {
        e.stopPropagation(); // Stop parent row click trigger
        resetPinnedTab(tab, mappedTabId);
      });
    }

    const img = document.createElement("img");
    img.className = "favicon-img";
    img.src = tab.favIconUrl || "https://www.google.com/s2/favicons?domain=chrome.com&sz=32";
    img.onerror = () => { img.src = "https://www.google.com/s2/favicons?domain=chrome.com&sz=32"; };
    favWrapper.appendChild(img);
    info.appendChild(favWrapper);

    // If navigated, append subtle "/" separator
    if (isNavigated) {
      const slash = document.createElement("span");
      slash.className = "arc-slash";
      slash.innerText = "/";
      info.appendChild(slash);
    }

    const titleSpan = document.createElement("span");
    titleSpan.className = "tab-title";
    titleSpan.innerText = currentTitle || "Pinned Tab";
    info.appendChild(titleSpan);
    row.appendChild(info);

    // Close / Unpin Button
    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.innerText = "×";
    closeBtn.title = "Unpin Tab";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      unpinTab(tab.id);
    });
    row.appendChild(closeBtn);

    container.appendChild(row);
  });
}

// Render Temporary Tabs
function renderTemporaryTabs() {
  const container = document.getElementById("temp-zone");
  container.innerHTML = "";

  // Get active mapped open tabs so we don't show pinned tabs in temporary section
  const mappedTabIds = Object.keys(activePinnedMap).map(id => parseInt(id));
  
  const tempTabs = openTabs.filter(tab => !mappedTabIds.includes(tab.id));
  
  tempTabs.forEach(tab => {
    const row = document.createElement("div");
    row.className = `tab-row ${tab.active ? 'active' : ''}`;
    row.draggable = true;
    row.id = `temp-${tab.id}`;
    
    row.addEventListener("dragstart", (e) => {
      draggedTabId = `temp-${tab.id}`;
      e.dataTransfer.setData("text/plain", `temp-${tab.id}`);
    });

    row.addEventListener("click", () => {
      chrome.tabs.update(tab.id, { active: true });
    });

    const info = document.createElement("div");
    info.className = "tab-info";

    const favWrapper = document.createElement("div");
    favWrapper.className = "favicon-wrapper";

    const img = document.createElement("img");
    img.className = "favicon-img";
    img.src = tab.favIconUrl || "https://www.google.com/s2/favicons?domain=chrome.com&sz=32";
    img.onerror = () => { img.src = "https://www.google.com/s2/favicons?domain=chrome.com&sz=32"; };
    favWrapper.appendChild(img);
    info.appendChild(favWrapper);

    const titleSpan = document.createElement("span");
    titleSpan.className = "tab-title";
    titleSpan.innerText = tab.title || "Temporary Tab";
    info.appendChild(titleSpan);
    row.appendChild(info);

    // Close Button (hidden unless hovered, managed by CSS)
    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.innerText = "×";
    closeBtn.title = "Close Tab";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      chrome.tabs.remove(tab.id);
    });
    row.appendChild(closeBtn);

    container.appendChild(row);
  });
}

// Drag & Drop event bindings
function setupDragAndDrop() {
  const zones = [document.getElementById("pinned-zone"), document.getElementById("temp-zone")];
  
  zones.forEach(zone => {
    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.classList.add("drag-over");
    });
    
    zone.addEventListener("dragleave", () => {
      zone.classList.remove("drag-over");
    });
    
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("drag-over");
      
      const id = e.dataTransfer.getData("text/plain");
      const isPinnedZone = zone.id === "pinned-zone";
      
      if (isPinnedZone) {
        // Dragging a temp tab into Pinned zone -> Pin it
        if (id.startsWith("temp-")) {
          const tabId = parseInt(id.replace("temp-", ""));
          pinOpenTab(tabId);
        }
      } else {
        // Dragging a pinned tab into Temp zone -> Unpin it
        if (!id.startsWith("temp-")) {
          unpinTab(id);
        }
      }
    });
  });
}

// Pin an active temporary tab
function pinOpenTab(tabId) {
  const tab = openTabs.find(o => o.id === tabId);
  if (!tab) return;
  
  const newPinned = {
    id: Date.now().toString(),
    pinnedUrl: tab.url,
    activeUrl: null,
    title: tab.title,
    activeTitle: null,
    favIconUrl: tab.favIconUrl,
    order: pinnedTabs.length
  };
  
  pinnedTabs.push(newPinned);
  chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
    // Map the active open tabId to the new pinned tab's ID
    chrome.runtime.sendMessage({
      action: "mapActiveTab",
      tabId: tabId,
      pinnedTabId: newPinned.id
    }, () => {
      syncOpenTabs();
    });
  });
}

// Unpin a tab (moving it below the divider, making it temporary)
function unpinTab(pinnedTabId) {
  const index = pinnedTabs.findIndex(t => t.id === pinnedTabId);
  if (index === -1) return;
  
  pinnedTabs.splice(index, 1);
  chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
    // Notify background worker to unmap active tabs
    chrome.runtime.sendMessage({
      action: "unmapActiveTab",
      pinnedTabId: pinnedTabId
    }, () => {
      syncOpenTabs();
    });
  });
}

// Focus an existing open tab representing a pinned tab or open a new one
function focusOrCreatePinnedTab(pinnedTab) {
  // Check if already mapped
  let existingTabId = null;
  for (const [tId, pId] of Object.entries(activePinnedMap)) {
    if (pId === pinnedTab.id) {
      existingTabId = parseInt(tId);
      break;
    }
  }
  
  if (existingTabId && openTabs.some(o => o.id === existingTabId)) {
    chrome.tabs.update(existingTabId, { active: true });
  } else {
    // Open new tab at either navigated or default URL
    const targetUrl = pinnedTab.activeUrl || pinnedTab.pinnedUrl;
    chrome.tabs.create({ url: targetUrl }, (newTab) => {
      chrome.runtime.sendMessage({
        action: "mapActiveTab",
        tabId: newTab.id,
        pinnedTabId: pinnedTab.id
      }, () => {
        syncOpenTabs();
      });
    });
  }
}

// Reset navigated pinned tab back to its default bookmark URL
function resetPinnedTab(pinnedTab, tabId) {
  const index = pinnedTabs.findIndex(t => t.id === pinnedTab.id);
  if (index === -1) return;
  
  pinnedTabs[index].activeUrl = null;
  pinnedTabs[index].activeTitle = null;
  
  chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
    if (tabId) {
      chrome.tabs.update(tabId, { url: pinnedTab.pinnedUrl }, () => {
        syncOpenTabs();
      });
    } else {
      syncOpenTabs();
    }
  });
}

// Live query filter list
function filterTabs() {
  const query = document.getElementById("search-bar").value.toLowerCase();
  const rows = document.querySelectorAll(".tab-row");
  
  rows.forEach(row => {
    const title = row.querySelector(".tab-title").innerText.toLowerCase();
    if (title.includes(query)) {
      row.style.display = "flex";
    } else {
      row.style.display = "none";
    }
  });
}
```

- [ ] **Step 2: Commit Sidebar Controller Logic**

Run:
```bash
git add sidepanel.js
git commit -m "feat: add sidepanel.js state sync and drag-to-pin controller"
```

---

### Task 5: Manual UI Polish & Verification

**Files:**
* Review: `manifest.json`, `background.js`, `sidepanel.html`, `sidepanel.js`

- [ ] **Step 1: Verify layout drops and continuous margins**
  Open the extensions manager `chrome://extensions`, enable **Developer mode**, and click **Load unpacked** to load our project directory.
  
  Verify:
  1. Clicking the extension icon opens the side panel sidebar.
  2. Dragging tabs up and down across the divider pins and unpins them smoothly.
  3. Continuous margins have no visible gap above/below the divider line.
  
- [ ] **Step 2: Verify Arc slash `/` navigation reset**
  1. Pin a tab (e.g., `https://news.ycombinator.com`).
  2. Click a link in that tab to navigate away.
  3. Confirm that the navigated indicator `/` appears next to the favicon.
  4. Hover on the favicon block. Ensure the borderless highlight `rgba(255,255,255,0.08)` fills the vertical block on the left edge.
  5. Click the favicon area. Verify the tab navigates back to `https://news.ycombinator.com` and the `/` resets.

- [ ] **Step 3: Commit final updates and validation logs**

Create verification log `walkthrough.md` indicating successful tests and clean styling.
```bash
git add walkthrough.md
git commit -m "docs: finalize verification walkthrough and confirm UI tests pass"
```
