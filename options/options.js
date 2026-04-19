
let whitelist = [];
let customSites = [];

document.addEventListener('DOMContentLoaded', () => {
  // Load current whitelist, custom sites, and globally active settings from storage
  chrome.storage.sync.get(['whitelist', 'customSites', 'showMasterToggle', 'isDarkMode', 'thinkDuration'], (result) => {
    whitelist = result.whitelist || [];
    customSites = result.customSites || [];
    const thinkDuration = result.thinkDuration || 30;
    
    // Apply Dark Mode directly on load
    const applyDarkTheme = (isDark) => {
      if (isDark) {
        document.documentElement.classList.add('dark-mode');
        document.querySelector('.nav-icon').src = '../assets/icon-dark.png';
      } else {
        document.documentElement.classList.remove('dark-mode');
        document.querySelector('.nav-icon').src = '../assets/icon.png';
      }
    };
    
    applyDarkTheme(result.isDarkMode === true);
    
    const darkToggle = document.getElementById('darkModeSetting');
    if (darkToggle) {
      darkToggle.checked = result.isDarkMode === true;
      darkToggle.addEventListener('change', (e) => {
        applyDarkTheme(e.target.checked);
        chrome.storage.sync.set({ isDarkMode: e.target.checked });
      });
    }

    // Set up global settings toggle
    const toggleSetting = document.getElementById('showMasterToggleSetting');
    if (toggleSetting) {
      toggleSetting.checked = result.showMasterToggle !== false;
      toggleSetting.addEventListener('change', (e) => {
        chrome.storage.sync.set({ showMasterToggle: e.target.checked });
      });
    }

    // Set up countdown duration setting
    const durationInputs = {
      weeks: document.getElementById('weeksInput'),
      days: document.getElementById('daysInput'),
      hours: document.getElementById('hoursInput'),
      minutes: document.getElementById('minutesInput'),
      seconds: document.getElementById('secondsInput')
    };

    const updateDurationFromInputs = () => {
      const w = parseInt(durationInputs.weeks.value) || 0;
      const d = parseInt(durationInputs.days.value) || 0;
      const h = parseInt(durationInputs.hours.value) || 0;
      const m = parseInt(durationInputs.minutes.value) || 0;
      const s = parseInt(durationInputs.seconds.value) || 0;
      
      const totalSeconds = (w * 604800) + (d * 86400) + (h * 3600) + (m * 60) + s;
      chrome.storage.sync.set({ thinkDuration: totalSeconds });
    };

    // Initialize inputs from total seconds
    let remaining = thinkDuration;
    durationInputs.weeks.value = Math.floor(remaining / 604800) || '';
    remaining %= 604800;
    durationInputs.days.value = Math.floor(remaining / 86400) || '';
    remaining %= 86400;
    durationInputs.hours.value = Math.floor(remaining / 3600) || '';
    remaining %= 3600;
    durationInputs.minutes.value = Math.floor(remaining / 60) || '';
    durationInputs.seconds.value = remaining % 60 || '';

    Object.values(durationInputs).forEach(input => {
      input.addEventListener('change', updateDurationFromInputs);
      input.addEventListener('input', updateDurationFromInputs);
    });

    document.getElementById('resetDurationBtn').addEventListener('click', () => {
      Object.values(durationInputs).forEach(input => input.value = '');
      chrome.storage.sync.set({ thinkDuration: 0 });
    });

    renderCategories();
  });


  document.getElementById('addSiteBtn').addEventListener('click', handleAddCustomSite);
  document.getElementById('customSiteInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleAddCustomSite();
  });
});

function handleAddCustomSite() {
  const input = document.getElementById('customSiteInput');
  let domain = input.value.trim().toLowerCase();
  
  if (!domain) return;
  
  // Basic URL cleaning if they accidentally paste a full URL
  try {
    if (domain.startsWith('http')) {
      domain = new URL(domain).hostname;
    }
  } catch(e) {}
  
  // Remove www.
  if (domain.startsWith('www.')) {
    domain = domain.substring(4);
  }

  if (!customSites.includes(domain)) {
    customSites.push(domain);
    chrome.storage.sync.set({ customSites }, () => {
      // If it was previously whitelisted somehow, remove it from whitelist since they just explicitly blocked it
      if (whitelist.includes(domain)) {
        whitelist = whitelist.filter(d => d !== domain);
        chrome.storage.sync.set({ whitelist });
      }
      
      input.value = '';
      renderCategories();
    });
  } else {
    input.value = '';
  }
}

function handleRemoveCustomSite(domain) {
  customSites = customSites.filter(d => d !== domain);
  chrome.storage.sync.set({ customSites }, () => {
    renderCategories();
  });
}

function renderCategories() {
  const container = document.getElementById('categoriesContainer');
  container.innerHTML = '';

  // Merge custom sites and standard categories for rendering
  const allCategories = {};
  if (customSites.length > 0) {
    allCategories['Full Block List'] = customSites;
  }
  
  // Only show the custom block list now as per user request

  for (const [category, domains] of Object.entries(allCategories)) {
    const isCustom = category === 'Full Block List';
    const visibleDomains = domains;
    if (visibleDomains.length === 0) continue;
    
    const section = document.createElement('div');
    section.className = 'category-section';
    section.setAttribute('data-category', category.toLowerCase());
    
    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.justifyContent = 'space-between';
    headerRow.style.alignItems = 'center';
    headerRow.style.marginBottom = '24px';
    headerRow.style.paddingBottom = '12px';
    headerRow.style.borderBottom = '1px solid var(--border-color)';
    
    const header = document.createElement('h3');
    header.className = 'category-header';
    header.style.marginBottom = '0';
    header.style.borderBottom = 'none';
    header.style.paddingBottom = '0';
    header.textContent = category;
    headerRow.appendChild(header);

    // Calculate how many are allowed to set the master toggle state
    const allAllowed = visibleDomains.every(d => whitelist.includes(d));
    
    const masterToggleDiv = document.createElement('div');
    masterToggleDiv.className = 'toggle-group';
    masterToggleDiv.innerHTML = `
      <span style="font-size: 13px; font-weight: 500; margin-right: 12px; color: var(--text-main);">Toggle Entire Category:</span>
      <label class="switch">
        <input type="checkbox" class="category-master-toggle" ${allAllowed ? 'checked' : ''}>
        <span class="slider"></span>
      </label>
    `;
    
    masterToggleDiv.querySelector('.category-master-toggle').addEventListener('change', (e) => {
      const isAllowed = e.target.checked;
      
      if (isAllowed) {
        // Add all visible domains to whitelist
        visibleDomains.forEach(d => {
          if (!whitelist.includes(d)) whitelist.push(d);
        });
      } else {
        // Remove all visible domains from whitelist
        whitelist = whitelist.filter(d => !visibleDomains.includes(d));
      }
      
      chrome.storage.sync.set({ whitelist }, () => {
        renderCategories(); // Re-render to update all individual toggles
      });
    });
    
    headerRow.appendChild(masterToggleDiv);
    section.appendChild(headerRow);
    
    const grid = document.createElement('div');
    grid.className = 'site-grid';
    
    const renderLimit = 50;
    const toRender = visibleDomains.slice(0, renderLimit);
    
    const appendBatch = (batch) => {
      batch.forEach(domain => {
        const siteItem = document.createElement('div');
        siteItem.className = 'site-item';
        siteItem.setAttribute('data-domain', domain.toLowerCase());
        
        const isAllowed = whitelist.includes(domain);
        
        let html = `
          <span class="domain-name">${domain}</span>
          <div class="toggle-group">
            <label class="switch">
              <input type="checkbox" class="site-toggle" data-domain="${domain}" ${isAllowed ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
            <span class="status-label">${isAllowed ? 'Allowed' : 'Blocked'}</span>
        `;
        
        if (isCustom) {
          html += `<button class="delete-custom-btn" data-domain="${domain}" title="Remove custom site">✕</button>`;
        }
        
        html += `</div>`;
        siteItem.innerHTML = html;
        
        grid.appendChild(siteItem);
      });
    };
    
    appendBatch(toRender);
    section.appendChild(grid);
    
    let currentlyRendered = toRender.length;
    
    if (currentlyRendered < visibleDomains.length) {
      const loadMoreBtn = document.createElement('button');
      loadMoreBtn.className = 'load-more-btn';
      loadMoreBtn.style.marginTop = '20px';
      loadMoreBtn.style.background = 'var(--panel-bg)';
      loadMoreBtn.style.border = '1px solid var(--border-color)';
      loadMoreBtn.style.color = 'var(--text-main)';
      loadMoreBtn.style.cursor = 'pointer';
      loadMoreBtn.style.fontWeight = '500';
      loadMoreBtn.style.fontSize = '14px';
      loadMoreBtn.style.fontFamily = 'inherit';
      loadMoreBtn.style.padding = '10px 16px';
      loadMoreBtn.style.borderRadius = '10px';
      loadMoreBtn.style.transition = 'all 0.2s box-shadow';
      loadMoreBtn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
      
      loadMoreBtn.onmouseover = () => loadMoreBtn.style.borderColor = 'var(--primary)';
      loadMoreBtn.onmouseout = () => loadMoreBtn.style.borderColor = 'var(--border-color)';
      
      const updateButtonState = () => {
        const remaining = visibleDomains.length - currentlyRendered;
        if (remaining > 0) {
          loadMoreBtn.textContent = `Load next batch (${remaining.toLocaleString()} remaining)`;
        } else {
          loadMoreBtn.style.display = 'none';
        }
      };
      
      updateButtonState();
      
      loadMoreBtn.addEventListener('click', () => {
        const nextBatch = visibleDomains.slice(currentlyRendered, currentlyRendered + 200);
        appendBatch(nextBatch);
        currentlyRendered += nextBatch.length;
        updateButtonState();
        
        // We have to bind the new DOM elements to the listeners manually 
        // because the global querySelectorAll is only executed at the end of renderCategories once
        const newDOMItems = Array.from(grid.children).slice(-nextBatch.length);
        newDOMItems.forEach(item => {
          item.querySelector('.site-toggle').addEventListener('change', handleToggle);
          const delBtn = item.querySelector('.delete-custom-btn');
          if (delBtn) {
            delBtn.addEventListener('click', (e) => {
              handleRemoveCustomSite(e.target.getAttribute('data-domain'));
            });
          }
        });
      });
      
      const actionRow = document.createElement('div');
      actionRow.style.display = 'flex';
      actionRow.style.justifyContent = 'center';
      actionRow.appendChild(loadMoreBtn);
      section.appendChild(actionRow);
    }
    
    container.appendChild(section);
  }

  // Add event listeners to toggles
  document.querySelectorAll('.site-toggle').forEach(toggle => {
    toggle.addEventListener('change', handleToggle);
  });
  
  // Add event listeners to delete buttons
  document.querySelectorAll('.delete-custom-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const domain = e.target.getAttribute('data-domain');
      handleRemoveCustomSite(domain);
    });
  });
}

function handleToggle(e) {
  const domain = e.target.getAttribute('data-domain');
  const isAllowed = e.target.checked;
  const label = e.target.closest('.toggle-group').querySelector('.status-label');
  
  if (isAllowed) {
    if (!whitelist.includes(domain)) whitelist.push(domain);
    label.textContent = 'Allowed';
  } else {
    whitelist = whitelist.filter(d => d !== domain);
    label.textContent = 'Blocked';
  }
  
  // Save to storage
  chrome.storage.sync.set({ whitelist });
}


