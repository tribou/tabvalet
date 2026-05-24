// Retrieve the active pinned tab mapping from session storage
function getActiveMap() {
  return new Promise((resolve) => {
    chrome.storage.session.get(["active_pinned_tabs"], (result) => {
      resolve(result.active_pinned_tabs || {});
    });
  });
}

// Save the active pinned tab mapping to session storage
function setActiveMap(map) {
  return new Promise((resolve) => {
    chrome.storage.session.set({ active_pinned_tabs: map }, () => {
      resolve();
    });
  });
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
    getActiveMap().then((activePinnedTabs) => {
      const pinnedTabId = activePinnedTabs[tabId];
      if (pinnedTabId) {
        chrome.storage.local.get(["pinned_tabs"], (result) => {
          let pinnedTabs = result.pinned_tabs || [];
          const index = pinnedTabs.findIndex(t => t.id === pinnedTabId);
          if (index !== -1) {
            let updated = false;

            if (changeInfo.url) {
              const originalUrl = pinnedTabs[index].pinnedUrl;
              const newUrl = changeInfo.url;

              if (newUrl.split('#')[0] !== originalUrl.split('#')[0]) {
                pinnedTabs[index].activeUrl = newUrl;
                pinnedTabs[index].activeTitle = tab.title || "Navigated Tab";
              } else {
                pinnedTabs[index].activeUrl = null;
                pinnedTabs[index].activeTitle = null;
              }
              updated = true;
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
    });
  }
});

// Listener for closed tabs (clean up active mapping)
chrome.tabs.onRemoved.addListener((tabId) => {
  getActiveMap().then((activePinnedTabs) => {
    const pinnedTabId = activePinnedTabs[tabId];
    if (pinnedTabId) {
      delete activePinnedTabs[tabId];
      setActiveMap(activePinnedTabs).then(() => {
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
      });
    }
  });
});

// Handle messages from the Sidepanel UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "mapActiveTab") {
    getActiveMap().then((activePinnedTabs) => {
      activePinnedTabs[message.tabId] = message.pinnedTabId;
      setActiveMap(activePinnedTabs).then(() => {
        sendResponse({ success: true });
      });
    });
    return true; // Keep the message channel open for asynchronous response
  } else if (message.action === "unmapActiveTab") {
    getActiveMap().then((activePinnedTabs) => {
      // Find key by value and delete
      for (const [tId, pId] of Object.entries(activePinnedTabs)) {
        if (pId === message.pinnedTabId) {
          delete activePinnedTabs[tId];
        }
      }
      setActiveMap(activePinnedTabs).then(() => {
        sendResponse({ success: true });
      });
    });
    return true; // Keep the message channel open for asynchronous response
  } else if (message.action === "getActiveMap") {
    getActiveMap().then((activePinnedTabs) => {
      sendResponse({ activePinnedTabs });
    });
    return true; // Keep the message channel open for asynchronous response
  }
});
