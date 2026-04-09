const categories = ["Shopping", "Social Media", "Entertainment", "Education", "Misc"];

document.addEventListener('DOMContentLoaded', async () => {
  const limitsData = await chrome.storage.local.get(["categoryLimits"]);
  const categoryLimits = limitsData.categoryLimits || {};

  const container = document.getElementById('limits-container');

  categories.forEach(cat => {
    const defaultVal = categoryLimits[cat] || 0;
    const div = document.createElement('div');
    div.className = 'limit-item';
    div.innerHTML = `
      <label>${cat}</label>
      <input type="number" id="limit-${cat.replace(/\s+/g, '-')}" min="0" value="${defaultVal}" placeholder="e.g. 60 for 1 hr" />
    `;
    container.appendChild(div);
  });

  document.getElementById('save-btn').addEventListener('click', async () => {
    const newLimits = {};
    categories.forEach(cat => {
      const val = parseInt(document.getElementById(`limit-${cat.replace(/\s+/g, '-')}`).value, 10);
      newLimits[cat] = isNaN(val) ? 0 : val;
    });

    await chrome.storage.local.set({ categoryLimits: newLimits });
    
    document.getElementById('save-msg').style.display = 'block';
    setTimeout(() => {
      document.getElementById('save-msg').style.display = 'none';
    }, 3000);
  });
});
