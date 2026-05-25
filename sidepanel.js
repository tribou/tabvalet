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
      let mapUpdated = false;
      const mappedPinnedIds = [];
      
      // 1. Identify which pinned tabs are already mapped to open tabs in the current window
      for (const [tId, pId] of Object.entries(activePinnedMap)) {
        const tIdNum = parseInt(tId);
        if (openTabs.some(o => o.id === tIdNum)) {
          mappedPinnedIds.push(pId);
        }
      }
      
      // 2. Scan unmapped open tabs and match them to unmapped pinned tabs by URL
      openTabs.forEach(openTab => {
        const openTabIdStr = openTab.id.toString();
        if (activePinnedMap[openTabIdStr] === undefined) {
          const match = pinnedTabs.find(pTab => {
            // Must not be already mapped to an open tab in this window
            if (mappedPinnedIds.includes(pTab.id)) return false;
            
            const openUrl = openTab.url;
            const pinnedUrl = pTab.pinnedUrl;
            const activeUrl = pTab.activeUrl;
            
            if (!openUrl || !pinnedUrl) return false;
            
            // Normalize URLs by removing query parameters and hashes for comparison
            const normOpen = openUrl.split('?')[0].split('#')[0].replace(/\/$/, "");
            const normPinned = pinnedUrl.split('?')[0].split('#')[0].replace(/\/$/, "");
            const normActive = activeUrl ? activeUrl.split('?')[0].split('#')[0].replace(/\/$/, "") : null;
            
            return normOpen === normPinned || normOpen === normActive;
          });
          
          if (match) {
            activePinnedMap[openTabIdStr] = match.id;
            mappedPinnedIds.push(match.id);
            
            // Persist the mapping to the background worker session state
            chrome.runtime.sendMessage({
              action: "mapActiveTab",
              tabId: openTab.id,
              pinnedTabId: match.id
            });
            
            mapUpdated = true;
          }
        }
      });
      
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
      e.dataTransfer.setData("text/plain", `temp-${tab.id}`);
      e.dataTransfer.effectAllowed = "move";
      setTimeout(() => row.classList.add("dragging"), 0);
    });

    row.addEventListener("dragover", (e) => {
      if (row.classList.contains("dragging")) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
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
    titleSpan.innerText = tab.title || "Temporary Tab";
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
  const sections = [
    {
      container: document.getElementById("pinned-section"),
      isPinned: true
    },
    {
      container: document.getElementById("temp-section"),
      isPinned: false
    }
  ];
  
  sections.forEach(({ container, isPinned }) => {
    container.addEventListener("dragover", (e) => {
      e.preventDefault();
    });
    
    container.addEventListener("drop", (e) => {
      e.preventDefault();
      
      const id = e.dataTransfer.getData("text/plain");
      if (!id) return;
      
      if (isPinned) {
        // Dragging a temp tab into Pinned zone -> Pin it
        if (id.startsWith("temp-")) {
          const tabId = parseInt(id.replace("temp-", ""));
          pinOpenTab(tabId);
        }
      } else {
        // Dragging a pinned tab into Temp zone -> Unpin it
        if (!id.startsWith("temp-")) {
          const cleanId = id.replace("pinned-", "");
          unpinTab(cleanId);
        }
      }
    });
  });
  
  // Document-level safety net to clean up any stuck drag states
  document.addEventListener("dragend", () => {
    clearDragClasses();
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
