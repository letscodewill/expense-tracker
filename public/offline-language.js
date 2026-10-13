(() => {
  let language = 'pt-BR'
  try { language = localStorage.getItem('nocontrole:language') || 'pt-BR' } catch { /* Portuguese remains available without storage. */ }
  if (language !== 'en') return
  document.documentElement.lang = 'en'
  document.title = 'NoControle — Offline'
  const messages = {
    'offline-heading': 'You are offline',
    'offline-message': 'Connect to the internet to access your expenses and save changes securely.',
    'offline-privacy': 'NoControle does not display financial data on this offline page.',
    'offline-retry': 'Try again',
  }
  for (const [id, message] of Object.entries(messages)) {
    const element = document.getElementById(id)
    if (element) element.textContent = message
  }
})()
