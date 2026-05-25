import { calculateTabMappings, reorderPinnedTabsList, calculateTempTabTargetIndex } from './src/logic/tab-manager.js';
import { normalizeUrl } from './src/utils/url.js';

let pinnedTabs = [];
let openTabs = [];
let activePinnedMap = {};
let currentWindowId = null;

// Initialize on page load
document.addEventListener("DOMContentLoaded", () => {
  chrome.windows.getCurrent((win) => {
    if (!win) return;
    currentWindowId = win.id;
    
    loadPinnedTabs();
    syncOpenTabs();
    setupDragAndDrop();
    
    // Set up window-isolated listeners
    chrome.tabs.onCreated.addListener((tab) => {
      if (tab.windowId === currentWindowId) syncOpenTabs();
    });
    
    chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
      if (removeInfo.windowId === currentWindowId) syncOpenTabs();
    });
    
    chrome.tabs.onActivated.addListener((activeInfo) => {
      if (activeInfo.windowId === currentWindowId) syncOpenTabs();
    });
    
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (tab.windowId === currentWindowId) {
        // Only trigger sync on meaningful, complete, or visual updates
        if (changeInfo.status === "complete" || changeInfo.title || changeInfo.favIconUrl || changeInfo.url) {
          syncOpenTabs();
        }
      }
    });

    // Watch storage updates to keep Pinned section up to date
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === "local" && changes.pinned_tabs) {
        pinnedTabs = changes.pinned_tabs.newValue || [];
        renderPinnedTabs();
      }
    });
  });
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
  if (currentWindowId === null) return;
  chrome.tabs.query({ windowId: currentWindowId }, (tabs) => {
    openTabs = tabs;
    
    // Pull the active map from background worker
    chrome.runtime.sendMessage({ action: "getActiveMap" }, (response) => {
      activePinnedMap = response ? response.activePinnedTabs : {};
      
      // Auto-map open tabs to pinned tabs by matching URLs if not already mapped
      const nextMap = calculateTabMappings(openTabs, pinnedTabs, activePinnedMap);
      
      // Persist any newly added mappings to service worker
      for (const [tId, pId] of Object.entries(nextMap)) {
        if (activePinnedMap[tId] === undefined) {
          chrome.runtime.sendMessage({
            action: "mapActiveTab",
            tabId: parseInt(tId),
            pinnedTabId: pId
          });
        }
      }
      
      activePinnedMap = nextMap;
      
      renderTemporaryTabs();
      renderPinnedTabs();
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
    let isActive = false;
    let mappedTabId = null;
    
    for (const [tId, pId] of Object.entries(activePinnedMap)) {
      if (pId === tab.id) {
        const tIdNum = parseInt(tId);
        const openTabExists = openTabs.find(o => o.id === tIdNum);
        if (openTabExists) {
          mappedTabId = tIdNum;
          isActive = openTabExists.active;
          break; // Only break when matched to an open tab in the current window
        }
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
      e.dataTransfer.setData("text/plain", `pinned-${tab.id}`);
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => row.classList.add("dragging"), 0);
    });
    
    row.addEventListener("dragover", (e) => {
      if (row.classList.contains("dragging")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Clear drag indicators on other rows to ensure only a single target line renders
      document.querySelectorAll(".tab-row").forEach(el => {
        if (el !== row) {
          el.classList.remove("drag-before", "drag-after");
        }
      });

      const rect = row.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      if (relY < rect.height / 2) {
        row.classList.add("drag-before");
        row.classList.remove("drag-after");
      } else {
        row.classList.add("drag-after");
        row.classList.remove("drag-before");
      }
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-before", "drag-after");
    });

    row.addEventListener("dragend", () => {
      clearDragClasses();
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
    closeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
    closeBtn.title = "Unpin Tab";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      unpinTab(tab.id);
    });
    row.appendChild(closeBtn);

    container.appendChild(row);
  });
}

// Render Normal Tabs
function renderTemporaryTabs() {
  const container = document.getElementById("temp-zone");
  container.innerHTML = "";

  // Get active mapped open tabs so we don't show pinned tabs in normal section
  const mappedTabIds = Object.keys(activePinnedMap).map(id => parseInt(id));
  
  const tempTabs = openTabs.filter(tab => !mappedTabIds.includes(tab.id));
  
  tempTabs.forEach(tab => {
    const row = document.createElement("div");
    row.className = `tab-row ${tab.active ? 'active' : ''}`;
    row.draggable = true;
    row.id = `temp-${tab.id}`;
    
    row.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", `temp-${tab.id}`);
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => row.classList.add("dragging"), 0);
    });

    row.addEventListener("dragover", (e) => {
      if (row.classList.contains("dragging")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      // Clear drag indicators on other rows to ensure only a single target line renders
      document.querySelectorAll(".tab-row").forEach(el => {
        if (el !== row) {
          el.classList.remove("drag-before", "drag-after");
        }
      });

      const rect = row.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      if (relY < rect.height / 2) {
        row.classList.add("drag-before");
        row.classList.remove("drag-after");
      } else {
        row.classList.add("drag-after");
        row.classList.remove("drag-before");
      }
    });

    row.addEventListener("dragleave", () => {
      row.classList.remove("drag-before", "drag-after");
    });

    row.addEventListener("dragend", () => {
      clearDragClasses();
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
    titleSpan.innerText = tab.title || "Normal Tab";
    info.appendChild(titleSpan);
    row.appendChild(info);

    // Close Button (hidden unless hovered, managed by CSS)
    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
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
  const pinnedSection = document.getElementById("pinned-section");
  const tempSection = document.getElementById("temp-section");

  // Container dragover & drop listeners for general section zones (e.g. dropping at empty/end)
  [pinnedSection, tempSection].forEach(section => {
    const isPinned = section.id === "pinned-section";

    section.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    section.addEventListener("drop", (e) => {
      // Avoid handling the drop if it occurred on a specific tab row (let document drop handler handle it)
      if (e.target.closest(".tab-row")) return;

      // Prevent event bubbling if a specific tab drop handled it already
      if (e.defaultPrevented) return;
      e.preventDefault();
      
      const dragId = e.dataTransfer.getData("text/plain");
      if (!dragId || (!dragId.startsWith("temp-") && !dragId.startsWith("pinned-"))) return;
      clearDragClasses();

      if (isPinned) {
        // Append to end of Pinned section
        if (dragId.startsWith("temp-")) {
          const tabId = parseInt(dragId.replace("temp-", ""));
          pinOpenTab(tabId, pinnedTabs.length);
        } else {
          const pinnedId = dragId.replace("pinned-", "");
          reorderPinnedTab(pinnedId, null, "after");
        }
      } else {
        // Append to end of Normal section
        if (!dragId.startsWith("temp-")) {
          const pinnedId = dragId.replace("pinned-", "");
          unpinTab(pinnedId, openTabs.length);
        } else {
          const tabId = parseInt(dragId.replace("temp-", ""));
          chrome.tabs.move(tabId, { windowId: currentWindowId, index: -1 });
        }
      }
    });
  });

  // Delegate drop listeners to dynamic tab rows
  document.addEventListener("drop", (e) => {
    const targetRow = e.target.closest(".tab-row");
    if (!targetRow) return;

    e.preventDefault();
    e.stopPropagation();

    const dragId = e.dataTransfer.getData("text/plain");
    if (!dragId || (!dragId.startsWith("temp-") && !dragId.startsWith("pinned-"))) return;
    
    const isDragBefore = targetRow.classList.contains("drag-before");
    const relativePosition = isDragBefore ? "before" : "after";
    
    clearDragClasses();

    const isTargetPinned = targetRow.id.startsWith("pinned-");
    const targetId = targetRow.id.replace("pinned-", "").replace("temp-", "");

    if (isTargetPinned) {
      // Target is in the Pinned section
      if (dragId.startsWith("temp-")) {
        // Cross-section Temp -> Pinned drop at precise position
        const tabId = parseInt(dragId.replace("temp-", ""));
        pinOpenTabAtPosition(tabId, targetId, relativePosition);
      } else {
        // Pinned -> Pinned reorder at precise position
        const pinnedId = dragId.replace("pinned-", "");
        reorderPinnedTab(pinnedId, targetId, relativePosition);
      }
    } else {
      // Target is in the Temp section
      const targetTabId = parseInt(targetId);
      if (!dragId.startsWith("temp-")) {
        // Cross-section Pinned -> Temp drop at precise position
        const pinnedId = dragId.replace("pinned-", "");
        unpinTabAtPosition(pinnedId, targetTabId, relativePosition);
      } else {
        // Temp -> Temp reorder at precise position
        const tabId = parseInt(dragId.replace("temp-", ""));
        reorderTempTab(tabId, targetTabId, relativePosition);
      }
    }
  });

  // Document-level safety net to clean up any stuck drag states
  document.addEventListener("dragend", () => {
    clearDragClasses();
  });
}

// Pin an active normal tab
function pinOpenTab(tabId, orderIndex) {
  const tab = openTabs.find(o => o.id === tabId);
  if (!tab) return;
  
  const newPinned = {
    id: Date.now().toString(),
    pinnedUrl: tab.url,
    activeUrl: null,
    title: tab.title,
    activeTitle: null,
    favIconUrl: tab.favIconUrl,
    order: orderIndex !== undefined ? orderIndex : pinnedTabs.length
  };
  
  pinnedTabs.push(newPinned);
  // Sort and re-index
  pinnedTabs.sort((a, b) => a.order - b.order);
  pinnedTabs.forEach((t, i) => { t.order = i; });

  chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
    chrome.runtime.sendMessage({
      action: "mapActiveTab",
      tabId: tabId,
      pinnedTabId: newPinned.id
    }, () => {
      syncOpenTabs();
    });
  });
}

// Unpin a tab
function unpinTab(pinnedTabId, targetIndex) {
  const index = pinnedTabs.findIndex(t => t.id === pinnedTabId);
  if (index === -1) return;
  
  const pinnedTab = pinnedTabs[index]; // Save reference
  pinnedTabs.splice(index, 1);
  pinnedTabs.forEach((t, i) => { t.order = i; });

  chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
    chrome.runtime.sendMessage({
      action: "unmapActiveTab",
      pinnedTabId: pinnedTabId
    }, () => {
      if (targetIndex !== undefined) {
        let mappedTabId = null;
        for (const [tId, pId] of Object.entries(activePinnedMap)) {
          if (pId === pinnedTabId) {
            mappedTabId = parseInt(tId);
            break;
          }
        }
        if (mappedTabId) {
          chrome.tabs.move(mappedTabId, { windowId: currentWindowId, index: targetIndex }, () => {
            syncOpenTabs();
          });
        } else {
          chrome.tabs.create({ windowId: currentWindowId, url: pinnedTab.pinnedUrl, index: targetIndex }, () => {
            syncOpenTabs();
          });
        }
        return;
      }
      syncOpenTabs();
    });
  });
}

// Reorder within Pinned section
function reorderPinnedTab(draggedId, targetId, position) {
  if (draggedId === targetId) return;

  pinnedTabs = reorderPinnedTabsList(pinnedTabs, draggedId, targetId, position);

  chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
    syncOpenTabs();
  });
}

// Pin open tab at precise position
function pinOpenTabAtPosition(tabId, targetPinnedId, position) {
  const tab = openTabs.find(o => o.id === tabId);
  if (!tab) return;

  let targetIndex = pinnedTabs.length;
  const idx = pinnedTabs.findIndex(t => t.id === targetPinnedId);
  if (idx !== -1) {
    targetIndex = position === "before" ? idx : idx + 1;
  }

  const newPinned = {
    id: Date.now().toString(),
    pinnedUrl: tab.url,
    activeUrl: null,
    title: tab.title,
    activeTitle: null,
    favIconUrl: tab.favIconUrl,
    order: targetIndex
  };

  pinnedTabs.splice(targetIndex, 0, newPinned);

  // Reassign orders
  pinnedTabs.forEach((t, i) => {
    t.order = i;
  });

  chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
    chrome.runtime.sendMessage({
      action: "mapActiveTab",
      tabId: tabId,
      pinnedTabId: newPinned.id
    }, () => {
      syncOpenTabs();
    });
  });
}

// Reorder within Normal section
function reorderTempTab(draggedTabId, targetTabId, position) {
  const draggedTab = openTabs.find(t => t.id === draggedTabId);
  const targetTab = openTabs.find(t => t.id === targetTabId);
  if (!draggedTab || !targetTab) return;

  if (draggedTabId === targetTabId) return; // Prevent self-drop API calls

  const targetIndex = calculateTempTabTargetIndex(draggedTab, targetTab, position);

  chrome.tabs.move(draggedTabId, { windowId: currentWindowId, index: targetIndex }, () => {
    syncOpenTabs();
  });
}

// Unpin a tab and drop it at a precise normal tab position
function unpinTabAtPosition(pinnedTabId, targetTabId, position) {
  const index = pinnedTabs.findIndex(t => t.id === pinnedTabId);
  if (index === -1) return;

  const pinnedTab = pinnedTabs[index]; // Save reference first
  pinnedTabs.splice(index, 1);
  
  // Recalculate orders of remaining pinned tabs
  pinnedTabs.forEach((t, i) => {
    t.order = i;
  });

  chrome.storage.local.set({ pinned_tabs: pinnedTabs }, () => {
    chrome.runtime.sendMessage({
      action: "unmapActiveTab",
      pinnedTabId: pinnedTabId
    }, () => {
      chrome.tabs.get(targetTabId, (targetTab) => {
        if (chrome.runtime.lastError || !targetTab) {
          syncOpenTabs();
          return;
        }

        let targetIndex = targetTab.index;
        if (position === "after") {
          targetIndex += 1;
        }

        let mappedTabId = null;
        for (const [tId, pId] of Object.entries(activePinnedMap)) {
          if (pId === pinnedTabId) {
            mappedTabId = parseInt(tId);
            break;
          }
        }

        if (mappedTabId) {
          chrome.tabs.move(mappedTabId, { windowId: currentWindowId, index: targetIndex }, () => {
            syncOpenTabs();
          });
        } else {
          // Open new tab at target index in window for inactive pinned tab
          chrome.tabs.create({ windowId: currentWindowId, url: pinnedTab.pinnedUrl, index: targetIndex }, () => {
            syncOpenTabs();
          });
        }
      });
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
    chrome.tabs.create({ windowId: currentWindowId, url: targetUrl }, (newTab) => {
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
        if (chrome.runtime.lastError) {
          console.warn("Could not update tab: tab may have been closed abruptly.");
        }
        syncOpenTabs();
      });
    } else {
      syncOpenTabs();
    }
  });
}

function clearDragClasses() {
  document.querySelectorAll(".tab-row").forEach(el => {
    el.classList.remove("dragging", "drag-before", "drag-after");
  });
}

// Expose functions on the global window object for E2E tests
window.reorderPinnedTab = reorderPinnedTab;
window.reorderTempTab = reorderTempTab;
