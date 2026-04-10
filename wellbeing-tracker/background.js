// background.js

let activeTabId = null;
let activeUrl = null;
let startTime = null;
let isIdle = false;

let allowedSites = {}; 

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
   if (msg.action === "allow_site" && sender.tab) {
       if (!allowedSites[sender.tab.id]) allowedSites[sender.tab.id] = {};
       allowedSites[sender.tab.id][msg.hostname] = true;
   } else if (msg.action === "redirect_newtab" && sender.tab) {
       chrome.tabs.update(sender.tab.id, {url: "chrome://newtab/"});
   }
});

const categories = {
  "Shopping": ["amazon.com", "ebay.com", "etsy.com", "walmart.com", "flipkart.com", "aliexpress.com", "target.com"],
  "Social Media": ["facebook.com", "x.com", "twitter.com", "instagram.com", "reddit.com", "linkedin.com", "tiktok.com"],
  "Entertainment": ["youtube.com", "netflix.com", "primevideo.com", "twitch.tv", "spotify.com", "hulu.com"],
  "Education": ["github.com", "stackoverflow.com", "wikipedia.org", "coursera.org", "udemy.com", "medium.com"]
};

function getCategory(url) {
  try {
    const hostname = new URL(url).hostname;
    for (const [category, domains] of Object.entries(categories)) {
      if (domains.some(domain => hostname.includes(domain))) {
        return category;
      }
    }
    return "Misc";
  } catch (e) {
    return "Misc";
  }
}

function getTodayKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function playGentleSoundInActiveTab() {
  if (!activeTabId) return;
  chrome.scripting.executeScript({
    target: { tabId: activeTabId },
    func: () => {
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(1046.50, audioCtx.currentTime + 0.1); 
        
        gain.gain.setValueAtTime(0, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.05); 
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
        
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.6);
      } catch (e) {}
    }
  }).catch(() => {});
}

async function addAlert(message) {
  const data = await chrome.storage.local.get("wellbeingAlerts");
  const alerts = data.wellbeingAlerts || [];
  alerts.unshift({
    id: Date.now(),
    message,
    timestamp: new Date().toLocaleTimeString(),
    read: false
  });
  await chrome.storage.local.set({ wellbeingAlerts: alerts.slice(0, 50) }); // keep last 50
}

async function saveCurrentTime() {
  if (!activeUrl || isIdle || !startTime) return;

  const now = Date.now();
  const timeSpent = now - startTime;
  startTime = now;

  if (timeSpent <= 0) return;

  const todayStr = getTodayKey();
  const hostname = new URL(activeUrl).hostname;
  const category = getCategory(activeUrl);

  const data = await chrome.storage.local.get([todayStr]);
  const todayData = data[todayStr] || { domains: {}, categories: {} };

  if (!todayData.domains[hostname]) todayData.domains[hostname] = 0;
  todayData.domains[hostname] += timeSpent;

  const previousMs = todayData.categories[category] || 0;
  todayData.categories[category] = previousMs + timeSpent;
  const newMs = todayData.categories[category];

  const updateObj = {};
  updateObj[todayStr] = todayData;
  await chrome.storage.local.set(updateObj);

  const limitsData = await chrome.storage.local.get(["categoryLimits", "notifiedCategories"]);
  const limits = limitsData.categoryLimits || {};
  let notifiedCategories = limitsData.notifiedCategories || {};
  let todayNotified = notifiedCategories[todayStr] || {};

  const limitMs = (limits[category] || 0) * 60 * 1000;
  
  if (limitMs > 0 && newMs >= limitMs && !todayNotified[category]) {
    const msg = `Daily limit reached for ${category} (${limits[category]} mins).`;
    await addAlert(msg);
    playGentleSoundInActiveTab();

    todayNotified[category] = true;
    notifiedCategories[todayStr] = todayNotified;
    chrome.storage.local.set({ notifiedCategories });
  } else {
    const prevMins = Math.floor(previousMs / (60 * 1000));
    const currentMins = Math.floor(newMs / (60 * 1000));
    
    if (currentMins > 0 && currentMins % 10 === 0 && prevMins < currentMins) {
      const msg = `You've spent ${currentMins} mins on ${category} today.`;
      await addAlert(msg);
      playGentleSoundInActiveTab();
    }
  }
}

async function updateActiveTab() {
  await saveCurrentTime(); 
  if (isIdle) {
    activeUrl = null;
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.startsWith('http')) {
      activeTabId = tab.id;
      activeUrl = tab.url;
      startTime = Date.now();
    } else {
      activeTabId = null;
      activeUrl = null;
      startTime = null;
    }
  } catch (e) {
    activeTabId = null;
    activeUrl = null;
    startTime = null;
  }
}

chrome.tabs.onActivated.addListener(updateActiveTab);

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    updateActiveTab();
  }

  if (changeInfo.status === 'loading' && tab.url && tab.url.startsWith('http')) {
     const data = await chrome.storage.local.get(["focusMode", "distractingLinks"]);
     if (data.focusMode && data.distractingLinks && data.distractingLinks.length > 0) {
        try {
            const urlObj = new URL(tab.url);
            const hostname = urlObj.hostname;
            const isDistracting = data.distractingLinks.some(link => hostname.includes(link));
            
            if (isDistracting && !(allowedSites[tabId] && allowedSites[tabId][hostname])) {
               chrome.scripting.executeScript({
                   target: {tabId: tabId},
                   func: (host) => {
                       if (document.getElementById('fm-blocker-overlay')) return;
                       const div = document.createElement('div');
                       div.id = 'fm-blocker-overlay';
                       div.innerHTML = `
                          <div style="position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.95);z-index:2147483647;display:flex;align-items:center;justify-content:center;color:white;font-family:sans-serif;backdrop-filter:blur(10px);">
                             <div style="background:#1e293b;padding:40px;border-radius:12px;text-align:center;box-shadow:0 10px 25px rgba(0,0,0,0.5);max-width:400px;border:1px solid rgba(255,255,255,0.1);">
                                <div style="font-size:3rem;margin-bottom:10px;">盾</div>
                                <h1 style="margin:0 0 10px 0;font-size:1.5rem;color:#f8fafc;">Focus Mode Active</h1>
                                <p style="margin:0 0 25px 0;font-size:1rem;color:#94a3b8;line-height:1.5;">You are attempting to visit <b style="color:white;">${host}</b>, which is marked as intensely distracting.</p>
                                <div style="display:flex;gap:15px;justify-content:center;">
                                   <button id="btn-fm-back" style="flex:1;padding:12px;background:#3b82f6;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;">Take Me Back</button>
                                   <button id="btn-fm-continue" style="flex:1;padding:12px;background:transparent;color:#94a3b8;border:1px solid #475569;border-radius:8px;font-weight:bold;cursor:pointer;transition:0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">I'm Sure, Enter</button>
                                </div>
                             </div>
                          </div>
                       `;
                       document.documentElement.appendChild(div);
                       document.body.style.overflow = 'hidden';

                       document.getElementById('btn-fm-back').addEventListener('click', () => {
                           chrome.runtime.sendMessage({ action: "redirect_newtab" });
                       });
                       document.getElementById('btn-fm-continue').addEventListener('click', () => {
                          document.body.style.overflow = '';
                          div.remove();
                          chrome.runtime.sendMessage({ action: "allow_site", hostname: host });
                       });
                   },
                   args: [hostname]
               }).catch(()=>{}); 
            }
        } catch(e) {}
     }
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    saveCurrentTime();
    activeUrl = null;
    startTime = null;
  } else {
    updateActiveTab();
  }
});

chrome.idle.setDetectionInterval(60); 
chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'active') {
    isIdle = false;
    updateActiveTab();
  } else {
    isIdle = true;
    saveCurrentTime();
  }
});

chrome.alarms.create("saveTimeAlarm", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "saveTimeAlarm") {
    saveCurrentTime();
  }
});

let popupWindowId = null;

function createPopupWindow() {
  chrome.windows.create({
    url: chrome.runtime.getURL("popup.html"),
    type: "popup",
    width: 360,
    height: 600
  }, (win) => { popupWindowId = win.id; });
}

chrome.action.onClicked.addListener((tab) => {
  if (popupWindowId !== null) {
      chrome.windows.get(popupWindowId, (win) => {
          if (chrome.runtime.lastError || !win) {
              createPopupWindow();
          } else {
              chrome.windows.remove(popupWindowId);
          }
      });
  } else {
      createPopupWindow();
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
   if (windowId === popupWindowId) popupWindowId = null;
});

updateActiveTab();
