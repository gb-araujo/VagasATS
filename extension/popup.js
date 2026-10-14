document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('file-input');
  const statusText = document.getElementById('status-text');
  const autofillBtn = document.getElementById('autofill-btn');

  // Load existing
  chrome.storage.local.get(['userProfile'], (result) => {
    if (result.userProfile && result.userProfile.fullName) {
      statusText.textContent = `Perfil carregado: ${result.userProfile.fullName}`;
    }
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const profile = JSON.parse(event.target.result);
        chrome.storage.local.set({ userProfile: profile }, () => {
          statusText.textContent = `Perfil carregado: ${profile.fullName || 'Desconhecido'}`;
        });
      } catch (err) {
        statusText.textContent = "Erro ao ler JSON";
        statusText.style.color = "#ef4444";
      }
    };
    reader.readAsText(file);
  });

  autofillBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "autofill" });
    });
  });
});
