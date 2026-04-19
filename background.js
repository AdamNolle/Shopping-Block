let whitelist = [];
let customSites = [];
let extensionActive = true;

// Load the current whitelist and custom sites into memory on startup
chrome.storage.sync.get(["whitelist", "customSites", "extensionActive", "isDarkMode"], (result) => {
  whitelist = result.whitelist || [];
  customSites = result.customSites || [];
  extensionActive = result.extensionActive !== false;
  
  if (result.isDarkMode) {
    chrome.action.setIcon({
      path: {
        "16": "assets/icon-16-dark.png",
        "48": "assets/icon-48-dark.png",
        "128": "assets/icon-128-dark.png"
      }
    });
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getSettings') {
        chrome.storage.sync.get(['whitelist', 'thinkDuration'], (result) => {
            sendResponse(result);
        });
        return true; // Keep channel open for async response
    }
});

// Listen for updates from the options page
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync') {
    if (changes.whitelist) {
      whitelist = changes.whitelist.newValue || [];
    }
    if (changes.customSites) {
      customSites = changes.customSites.newValue || [];
    }
    if (changes.extensionActive) {
      extensionActive = changes.extensionActive.newValue !== false;
    }
    if (changes.isDarkMode) {
      const isDark = changes.isDarkMode.newValue;
      chrome.action.setIcon({
        path: {
          "16": `assets/icon-16${isDark ? '-dark' : ''}.png`,
          "48": `assets/icon-48${isDark ? '-dark' : ''}.png`,
          "128": `assets/icon-128${isDark ? '-dark' : ''}.png`
        }
      });
    }
  }
});

// Intercept navigations
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (!extensionActive) return;
  
  // Only target main frame navigations (frameId 0)
  if (details.frameId === 0) {
    let url;
    try {
      url = new URL(details.url);
    } catch (e) {
      return;
    }

    const hostname = url.hostname.toLowerCase();
    
    // ONLY close tabs instantly for the "Full Block List" (customSites)
    const isCustomBlocked = customSites.some(domain => 
      hostname === domain || hostname.endsWith("." + domain)
    );

    if (isCustomBlocked) {
      // Check whitelist - whitelist overrides block list
      const isWhitelisted = whitelist.some(w => hostname === w || hostname.endsWith("." + w));
      if (!isWhitelisted) {
        chrome.tabs.remove(details.tabId).catch(() => {});
      }
    }
  }
});
