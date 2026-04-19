document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('configBtn').addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });

  const masterToggleContainer = document.getElementById('masterToggleContainer');
  const masterToggle = document.getElementById('masterToggle');

  chrome.storage.sync.get(['extensionActive', 'showMasterToggle', 'isDarkMode'], (result) => {
    // Check Dark Mode
    if (result.isDarkMode) {
      document.documentElement.classList.add('dark-mode');
      document.querySelector('.icon').src = '../assets/icon-dark.png';
    }
  
    const showToggle = result.showMasterToggle !== false; // default true
    if (showToggle) {
      masterToggleContainer.style.display = 'flex';
      masterToggle.checked = result.extensionActive !== false; // default true
    }
  });

  masterToggle.addEventListener('change', (e) => {
    chrome.storage.sync.set({ extensionActive: e.target.checked });
  });
});
