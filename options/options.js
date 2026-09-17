/**
 * Azure DevOps Notifier - Options & Web Dashboard Script with History Selection & Deletion
 */

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - Tabs
  const navItems = document.querySelectorAll('.nav-item');
  const tabPages = document.querySelectorAll('.tab-page');

  // DOM Elements - Credentials
  const inputOrg = document.getElementById('inputOrg');
  const inputProject = document.getElementById('inputProject');
  const inputPat = document.getElementById('inputPat');
  const btnTogglePat = document.getElementById('btnTogglePat');
  const inputAssignedUser = document.getElementById('inputAssignedUser');
  const chkFilterHUByUser = document.getElementById('chkFilterHUByUser');
  const inputInterval = document.getElementById('inputInterval');
  const intervalValue = document.getElementById('intervalValue');
  const chkNotifications = document.getElementById('chkNotifications');
  const chkToasts = document.getElementById('chkToasts');
  const chkSound = document.getElementById('chkSound');
  const formCredentials = document.getElementById('formCredentials');
  const btnTestConnection = document.getElementById('btnTestConnection');
  const testFeedback = document.getElementById('testFeedback');
  const connectionStatusBadge = document.getElementById('connectionStatusBadge');

  // DOM Elements - Mappings
  const mapHuTypes = document.getElementById('mapHuTypes');
  const mapBugTypes = document.getElementById('mapBugTypes');
  const mapNewBugStates = document.getElementById('mapNewBugStates');
  const mapQaBugStates = document.getElementById('mapQaBugStates');
  const mapReopenBugStates = document.getElementById('mapReopenBugStates');
  const mapDoneBugStates = document.getElementById('mapDoneBugStates');
  const mapQaHuStates = document.getElementById('mapQaHuStates');
  const mapReviewPoHuStates = document.getElementById('mapReviewPoHuStates');
  const mapDoneHuStates = document.getElementById('mapDoneHuStates');
  const mapImpedimentHuStates = document.getElementById('mapImpedimentHuStates');
  const mapStageHuStates = document.getElementById('mapStageHuStates');
  const btnSaveMappings = document.getElementById('btnSaveMappings');

  // DOM Elements - Tester
  const btnTestSound = document.getElementById('btnTestSound');

  // DOM Elements - History & Deletion
  const historyList = document.getElementById('historyList');
  const historyEmptyState = document.getElementById('historyEmptyState');
  const btnClearHistory = document.getElementById('btnClearHistory');
  const btnDeleteSelected = document.getElementById('btnDeleteSelected');
  const selectedCount = document.getElementById('selectedCount');
  const btnMarkSelectedRead = document.getElementById('btnMarkSelectedRead');
  const selectedReadCount = document.getElementById('selectedReadCount');
  const btnMarkAllRead = document.getElementById('btnMarkAllRead');
  const chkSelectAllHistory = document.getElementById('chkSelectAllHistory');
  const filterChips = document.querySelectorAll('.chip');

  // DOM Elements - Header
  const btnManualSync = document.getElementById('btnManualSync');

  // SVG Icons for PAT Toggle
  const iconEyeSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const iconEyeOffSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`;

  // Deduplication cache to prevent duplicate toasts
  const recentToastIds = new Set();
  const selectedHistoryIds = new Set();

// Play custom notification sound from assets/sonido.mp3
function playNotificationChime(ignoreSoundCheck = false) {
  if (!ignoreSoundCheck && chkSound && !chkSound.checked) return;
  try {
    const audioUrl = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
      ? chrome.runtime.getURL('assets/sonido.mp3')
      : '../assets/sonido.mp3';
    const audio = new Audio(audioUrl);
    audio.play().catch((err) => {
      console.warn('[ADO Notifier] Error al reproducir sonido en opciones:', err);
    });
  } catch (e) {
    console.error('[ADO Notifier] Error al inicializar Audio en opciones:', e);
  }
}

  // Toast Helper Utilities
  let toastContainer = null;

  function ensureToastContainer() {
    if (!toastContainer || !document.body.contains(toastContainer)) {
      toastContainer = document.createElement('div');
      toastContainer.className = 'ado-toast-container';
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
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

  function renderFloatingToast(payload) {
    if (!payload || !payload.id) return;

    if (recentToastIds.has(payload.id)) return;
    recentToastIds.add(payload.id);
    setTimeout(() => recentToastIds.delete(payload.id), 3000);

    const container = ensureToastContainer();
    const category = payload.category || 'HU';

    // Play Audio Chime
    playNotificationChime();

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
      if (payload.id) {
        chrome.runtime.sendMessage({ action: 'MARK_AS_READ', id: payload.id }, () => {
          loadHistory();
        });
      }
      if (payload.url) {
        window.open(payload.url, '_blank');
      }
      removeToast(toast);
    });

    container.appendChild(toast);
    setTimeout(() => removeToast(toast), 8000);
  }

  function removeToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.style.animation = 'adoToastFadeOut 0.3s ease forwards';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }

  // Listen to background toast broadcasts
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    try {
      chrome.runtime.onMessage.addListener((request) => {
        if (request.action === 'SHOW_INPAGE_TOAST' && request.payload) {
          renderFloatingToast(request.payload);
          loadHistory();
        }
      });
    } catch (e) {}
  }

  // 1. Tab Navigation Logic
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabTarget = item.getAttribute('data-tab');
      navItems.forEach(n => n.classList.remove('active'));
      tabPages.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const targetPage = document.getElementById(`tab-${tabTarget}`);
      if (targetPage) {
        targetPage.classList.add('active');
      }

      if (tabTarget === 'history') {
        loadHistory();
      }
    });
  });

  // 2. Toggle PAT Visibility with SVG Icon Swap
  btnTogglePat.addEventListener('click', () => {
    const isPassword = inputPat.type === 'password';
    inputPat.type = isPassword ? 'text' : 'password';
    btnTogglePat.innerHTML = isPassword ? iconEyeOffSvg : iconEyeSvg;
  });

  // 3. Interval Range Display
  inputInterval.addEventListener('input', () => {
    intervalValue.textContent = `${inputInterval.value} min`;
  });

  // 4. Load Saved Settings
  const { settings, history = [] } = await chrome.storage.local.get(['settings', 'history']);

  if (settings) {
    inputOrg.value = settings.org || '';
    inputProject.value = settings.project || '';
    inputPat.value = settings.pat || '';
    inputAssignedUser.value = settings.assignedUser || '';
    if (chkFilterHUByUser) chkFilterHUByUser.checked = settings.filterHUByUser === true;
    inputInterval.value = settings.pollingInterval || 1;
    intervalValue.textContent = `${inputInterval.value} min`;
    chkNotifications.checked = settings.enableDesktopNotifications !== false;
    chkToasts.checked = settings.enableInPageToasts !== false;
    chkSound.checked = settings.enableSound !== false;

    const defaultReviewPo = ['Review PO', 'Review Po', 'PO Review', 'PO', 'En Revisión PO', 'Revision PO', 'En Revision PO', 'Revisión PO', 'Aprobación PO', 'Aprobacion PO', 'Product Owner'];
    if (settings.stateMappings) {
      mapHuTypes.value = (settings.stateMappings.huTypes || ['Product Backlog Item', 'PBI', 'User Story', 'Historia de Usuario', 'Feature', 'Epic']).join(', ');
      mapBugTypes.value = (settings.stateMappings.bugTypes || ['Bug', 'Defect', 'Fallo', 'Error']).join(', ');
      mapNewBugStates.value = (settings.stateMappings.newBugStates || ['New', 'Nuevo', 'To Do', 'Por hacer', 'Created']).join(', ');
      mapQaBugStates.value = (settings.stateMappings.qaBugStates || ['Qa', 'QA', 'In QA', 'Testing', 'En QA', 'Ready for QA', 'En Pruebas']).join(', ');
      mapReopenBugStates.value = (settings.stateMappings.reopenBugStates || ['Reopened', 'Reopen', 'Reabierto', 'Re-opened']).join(', ');
      mapDoneBugStates.value = (settings.stateMappings.doneBugStates || ['Done', 'Closed', 'Resolved', 'Cerrado', 'Resuelto', 'Finalizado']).join(', ');
      mapQaHuStates.value = (settings.stateMappings.qaHuStates || ['Qa', 'QA', 'In QA', 'Testing', 'En QA', 'Ready for QA', 'En Pruebas']).join(', ');
      mapReviewPoHuStates.value = (settings.stateMappings.reviewPoHuStates && settings.stateMappings.reviewPoHuStates.length > 0 ? settings.stateMappings.reviewPoHuStates : defaultReviewPo).join(', ');
      if (mapDoneHuStates) mapDoneHuStates.value = (settings.stateMappings.doneHuStates || ['Done', 'Closed', 'Resolved', 'Cerrado', 'Resuelto', 'Finalizado']).join(', ');
      if (mapImpedimentHuStates) mapImpedimentHuStates.value = (settings.stateMappings.impedimentHuStates || ['Impediment', 'Blocked', 'Impedimento', 'Bloqueado', 'Bloqueada']).join(', ');
      if (mapStageHuStates) mapStageHuStates.value = (settings.stateMappings.stageHuStates || ['In Stage', 'Stage', 'En Stage', 'Staging']).join(', ');
    }

    if (settings.org && settings.project && settings.pat) {
      updateStatusBadge(true, 'Configurado');
    }
  }

  // 5. Test Connection Button
  btnTestConnection.addEventListener('click', async () => {
    const creds = {
      org: inputOrg.value.trim(),
      project: inputProject.value.trim(),
      pat: inputPat.value.trim()
    };

    showFeedback('Probando conexión con Azure DevOps...', 'info');

    chrome.runtime.sendMessage({ action: 'TEST_CONNECTION', credentials: creds }, (response) => {
      if (chrome.runtime.lastError) {
        showFeedback(`Error de extensión: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }

      if (response && response.success) {
        showFeedback(response.message, 'success');
        updateStatusBadge(true, 'Conectado');
      } else {
        showFeedback(response ? response.message : 'Error desconocido de conexión', 'error');
        updateStatusBadge(false, 'Error de Conexión');
      }
    });
  });

  // 6. Save Credentials Form
  formCredentials.addEventListener('submit', async (e) => {
    e.preventDefault();
    const current = (await chrome.storage.local.get('settings')).settings || {};

    const updatedSettings = {
      ...current,
      org: inputOrg.value.trim(),
      project: inputProject.value.trim(),
      pat: inputPat.value.trim(),
      assignedUser: inputAssignedUser.value.trim(),
      filterHUByUser: chkFilterHUByUser ? chkFilterHUByUser.checked : false,
      pollingInterval: parseInt(inputInterval.value, 10),
      enableDesktopNotifications: chkNotifications.checked,
      enableInPageToasts: chkToasts.checked,
      enableSound: chkSound.checked
    };

    await chrome.storage.local.set({ settings: updatedSettings });
    showFeedback('¡Configuración guardada exitosamente!', 'success');
    updateStatusBadge(true, 'Conectado');

    // Trigger sync
    chrome.runtime.sendMessage({ action: 'TRIGGER_MANUAL_SYNC' });
  });

  // 7. Save Mappings Form
  btnSaveMappings.addEventListener('click', async () => {
    const current = (await chrome.storage.local.get('settings')).settings || {};
    const parseList = (str) => str.split(',').map(s => s.trim()).filter(Boolean);

    const updatedMappings = {
      huTypes: parseList(mapHuTypes.value),
      bugTypes: parseList(mapBugTypes.value),
      newBugStates: parseList(mapNewBugStates.value),
      qaBugStates: parseList(mapQaBugStates.value),
      reopenBugStates: parseList(mapReopenBugStates.value),
      doneBugStates: parseList(mapDoneBugStates.value),
      qaHuStates: parseList(mapQaHuStates.value),
      reviewPoHuStates: parseList(mapReviewPoHuStates.value),
      doneHuStates: mapDoneHuStates ? parseList(mapDoneHuStates.value) : (current.stateMappings?.doneHuStates || []),
      impedimentHuStates: mapImpedimentHuStates ? parseList(mapImpedimentHuStates.value) : (current.stateMappings?.impedimentHuStates || []),
      stageHuStates: mapStageHuStates ? parseList(mapStageHuStates.value) : (current.stateMappings?.stageHuStates || [])
    };

    const updatedSettings = {
      ...current,
      stateMappings: updatedMappings
    };

    await chrome.storage.local.set({ settings: updatedSettings });
    alert('¡Mapeo de estados actualizado correctamente!');
  });

  // 8. Test Sound Button
  if (btnTestSound) {
    btnTestSound.addEventListener('click', () => {
      playNotificationChime(true);
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ action: 'TRIGGER_TEST_SOUND' }).catch(() => {});
      }
    });
  }

  // 9. Test Notification Triggers (Tester Tab)
  document.querySelectorAll('.btn-test').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-category');
      chrome.runtime.sendMessage({ action: 'TRIGGER_TEST_NOTIFICATION', category }, () => {
        loadHistory();
      });
    });
  });

  // 10. Manual Sync Header Button
  btnManualSync.addEventListener('click', () => {
    btnManualSync.disabled = true;
    btnManualSync.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> Sincronizando...`;

    chrome.runtime.sendMessage({ action: 'TRIGGER_MANUAL_SYNC' }, (res) => {
      btnManualSync.disabled = false;
      btnManualSync.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> Sincronizar Ahora`;
      
      if (res && res.success) {
        alert(`Sincronización completada. Alertas encontradas: ${res.updatedCount}`);
        loadHistory();
      } else {
        alert(`Error al sincronizar: ${res ? res.message : 'Error desconocido'}`);
      }
    });
  });

  // 11. History Log, Selection & Bulk Deletion
  let currentActiveFilter = 'all';

  async function loadHistory(filterCategory = currentActiveFilter) {
    currentActiveFilter = filterCategory;
    const { history = [] } = await chrome.storage.local.get('history');

    historyList.innerHTML = '';
    selectedHistoryIds.clear();
    updateBulkActionButtons();
    if (chkSelectAllHistory) chkSelectAllHistory.checked = false;

    let filtered = history;
    if (filterCategory === 'unread') {
      filtered = history.filter(h => !h.read);
    } else if (filterCategory !== 'all') {
      filtered = history.filter(h => h.category === filterCategory);
    }

    if (filtered.length === 0) {
      historyEmptyState.style.display = 'block';
      historyList.style.display = 'none';
      return;
    }

    historyEmptyState.style.display = 'none';
    historyList.style.display = 'flex';

    filtered.forEach(item => {
      const li = document.createElement('li');
      const isRead = item.read === true;
      li.className = `history-item ${isRead ? 'is-read' : 'is-unread'}`;

      const dateStr = item.timestamp ? new Date(item.timestamp).toLocaleString('es-ES') : '';

      li.innerHTML = `
        <input type="checkbox" class="history-checkbox" data-id="${item.id}">
        <div class="history-tag-group">
          ${!isRead ? '<span class="history-unread-dot" title="No leída"></span>' : '<span class="history-read-check" title="Leída">✓</span>'}
          <span class="history-tag ${item.category}">${getPillLabel(item.category)}</span>
        </div>
        <div class="history-details">
          <div class="history-title">${escapeHtml(item.title)}</div>
          <div class="history-msg">${escapeHtml(item.message)}</div>
        </div>
        <div class="history-actions">
          <span class="history-time">${dateStr}</span>
          ${item.url ? `<a href="${item.url}" target="_blank" class="link-icon link-open-ado">Abrir ↗</a>` : ''}
          <button class="history-delete-btn" title="Eliminar esta alerta">&times;</button>
        </div>
      `;

      // Checkbox listener
      const chk = li.querySelector('.history-checkbox');
      chk.addEventListener('change', () => {
        if (chk.checked) {
          selectedHistoryIds.add(item.id);
        } else {
          selectedHistoryIds.delete(item.id);
        }
        updateBulkActionButtons();
      });

      // Single item delete listener
      const btnSingleDelete = li.querySelector('.history-delete-btn');
      btnSingleDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage({ action: 'DELETE_HISTORY_ITEM', id: item.id }, () => {
          loadHistory(currentActiveFilter);
        });
      });

      // Click on Open ADO link or item marks as read
      const linkOpen = li.querySelector('.link-open-ado');
      if (linkOpen) {
        linkOpen.addEventListener('click', () => {
          if (!isRead && item.id) {
            chrome.runtime.sendMessage({ action: 'MARK_AS_READ', id: item.id }, () => {
              loadHistory(currentActiveFilter);
            });
          }
        });
      }

      historyList.appendChild(li);
    });
  }

  // Select All Checkbox
  if (chkSelectAllHistory) {
    chkSelectAllHistory.addEventListener('change', () => {
      const checkboxes = historyList.querySelectorAll('.history-checkbox');
      selectedHistoryIds.clear();

      checkboxes.forEach(chk => {
        chk.checked = chkSelectAllHistory.checked;
        if (chkSelectAllHistory.checked) {
          const id = chk.getAttribute('data-id');
          if (id) selectedHistoryIds.add(id);
        }
      });
      updateBulkActionButtons();
    });
  }

  // Mark Selected Read Button
  if (btnMarkSelectedRead) {
    btnMarkSelectedRead.addEventListener('click', () => {
      if (selectedHistoryIds.size === 0) return;
      const idsArray = Array.from(selectedHistoryIds);
      chrome.runtime.sendMessage({ action: 'MARK_MULTIPLE_READ', ids: idsArray }, () => {
        loadHistory(currentActiveFilter);
      });
    });
  }

  // Mark All Read Button
  if (btnMarkAllRead) {
    btnMarkAllRead.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'MARK_ALL_AS_READ' }, () => {
        loadHistory(currentActiveFilter);
      });
    });
  }

  // Delete Selected Button
  if (btnDeleteSelected) {
    btnDeleteSelected.addEventListener('click', () => {
      if (selectedHistoryIds.size === 0) return;
      if (confirm(`¿Deseas eliminar los ${selectedHistoryIds.size} elementos seleccionados?`)) {
        const idsArray = Array.from(selectedHistoryIds);
        chrome.runtime.sendMessage({ action: 'DELETE_MULTIPLE_HISTORY', ids: idsArray }, () => {
          loadHistory(currentActiveFilter);
        });
      }
    });
  }

  function updateBulkActionButtons() {
    const count = selectedHistoryIds.size;
    if (selectedCount) selectedCount.textContent = count;
    if (selectedReadCount) selectedReadCount.textContent = count;

    if (btnDeleteSelected) {
      if (count > 0) {
        btnDeleteSelected.classList.remove('hidden');
      } else {
        btnDeleteSelected.classList.add('hidden');
      }
    }

    if (btnMarkSelectedRead) {
      if (count > 0) {
        btnMarkSelectedRead.classList.remove('hidden');
      } else {
        btnMarkSelectedRead.classList.add('hidden');
      }
    }
  }

  // Filter Chips
  filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      loadHistory(chip.getAttribute('data-filter'));
    });
  });

  // Clear All History
  btnClearHistory.addEventListener('click', () => {
    if (confirm('¿Deseas borrar todo el historial de notificaciones?')) {
      chrome.runtime.sendMessage({ action: 'CLEAR_HISTORY' }, () => {
        loadHistory(currentActiveFilter);
      });
    }
  });

  // Helper Utilities
  function showFeedback(msg, type) {
    testFeedback.textContent = msg;
    testFeedback.className = `feedback-banner ${type}`;
  }

  function updateStatusBadge(isConnected, text) {
    connectionStatusBadge.className = `status-badge ${isConnected ? 'connected' : 'disconnected'}`;
    connectionStatusBadge.querySelector('.status-text').textContent = text;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
