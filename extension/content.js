// Function to try to match input fields and fill them
function autoFillForm(profile) {
  if (!profile) return;

  const inputs = document.querySelectorAll('input, textarea');
  let filledCount = 0;

  inputs.forEach(input => {
    const name = (input.name || input.id || input.placeholder || '').toLowerCase();
    let valueToSet = null;

    if (name.includes('name') || name.includes('nome')) {
      valueToSet = profile.fullName;
    } else if (name.includes('email') || name.includes('e-mail')) {
      valueToSet = profile.email;
    } else if (name.includes('phone') || name.includes('telefone') || name.includes('celular')) {
      valueToSet = profile.phone;
    } else if (name.includes('linkedin')) {
      valueToSet = profile.linkedin;
    } else if (name.includes('github') || name.includes('portfolio')) {
      valueToSet = profile.github;
    } else if (name.includes('city') || name.includes('cidade') || name.includes('location') || name.includes('localização')) {
      valueToSet = profile.location;
    } else if (name.includes('summary') || name.includes('resumo') || name.includes('bio')) {
      valueToSet = profile.bio;
    }

    if (valueToSet && !input.value) {
      input.value = valueToSet;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      filledCount++;
    }
  });

  if (filledCount > 0) {
    alert(`IA Vagas: ${filledCount} campos preenchidos com sucesso!`);
  } else {
    alert('IA Vagas: Não foram encontrados campos compatíveis ou eles já estão preenchidos.');
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'autofill') {
    chrome.storage.local.get(['userProfile'], (result) => {
      if (result.userProfile) {
        autoFillForm(result.userProfile);
      } else {
        alert('IA Vagas: Nenhum perfil carregado. Faça o upload do seu JSON na extensão primeiro.');
      }
    });
  }
});
