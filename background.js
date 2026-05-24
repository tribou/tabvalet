// Map to track active open tabId -> pinnedTabId (using hybrid sync-async pattern)
let activePinnedTabs = {};

// Synchronize mapping cache from session storage on startup
chrome.storage.session.get(["active_pinned_tabs"], (result) => {
  activePinnedTabs = result.active_pinned_tabs || {};
});

// Map an active open tabId to a pinned tab
function mapActiveTab(tabId, pinnedTabId) {
  const tKey = String(tabId);
  activePinnedTabs[tKey] = pinnedTabId;
  chrome.storage.session.set({ active_pinned_tabs: activePinnedTabs });
}

// Unmap active tabs for a specific pinned tab ID
function unmapActiveTab(pinnedTabId) {
  let updated = false;
  for (const [tKey, pId] of Object.entries(activePinnedTabs)) {
    if (pId === pinnedTabId) {
      delete activePinnedTabs[tKey];
      updated = true;
    }
  }
  if (updated) {
    chrome.storage.session.set({ active_pinned_tabs: activePinnedTabs });
  }
}

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
  if (changeInfo.url || changeInfo.title) {
    const tKey = String(tabId);
    const pinnedTabId = activePinnedTabs[tKey];
    if (pinnedTabId) {
      chrome.storage.local.get(["pinned_tabs"], (result) => {
        let pinnedTabs = result.pinned_tabs || [];
        const index = pinnedTabs.findIndex(t => t.id === pinnedTabId);
        if (index !== -1) {
          let updated = false;

          if (changeInfo.url) {
            const originalUrl = pinnedTabs[index].pinnedUrl;
            const newUrl = changeInfo.url;

            if (typeof originalUrl === 'string' && typeof newUrl === 'string') {
              if (newUrl.split('#')[0] !== originalUrl.split('#')[0]) {
                pinnedTabs[index].activeUrl = newUrl;
                pinnedTabs[index].activeTitle = tab.title || "Navigated Tab";
              } else {
                pinnedTabs[index].activeUrl = null;
                pinnedTabs[index].activeTitle = null;
              }
              updated = true;
            }
          }

          if (changeInfo.title && pinnedTabs[index].activeUrl) {
            pinnedTabs[index].activeTitle = changeInfo.title;
            updated = true;
          }

          if (updated) {
            chrome.storage.local.set({ pinned_tabs: pinnedTabs });
          }
        }
      });
    }
  }
});

// Listener for closed tabs (clean up active mapping)
chrome.tabs.onRemoved.addListener((tabId) => {
  const tKey = String(tabId);
  const pinnedTabId = activePinnedTabs[tKey];
  
  if (pinnedTabId) {
    delete activePinnedTabs[tKey];
    chrome.storage.session.set({ active_pinned_tabs: activePinnedTabs });
    
    // Check if there are other open tabs still representing this pinned tab
    const hasOtherMappedTabs = Object.entries(activePinnedTabs).some(
      ([openTabId, pId]) => pId === pinnedTabId && openTabId !== tKey
    );
    
    if (!hasOtherMappedTabs) {
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
  }
});

// Handle messages from the Sidepanel UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "mapActiveTab") {
    mapActiveTab(message.tabId, message.pinnedTabId);
    sendResponse({ success: true });
  } else if (message.action === "unmapActiveTab") {
    unmapActiveTab(message.pinnedTabId);
    sendResponse({ success: true });
  } else if (message.action === "getActiveMap") {
    sendResponse({ activePinnedTabs });
  }
});
