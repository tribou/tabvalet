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
