let pinnedTabs = [];
let openTabs = [];
let activePinnedMap = {};

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
    if (!win) return;
    chrome.tabs.query({ windowId: win.id }, (tabs) => {
      openTabs = tabs;
      
      // Pull the active map from background worker
      chrome.runtime.sendMessage({ action: "getActiveMap" }, (response) => {
        activePinnedMap = response ? response.activePinnedTabs : {};
        renderTemporaryTabs();
        renderPinnedTabs(); // Re-render pinned tabs to ensure active indicators match
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
    const titleSpan = row.querySelector(".tab-title");
    if (!titleSpan) return;
    const title = titleSpan.innerText.toLowerCase();
    if (title.includes(query)) {
      row.style.display = "flex";
    } else {
      row.style.display = "none";
    }
  });
}
