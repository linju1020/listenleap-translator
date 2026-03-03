document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggle');
  const status = document.getElementById('status');

  chrome.storage.local.get(['translationEnabled'], (result) => {
    toggle.checked = result.translationEnabled !== false;
    updateStatus(toggle.checked);
  });

  toggle.addEventListener('change', (e) => {
    const enabled = e.target.checked;
    chrome.storage.local.set({ translationEnabled: enabled }, () => {
      updateStatus(enabled);

      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.reload(tabs[0].id);
        }
      });
    });
  });

  function updateStatus(enabled) {
    status.textContent = enabled ? '翻译已启用' : '翻译已禁用';
    status.style.color = enabled ? '#4CAF50' : '#888';
  }
});
