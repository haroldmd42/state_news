/**
 * Azure DevOps Notifier - Content Script for In-Page Floating Toasts & Audio
 */

(function () {
  let toastContainer = null;
  const recentToastIds = new Set();

  function ensureContainer() {
    if (!toastContainer || !document.body.contains(toastContainer)) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'ado-toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  // 2-tone futuristic chime audio in Base64 WAV format (HTML5 Audio to avoid WebAudio renderer errors)
  const CHIME_SOUND_BASE64 = 'data:audio/wav;base64,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'

  function playNotificationChime(enableSound) {
    if (enableSound === false) return;
    try {
      const audio = new Audio(CHIME_SOUND_BASE64);
      audio.play().catch(() => {});
    } catch (e) {}
  }

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    try {
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'SHOW_INPAGE_TOAST' && request.payload) {
          showToast(request.payload);
          if (sendResponse) sendResponse({ received: true });
        }
      });
    } catch (e) {}
  }

  function getCategorySvgIcon(category) {
    switch (category) {
      case 'HU':
      case 'HU_COMMITTED':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`;
      case 'HU_QA':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><circle cx="14" cy="10" r="4"/><path d="m17 13 2 2"/></svg>`;
      case 'HU_REVIEW_PO':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><path d="M10 9l2 2 4-4"/></svg>`;
      case 'HU_DONE':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
      case 'HU_IMPEDIMENT':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
      case 'HU_STAGE':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
      case 'HU_ASSIGNED':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/></svg>`;
      case 'BUG_NEW':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="6" width="8" height="14" rx="4"/><path d="M6 18h12M6 12h12M6 6h12M12 2v4"/></svg>`;
      case 'BUG_QA':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>`;
      case 'BUG_DONE':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;
      case 'BUG_REOPEN':
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>`;
      default:
        return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>`;
    }
  }

  function getPillLabel(category) {
    switch (category) {
      case 'HU': return 'Historia de Usuario';
      case 'HU_QA': return 'HU en QA';
      case 'HU_REVIEW_PO': return 'HU en Review PO';
      case 'HU_DONE': return 'HU Finalizada (DONE)';
      case 'HU_IMPEDIMENT': return 'HU con Impedimento';
      case 'HU_STAGE': return 'HU en Stage';
      case 'HU_COMMITTED': return 'HU en Progreso';
      case 'HU_ASSIGNED': return 'HU Asignada a Ti';
      case 'BUG_NEW': return 'Nuevo Bug';
      case 'BUG_QA': return 'Bug en QA';
      case 'BUG_DONE': return 'Bug Cerrado (DONE)';
      case 'BUG_REOPEN': return 'Bug Reabierto';
      default: return category;
    }
  }

  function showToast(payload) {
    if (!payload || !payload.id) return;

    // Deduplication check: ignore if rendered in the last 3 seconds
    if (recentToastIds.has(payload.id)) {
      return;
    }
    recentToastIds.add(payload.id);
    setTimeout(() => recentToastIds.delete(payload.id), 3000);

    const container = ensureContainer();
    const category = payload.category || 'HU';

    // Play chime sound (enableSound is passed from service worker settings via payload)
    playNotificationChime(payload.enableSound);

    const toast = document.createElement('div');
    toast.className = `ado-toast ${category}`;

    toast.innerHTML = `
      <div class="ado-toast-icon ${category}">${getCategorySvgIcon(category)}</div>
      <div class="ado-toast-content">
        <div class="ado-toast-header">
          <span class="ado-toast-pill ${category}">${getPillLabel(category)}</span>
          <button class="ado-toast-close" title="Cerrar">&times;</button>
        </div>
        <div class="ado-toast-title">${escapeHtml(payload.title)}</div>
        <div class="ado-toast-msg">${escapeHtml(payload.message)}</div>
        <div class="ado-toast-footer">
          <span class="ado-toast-link">Abrir en Azure DevOps ↗</span>
        </div>
      </div>
    `;

    toast.addEventListener('click', (e) => {
      if (e.target.classList.contains('ado-toast-close')) {
        e.stopPropagation();
        removeToast(toast);
        return;
      }
      if (payload.id && typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'MARK_AS_READ', id: payload.id }).catch(() => {});
      }
      if (payload.url) {
        window.open(payload.url, '_blank');
      }
      removeToast(toast);
    });

    container.appendChild(toast);

    setTimeout(() => {
      removeToast(toast);
    }, 8000);
  }

  function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.animation = 'adoToastFadeOut 0.3s ease forwards';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
})();
