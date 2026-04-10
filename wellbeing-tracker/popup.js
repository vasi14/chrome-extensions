// popup.js

const categoryColors = {
  "Shopping": "#f59e0b",
  "Social Media": "#ec4899",
  "Entertainment": "#8b5cf6",
  "Education": "#10b981",
  "Misc": "#64748b"
};

const domainCategories = {
  "Shopping": ["amazon.com", "ebay.com", "etsy.com", "walmart.com", "flipkart.com", "aliexpress.com", "target.com"],
  "Social Media": ["facebook.com", "x.com", "twitter.com", "instagram.com", "reddit.com", "linkedin.com", "tiktok.com"],
  "Entertainment": ["youtube.com", "netflix.com", "primevideo.com", "twitch.tv", "spotify.com", "hulu.com"],
  "Education": ["github.com", "stackoverflow.com", "wikipedia.org", "coursera.org", "udemy.com", "medium.com"]
};

function getCategoryForHostname(hostname) {
  for (const [category, domains] of Object.entries(domainCategories)) {
    if (domains.some(domain => hostname.includes(domain))) {
      return category;
    }
  }
  return "Misc";
}

let currentMode = "daily";
let myChart = null;
window.currentDistractingLinks = [];

function formatTime(ms) {
  if (ms <= 0) return "0m";
  if (ms < 60000) return "< 1m";
  const minutes = Math.floor((ms / 1000 / 60) % 60);
  const hours = Math.floor(ms / 1000 / 60 / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getDateKey(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function updateDateHeader() {
  const options = { weekday: 'long', month: 'short', day: 'numeric' };
  document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', options);
}

async function loadData() {
  await chrome.runtime.getBackgroundPage && chrome.runtime.getBackgroundPage((bg) => {
    if(bg && bg.saveCurrentTime) bg.saveCurrentTime();
  });
  
  // Load Focus Mode state
  const fData = await chrome.storage.local.get("focusMode");
  const focusBanner = document.getElementById('focus-toggle-btn');
  if (fData.focusMode) focusBanner.classList.add('active');
  else focusBanner.classList.remove('active');

  // Load Alerts
  updateAlertsUI();

  if (currentMode === "daily") {
    const todayStr = getDateKey(0);
    const data = await chrome.storage.local.get([todayStr]);
    const todayData = data[todayStr] || { categories: {}, domains: {} };
    renderUI(todayData.categories, todayData.domains || {});
  } else {
    const keys = [];
    for(let i = 0; i < 7; i++) {
        keys.push(getDateKey(i));
    }
    const data = await chrome.storage.local.get(keys);
    const aggCat = {};
    const aggDom = {};
    keys.forEach(k => {
      if (data[k]) {
        if (data[k].categories) {
          for (const cat in data[k].categories) {
            aggCat[cat] = (aggCat[cat] || 0) + data[k].categories[cat];
          }
        }
        if (data[k].domains) {
          for (const dom in data[k].domains) {
             aggDom[dom] = (aggDom[dom] || 0) + data[k].domains[dom];
          }
        }
      }
    });
    renderUI(aggCat, aggDom);
  }
}

async function updateAlertsUI() {
  const data = await chrome.storage.local.get("wellbeingAlerts");
  const alerts = data.wellbeingAlerts || [];
  const unreadCount = alerts.filter(a => !a.read).length;
  
  const badge = document.getElementById('alert-badge');
  if (unreadCount > 0) {
    badge.innerText = unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }

  const listContainer = document.getElementById('alerts-list-container');
  listContainer.innerHTML = '';
  
  if (alerts.length === 0) {
    listContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-secondary); font-size:0.85rem;">No alerts right now. Stay focused!</div>';
    return;
  }

  alerts.forEach(alert => {
    const div = document.createElement('div');
    div.className = `alert-item ${alert.read ? 'read' : 'unread'}`;
    div.innerHTML = `
      <div class="alert-msg">${alert.message}</div>
      <div class="alert-time">${alert.timestamp}</div>
    `;
    listContainer.appendChild(div);
  });
}

function renderUI(categoriesData, domainsData) {
  let totalMs = 0;
  for (const cat in categoriesData) totalMs += categoriesData[cat];

  document.getElementById('total-label').innerText = currentMode === "daily" ? "Total Time Today" : "Total Time This Week";
  document.getElementById('total-time').innerText = formatTime(totalMs);

  const container = document.getElementById('categories-container');
  container.innerHTML = '';
  
  if (totalMs === 0) {
    container.innerHTML = '<div style="text-align:center; color: var(--text-secondary); font-size: 0.85rem; padding: 20px;">No web activity recorded yet.</div>';
  }

  const chartLabels = [];
  const chartData = [];
  const chartBackgroundColors = [];

  const sortedCategories = Object.keys(categoriesData).sort((a, b) => categoriesData[b] - categoriesData[a]);

  const domainsByCategory = {};
  for (const dom in domainsData) {
     const cat = getCategoryForHostname(dom);
     if (!domainsByCategory[cat]) domainsByCategory[cat] = [];
     domainsByCategory[cat].push({ domain: dom, time: domainsData[dom] });
  }

  sortedCategories.forEach(category => {
    const timeSpent = categoriesData[category];
    if (timeSpent < 1000) return;
    
    chartLabels.push(category);
    chartData.push(timeSpent / 1000 / 60); 
    chartBackgroundColors.push(categoryColors[category] || categoryColors.Misc);

    let domListHTML = '';
    if (domainsByCategory[category]) {
       const topDoms = domainsByCategory[category].sort((a,b) => b.time - a.time).slice(0, 4);
       topDoms.forEach(d => {
          domListHTML += `
            <div class="site-row">
              <span class="site-domain">${d.domain}</span>
              <span>${formatTime(d.time)}</span>
            </div>
          `;
       });
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'category-wrapper';
    wrapper.innerHTML = `
      <div class="category-item">
        <div class="category-info">
          <div class="category-color" style="background: ${categoryColors[category] || categoryColors.Misc}"></div>
          <div class="category-name">${category}</div>
        </div>
        <div class="category-time">
          ${formatTime(timeSpent)} (${((timeSpent / totalMs) * 100).toFixed(0)}%)
        </div>
      </div>
      <div class="sites-list">
         ${domListHTML || 'No identifiable sites.'}
      </div>
    `;

    wrapper.querySelector('.category-item').addEventListener('click', () => {
       const list = wrapper.querySelector('.sites-list');
       list.classList.toggle('open');
    });

    container.appendChild(wrapper);
  });

  renderChart(chartLabels, chartData, chartBackgroundColors);
}

function renderChart(labels, data, colors) {
  const ctx = document.getElementById('categoryChart');
  if(!ctx) return;
  
  if (myChart) myChart.destroy();

  if (data.length === 0) {
    data = [1];
    labels = ["No Data"];
    colors = ["#334155"];
  }

  myChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 0,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      animation: { duration: 0 },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.9)',
          titleColor: '#f8fafc',
          bodyColor: '#f8fafc',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          padding: 8,
          displayColors: true,
          callbacks: {
            label: function(context) {
              const val = context.raw;
              if (labels[0] === "No Data") return " 0m";
              const hours = Math.floor(val / 60);
              const mins = Math.floor(val % 60);
              return ` ${hours > 0 ? hours + 'h ' : ''}${mins}m`;
            }
          }
        }
      }
    }
  });
}

function renderDistractingLinks() {
    const list = document.getElementById('distracting-links-container');
    list.innerHTML = '';
    
    if (window.currentDistractingLinks.length === 0) {
       list.innerHTML = '<div style="font-size:0.8rem; color:var(--text-secondary); text-align:center; padding:10px;">No links added. Enter one above!</div>';
       return;
    }

    window.currentDistractingLinks.forEach((link, idx) => {
        list.innerHTML += `
           <div class="link-pill">
              <span>${link}</span>
              <button class="remove-link-btn" data-idx="${idx}">✖</button>
           </div>
        `;
    });
    document.querySelectorAll('.remove-link-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.getAttribute('data-idx'));
            window.currentDistractingLinks.splice(index, 1);
            renderDistractingLinks();
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
  updateDateHeader();
  loadData();

  // Alert Click Overlay Toggle
  document.getElementById('alert-trigger').addEventListener('click', async () => {
    const dash = document.getElementById('dashboard-panel');
    const setPan = document.getElementById('settings-panel');
    const alertPan = document.getElementById('alerts-panel');
    const optBtn = document.getElementById('btn-options');
    
    if (alertPan.style.display === 'none') {
       // Open Alerts
       dash.style.display = 'none';
       setPan.style.display = 'none';
       alertPan.style.display = 'flex';
       optBtn.innerText = '⟵ Back';

       // Mark all as read
       const data = await chrome.storage.local.get("wellbeingAlerts");
       const alerts = (data.wellbeingAlerts || []).map(a => ({...a, read: true}));
       await chrome.storage.local.set({ wellbeingAlerts: alerts });
       updateAlertsUI();
    } else {
       // Toggle back to dashboard
       dash.style.display = 'flex';
       alertPan.style.display = 'none';
       optBtn.innerText = '⚙️ Setting';
    }
  });

  document.getElementById('clear-alerts-btn').addEventListener('click', async () => {
    await chrome.storage.local.set({ wellbeingAlerts: [] });
    updateAlertsUI();
    // Go back automatically
    document.getElementById('alert-trigger').click();
  });

  // Focus Toggle Logic
  const focusBanner = document.getElementById('focus-toggle-btn');
  focusBanner.addEventListener('click', async () => {
     const isActive = focusBanner.classList.toggle('active');
     await chrome.storage.local.set({ focusMode: isActive });
  });

  const themeToggle = document.getElementById('theme-toggle');
  themeToggle.addEventListener('click', () => {
     document.body.classList.toggle('light');
     if (document.body.classList.contains('light')) {
        themeToggle.innerText = '🌙';
     } else {
        themeToggle.innerText = '☀️';
     }
  });

  const btnDaily = document.getElementById('btn-daily');
  const btnWeekly = document.getElementById('btn-weekly');

  btnDaily.addEventListener('click', () => {
    currentMode = 'daily';
    btnDaily.classList.add('active');
    btnWeekly.classList.remove('active');
    loadData();
  });

  btnWeekly.addEventListener('click', () => {
    currentMode = 'weekly';
    btnWeekly.classList.add('active');
    btnDaily.classList.remove('active');
    loadData();
  });

  // Open Settings
  document.getElementById('btn-options').addEventListener('click', async () => {
    const dash = document.getElementById('dashboard-panel');
    const setPan = document.getElementById('settings-panel');
    const alertPan = document.getElementById('alerts-panel');
    const optBtn = document.getElementById('btn-options');

    // If on alerts, back takes to dashboard
    if (alertPan.style.display !== 'none') {
       alertPan.style.display = 'none';
       dash.style.display = 'flex';
       optBtn.innerText = '⚙️ Setting';
       return;
    }

    if (dash.style.display !== 'none') {
       dash.style.display = 'none';
       alertPan.style.display = 'none';
       setPan.style.display = 'flex';
       optBtn.innerText = '⟵ Back';
       
       const data = await chrome.storage.local.get(["categoryLimits", "distractingLinks"]);
       const limits = data.categoryLimits || {};
       const limitsContainer = document.getElementById('limits-container');
       limitsContainer.innerHTML = '';
       ["Shopping", "Social Media", "Entertainment", "Education", "Misc"].forEach(cat => {
           const val = limits[cat] || '';
           limitsContainer.innerHTML += `
              <div class="limit-row">
                 <label>${cat}</label>
                 <input type="number" id="limit-${cat.replace(/\s+/g,'')}" min="0" placeholder="0 = None" value="${val}" />
              </div>
           `;
       });

       window.currentDistractingLinks = data.distractingLinks || [];
       renderDistractingLinks();

    } else {
       // Close via quick toggle back
       dash.style.display = 'flex';
       setPan.style.display = 'none';
       optBtn.innerText = '⚙️ Setting';
    }
  });

  document.getElementById('add-link-btn').addEventListener('click', () => {
      const input = document.getElementById('new-link-input');
      const val = input.value.trim().toLowerCase();
      if (val && !window.currentDistractingLinks.includes(val)) {
          window.currentDistractingLinks.push(val);
          renderDistractingLinks();
          input.value = '';
      }
  });

  document.getElementById('save-settings-btn').addEventListener('click', async () => {
     const newLimits = {};
     ["Shopping", "Social Media", "Entertainment", "Education", "Misc"].forEach(cat => {
        const val = parseInt(document.getElementById(`limit-${cat.replace(/\s+/g,'')}`).value, 10);
        newLimits[cat] = isNaN(val) ? 0 : val;
     });
     await chrome.storage.local.set({ 
       categoryLimits: newLimits, 
       distractingLinks: window.currentDistractingLinks 
     });
     document.getElementById('save-settings-btn').innerText = 'Applied!';
     setTimeout(() => {
        document.getElementById('save-settings-btn').innerText = 'Save Settings & Back';
        document.getElementById('btn-options').click(); 
     }, 800);
  });
});
