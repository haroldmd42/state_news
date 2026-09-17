// Play custom notification sound from assets/sonido.mp3 for offscreen document playback
function playChimeSound() {
  try {
    const audioUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('assets/sonido.mp3')
      : '../assets/sonido.mp3';
    const audio = new Audio(audioUrl);
    audio.play().catch((err) => {
      console.warn('[ADO Notifier] Error al reproducir sonido offscreen:', err);
    });
  } catch (e) {
    console.error('[ADO Notifier] Error al inicializar Audio en offscreen:', e);
  }
}

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'PLAY_CHIME_SOUND') {
        try {
          playChimeSound();
          if (sendResponse) sendResponse({ success: true });
        } catch (e) {}
        return true;
      }
    });
  } catch (e) {}
}
