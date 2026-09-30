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
  function switchTab(tabTarget) {
    if (!tabTarget) return;
    const cleanTarget = tabTarget.replace('tab-', '');
    navItems.forEach(n => n.classList.remove('active'));
    tabPages.forEach(p => p.classList.remove('active'));

    const item = document.querySelector(`.nav-item[data-tab="${cleanTarget}"]`);
    if (item) item.classList.add('active');

    const targetPage = document.getElementById(`tab-${cleanTarget}`);
    if (targetPage) {
      targetPage.classList.add('active');
    }

    if (cleanTarget === 'history') {
      loadHistory();
    }

    if (cleanTarget === 'time-history') {
      initTimeHistoryTab();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabTarget = item.getAttribute('data-tab');
      switchTab(tabTarget);
    });
  });

  // Handle URL hash or tab parameter on load
  const hashTarget = window.location.hash.replace('#', '') || new URLSearchParams(window.location.search).get('tab');
  if (hashTarget) {
    switchTab(hashTarget);
  }

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

  // 4. Load Saved Settings & Today's Hours
  const portalTodayHoursText = document.getElementById('portalTodayHoursText');
  const portalTodayHoursBadge = document.getElementById('portalTodayHoursBadge');

  // Helper to get local date key in YYYY-MM-DD format
  function getTodayKey(d = new Date()) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper to validate today's date strictly in local time
  function isDateToday(dateVal) {
    if (!dateVal) return false;

    const now = new Date();
    const todayYear = now.getFullYear();
    const todayMonth = now.getMonth() + 1; // 1-indexed (1 to 12)
    const todayDate = now.getDate();

    if (typeof dateVal === 'number' || dateVal instanceof Date) {
      const d = new Date(dateVal);
      return !isNaN(d.getTime()) && d.getFullYear() === todayYear && (d.getMonth() + 1) === todayMonth && d.getDate() === todayDate;
    }

    if (typeof dateVal === 'string') {
      const trimmed = dateVal.trim();
      if (!trimmed) return false;

      // 1. /Date(1790113502310)/ or \/Date(1790113502310)\/
      const dateMatch = trimmed.match(/\/Date\((\d+)\)/);
      if (dateMatch) {
        const d = new Date(parseInt(dateMatch[1], 10));
        return !isNaN(d.getTime()) && d.getFullYear() === todayYear && (d.getMonth() + 1) === todayMonth && d.getDate() === todayDate;
      }

      // 2. DD/MM/YYYY or DD-MM-YYYY (e.g., "22/09/2026" or "22/09/2026 14:55")
      const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (ddmmyyyy) {
        const day = parseInt(ddmmyyyy[1], 10);
        const month = parseInt(ddmmyyyy[2], 10);
        const year = parseInt(ddmmyyyy[3], 10);
        return day === todayDate && month === todayMonth && year === todayYear;
      }

      // 3. ISO date string parse with timezone (e.g. "2026-09-22T21:45:00Z")
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        if (d.getFullYear() === todayYear && (d.getMonth() + 1) === todayMonth && d.getDate() === todayDate) {
          return true;
        }
      }

      // 4. Calendar date-only string (e.g. "2026-09-22" or "2026-09-22T00:00:00Z")
      const yyyymmdd = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (yyyymmdd) {
        const year = parseInt(yyyymmdd[1], 10);
        const month = parseInt(yyyymmdd[2], 10);
        const day = parseInt(yyyymmdd[3], 10);
        if (trimmed.includes('T00:00:00') || !trimmed.includes('T')) {
          return day === todayDate && month === todayMonth && year === todayYear;
        }
      }
    }

    return false;
  }

  async function updatePortalTodayHours() {
    if (!portalTodayHoursText) return;
    const now = new Date();
    const currentTodayKey = getTodayKey(now);
    const { todayCompletedHours = 0, todayTasksSummary } = await chrome.storage.local.get(['todayCompletedHours', 'todayTasksSummary']);

    let hoursToday = 0;
    let taskList = [];
    if (todayTasksSummary && todayTasksSummary.dateKey === currentTodayKey) {
      const rawTasks = Array.isArray(todayTasksSummary.tasks) ? todayTasksSummary.tasks : [];
      const validTasks = rawTasks.filter(t => t && t.workingDate && isDateToday(t.workingDate));
      taskList = validTasks;
      hoursToday = Math.round(validTasks.reduce((acc, t) => acc + (t.hours || 0), 0) * 100) / 100;

      // Sanitize storage if outdated tasks from other days or calculation discrepancies exist
      if (hoursToday !== todayTasksSummary.totalHours || validTasks.length !== rawTasks.length || todayCompletedHours !== hoursToday) {
        chrome.storage.local.set({
          todayCompletedHours: hoursToday,
          todayTasksSummary: {
            ...todayTasksSummary,
            totalHours: hoursToday,
            taskCount: validTasks.length,
            tasks: validTasks
          }
        });
      }
    } else if (todayTasksSummary && todayTasksSummary.date && isDateToday(todayTasksSummary.date)) {
      const rawTasks = Array.isArray(todayTasksSummary.tasks) ? todayTasksSummary.tasks : [];
      const validTasks = rawTasks.filter(t => t && t.workingDate && isDateToday(t.workingDate));
      taskList = validTasks;
      hoursToday = Math.round(validTasks.reduce((acc, t) => acc + (t.hours || 0), 0) * 100) / 100;

      chrome.storage.local.set({
        todayCompletedHours: hoursToday,
        todayTasksSummary: {
          ...todayTasksSummary,
          dateKey: currentTodayKey,
          totalHours: hoursToday,
          taskCount: validTasks.length,
          tasks: validTasks
        }
      });
    } else {
      // Nuevo día: reiniciar a 0 y limpiar almacenamiento
      hoursToday = 0;
      taskList = [];
      chrome.storage.local.set({
        todayCompletedHours: 0,
        todayTasksSummary: {
          date: now.toISOString(),
          dateKey: currentTodayKey,
          totalHours: 0,
          taskCount: 0,
          tasks: [],
          tasksMap: {}
        }
      });
    }

    const formatted = (hoursToday % 1 === 0) ? `${hoursToday}h` : `${hoursToday.toFixed(1)}h`;
    portalTodayHoursText.textContent = formatted;

    if (portalTodayHoursBadge) {
      if (taskList.length > 0) {
        const lines = taskList.map(t => `• #${t.id} [${t.hours}h] (${t.state || 'Task'}) ${t.title}`);
        portalTodayHoursBadge.title = `Total: ${formatted} acumuladas hoy (${taskList.length} tarea${taskList.length > 1 ? 's' : ''}):\n` + lines.join('\n');
      } else if (hoursToday > 0) {
        portalTodayHoursBadge.title = `Total: ${formatted} acumuladas hoy en tus tareas.`;
        portalTodayHoursBadge.title = '0h registradas hoy. Se actualiza automáticamente conforme sincronizas con Azure DevOps.';
      }
    }
    if (portalTodayHoursBadge) {
      portalTodayHoursBadge.style.cursor = 'pointer';
      portalTodayHoursBadge.addEventListener('click', () => switchTab('time-history'));
    }
  }

  await updatePortalTodayHours();

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.todayCompletedHours || changes.todayTasksSummary || changes.lastSync)) {
      updatePortalTodayHours();
    }
  });

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
        if (response.authenticatedUser && !inputAssignedUser.value.trim()) {
          inputAssignedUser.value = response.authenticatedUser;
        }
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

    chrome.runtime.sendMessage({ action: 'TRIGGER_MANUAL_SYNC' }, async (res) => {
      btnManualSync.disabled = false;
      btnManualSync.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg> Sincronizar Ahora`;
      
      if (res && res.success) {
        await updatePortalTodayHours();
        alert(`Sincronización completada. Horas hoy: ${res.todayCompletedHours ?? 0}h. Alertas: ${res.updatedCount}`);
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

  // ==========================================================================
  // MODULE: TASK & TIME HISTORY BY TEAM SPRINT (Done & Completed Work)
  // ==========================================================================

  let timeHistoryInitialized = false;
  let timeHistoryCurrentData = null;
  let timeHistoryTeamsList = [];
  let timeHistoryCurrentFilterText = '';

  const TEAM_PALETTE = [
    '#DD700B', // Vibrant Amber Orange (Palette)
    '#34D399', // Emerald Mint
    '#FCF8D8', // Warm Cream (Palette)
    '#C084FC', // Purple Amethyst
    '#FBBF24', // Amber Gold
    '#ADACA7', // Warm Silver (Palette)
    '#F87171', // Coral Red
    '#7C7D75'  // Slate Stone (Palette)
  ];

  // DOM Elements for Time History
  const timeFilterStartDate = document.getElementById('timeFilterStartDate');
  const timeFilterEndDate = document.getElementById('timeFilterEndDate');
  const timeFilterTeam = document.getElementById('timeFilterTeam');
  const timeFilterSprint = document.getElementById('timeFilterSprint');
  const btnReloadTeams = document.getElementById('btnReloadTeams');
  const timeFilterUser = document.getElementById('timeFilterUser');
  const btnQueryTimeHistory = document.getElementById('btnQueryTimeHistory');
  const timeQueryFeedback = document.getElementById('timeQueryFeedback');
  const timePresetChips = document.querySelectorAll('.time-preset-chip');
  const sprintQuickAction = document.getElementById('sprintQuickAction');
  const btnApplySprintDates = document.getElementById('btnApplySprintDates');

  const kpiTotalHours = document.getElementById('kpiTotalHours');
  const kpiTotalTasks = document.getElementById('kpiTotalTasks');
  const kpiTotalTeams = document.getElementById('kpiTotalTeams');
  const kpiAvgHours = document.getElementById('kpiAvgHours');
  const kpiDateRangeBadge = document.getElementById('kpiDateRangeBadge');
  const kpiHoursDesc = document.getElementById('kpiHoursDesc');
  const kpiTeamsDesc = document.getElementById('kpiTeamsDesc');

  const teamSegmentedBar = document.getElementById('teamSegmentedBar');
  const teamPillsRow = document.getElementById('teamPillsRow');
  const distributionTotalBadge = document.getElementById('distributionTotalBadge');

  const viewTabBtns = document.querySelectorAll('.view-tab-btn');
  const viewTeamSprintsContainer = document.getElementById('viewTeamSprintsContainer');
  const viewAllTasksContainer = document.getElementById('viewAllTasksContainer');
  const viewDailyLogContainer = document.getElementById('viewDailyLogContainer');

  const timeTasksSearch = document.getElementById('timeTasksSearch');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const teamSprintsAccordion = document.getElementById('teamSprintsAccordion');
  const allTasksTableBody = document.getElementById('allTasksTableBody');
  const dailyLogTree = document.getElementById('dailyLogTree');
  const allTasksCount = document.getElementById('allTasksCount');

  const timeEmptyState = document.getElementById('timeEmptyState');
  const timeEmptyStateText = document.getElementById('timeEmptyStateText');
  const btnExportTimeCsv = document.getElementById('btnExportTimeCsv');
  const btnCopyTimeSummary = document.getElementById('btnCopyTimeSummary');

  // Format Helper: YYYY-MM-DD
  function toYmd(dateObj) {
    if (!dateObj || isNaN(dateObj.getTime())) return '';
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // Calculate Date Ranges for Quick Presets
  function applyDatePreset(presetKey) {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (presetKey === 'today') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (presetKey === 'thisWeek') {
      // Monday to Sunday of current week
      const day = now.getDay();
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
      end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    } else if (presetKey === 'thisMonth') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (presetKey === 'last30Days') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (presetKey === 'currentSprint') {
      // Check if selected sprint has dates
      if (timeFilterSprint && timeFilterSprint.selectedIndex > 0) {
        const opt = timeFilterSprint.options[timeFilterSprint.selectedIndex];
        if (opt && opt.getAttribute('data-start') && opt.getAttribute('data-end')) {
          const s = parseAnyDate(opt.getAttribute('data-start'));
          const e = parseAnyDate(opt.getAttribute('data-end'));
          if (s) start = s;
          if (e) end = e;
        }
      }
    }

    if (timeFilterStartDate) timeFilterStartDate.value = toYmd(start);
    if (timeFilterEndDate) timeFilterEndDate.value = toYmd(end);
  }

  // Load Teams from Azure DevOps
  async function loadTeamsDropdown(forceRefresh = false) {
    if (!timeFilterTeam) return;
    try {
      if (btnReloadTeams) btnReloadTeams.classList.add('rotating');
      timeFilterTeam.disabled = true;

      const { settings = {} } = await chrome.storage.local.get('settings');
      if (timeFilterUser && !timeFilterUser.value && settings.assignedUser) {
        timeFilterUser.value = settings.assignedUser;
      }

      chrome.runtime.sendMessage({ action: 'GET_PROJECT_TEAMS' }, (res) => {
        if (btnReloadTeams) btnReloadTeams.classList.remove('rotating');
        timeFilterTeam.disabled = false;

        if (res && res.success && Array.isArray(res.teams) && res.teams.length > 0) {
          timeHistoryTeamsList = res.teams;
          const currentVal = timeFilterTeam.value;
          timeFilterTeam.innerHTML = `<option value="ALL">Todos los Equipos (Consulta General)</option>`;
          for (const team of res.teams) {
            const opt = document.createElement('option');
            opt.value = team.name;
            opt.textContent = team.name;
            timeFilterTeam.appendChild(opt);
          }
          if (currentVal && currentVal !== 'ALL') {
            timeFilterTeam.value = currentVal;
          }
        } else {
          timeHistoryTeamsList = [];
          timeFilterTeam.innerHTML = `<option value="ALL">Todos los Equipos (Consulta General)</option>`;
        }
      });
    } catch (e) {
      if (btnReloadTeams) btnReloadTeams.classList.remove('rotating');
      timeFilterTeam.disabled = false;
    }
  }

  // Load Sprints for Selected Team
  async function loadSprintsForTeam(teamName) {
    if (!timeFilterSprint) return;
    if (!teamName || teamName === 'ALL') {
      timeFilterSprint.innerHTML = `<option value="ALL">Todos los Sprints</option>`;
      if (sprintQuickAction) sprintQuickAction.classList.add('hidden');
      return;
    }

    timeFilterSprint.innerHTML = `<option value="ALL">Cargando sprints...</option>`;
    timeFilterSprint.disabled = true;

    chrome.runtime.sendMessage({ action: 'GET_TEAM_ITERATIONS', teamId: teamName }, (res) => {
      timeFilterSprint.disabled = false;
      timeFilterSprint.innerHTML = `<option value="ALL">Todos los Sprints (${teamName})</option>`;

      if (res && res.success && Array.isArray(res.iterations) && res.iterations.length > 0) {
        let currentOpt = null;
        for (const iter of res.iterations) {
          const opt = document.createElement('option');
          opt.value = iter.name;
          opt.setAttribute('data-path', iter.path || '');
          opt.setAttribute('data-start', iter.startDate || '');
          opt.setAttribute('data-end', iter.finishDate || '');

          let dateLabel = '';
          if (iter.startDate && iter.finishDate) {
            const sd = parseAnyDate(iter.startDate);
            const ed = parseAnyDate(iter.finishDate);
            if (sd && ed) {
              dateLabel = ` (${sd.getDate()}/${sd.getMonth() + 1} - ${ed.getDate()}/${ed.getMonth() + 1}/${ed.getFullYear()})`;
            }
          }
          const isCurrent = iter.timeFrame === 'current';
          opt.textContent = `${iter.name}${dateLabel}${isCurrent ? ' [Actual]' : ''}`;
          if (isCurrent && !currentOpt) currentOpt = opt;
          timeFilterSprint.appendChild(opt);
        }

        if (currentOpt) {
          currentOpt.selected = true;
          onSprintSelectionChanged();
        }
      } else {
        timeFilterSprint.innerHTML = `<option value="ALL">Todos los Sprints (${teamName})</option>`;
      }
    });
  }

  function onSprintSelectionChanged() {
    if (!timeFilterSprint || !sprintQuickAction) return;
    const selected = timeFilterSprint.options[timeFilterSprint.selectedIndex];
    if (selected && selected.getAttribute('data-start') && selected.getAttribute('data-end')) {
      sprintQuickAction.classList.remove('hidden');
    } else {
      sprintQuickAction.classList.add('hidden');
    }
  }

  // Execute Main Query
  async function queryTimeHistory() {
    if (!btnQueryTimeHistory) return;

    const btnText = btnQueryTimeHistory.querySelector('.btn-search-text');
    const spinner = btnQueryTimeHistory.querySelector('.btn-search-spinner');
    const icon = btnQueryTimeHistory.querySelector('.btn-search-icon');

    if (spinner) spinner.classList.remove('hidden');
    if (icon) icon.classList.add('hidden');
    if (btnText) btnText.textContent = 'Consultando...';
    btnQueryTimeHistory.disabled = true;

    if (timeQueryFeedback) {
      timeQueryFeedback.className = 'feedback-banner hidden';
      timeQueryFeedback.textContent = '';
    }

    const params = {
      startDate: timeFilterStartDate ? timeFilterStartDate.value : '',
      endDate: timeFilterEndDate ? timeFilterEndDate.value : '',
      teamFilter: timeFilterTeam ? timeFilterTeam.value : 'ALL',
      sprintFilter: timeFilterSprint ? timeFilterSprint.value : 'ALL',
      userFilter: timeFilterUser ? timeFilterUser.value.trim() : ''
    };

    chrome.runtime.sendMessage({ action: 'QUERY_TASK_TIME_HISTORY', params }, (response) => {
      if (spinner) spinner.classList.add('hidden');
      if (icon) icon.classList.remove('hidden');
      if (btnText) btnText.textContent = 'Consultar Tareas';
      btnQueryTimeHistory.disabled = false;

      if (chrome.runtime.lastError) {
        showTimeFeedback(`Error de extensión: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }

      if (!response || !response.success) {
        showTimeFeedback(response?.message || 'Error al consultar las tareas taskeadas.', 'error');
        return;
      }

      timeHistoryCurrentData = response;
      renderTimeHistoryDashboard(response);
    });
  }

  function showTimeFeedback(msg, type = 'info') {
    if (!timeQueryFeedback) return;
    timeQueryFeedback.textContent = msg;
    timeQueryFeedback.className = `feedback-banner ${type}`;
    timeQueryFeedback.classList.remove('hidden');
  }

  // Render Dashboard
  function renderTimeHistoryDashboard(data) {
    if (!data) return;

    const { totalHours = 0, totalTasks = 0, teams = [], dailyLog = [], tasks = [] } = data;

    // 1. KPI Cards
    if (kpiTotalHours) kpiTotalHours.textContent = `${totalHours}h`;
    if (kpiTotalTasks) kpiTotalTasks.textContent = totalTasks;
    if (kpiTotalTeams) kpiTotalTeams.textContent = teams.length;
    if (kpiAvgHours) {
      const avg = totalTasks > 0 ? (totalHours / totalTasks).toFixed(1) : '0';
      kpiAvgHours.textContent = `${avg}h`;
    }

    if (kpiDateRangeBadge) {
      const start = timeFilterStartDate?.value;
      const end = timeFilterEndDate?.value;
      if (start && end) {
        kpiDateRangeBadge.textContent = `${start} ➔ ${end}`;
      } else if (start) {
        kpiDateRangeBadge.textContent = `Desde ${start}`;
      } else {
        kpiDateRangeBadge.textContent = 'Rango general';
      }
    }

    if (distributionTotalBadge) {
      distributionTotalBadge.textContent = `Total: ${totalHours}h (${totalTasks} tareas)`;
    }

    // 2. Cross-Team Segmented Progress Bar & Team Pills
    renderCrossTeamDistribution(teams, totalHours);

    // 3. Render Views
    renderViewTeamSprints(teams);
    renderViewAllTasks(tasks);
    renderViewDailyLog(dailyLog);

    // 4. Empty State
    if (timeEmptyState) {
      if (tasks.length === 0) {
        timeEmptyState.classList.remove('hidden');
        if (timeEmptyStateText) {
          timeEmptyStateText.textContent = 'No se encontraron tareas en estado Done con tiempo imputado (Completed Work) en este rango de fechas.';
        }
      } else {
        timeEmptyState.classList.add('hidden');
      }
    }

    // 5. Apply any active live search query
    if (timeHistoryCurrentFilterText) {
      filterTasksRealtime(timeHistoryCurrentFilterText);
    }
  }

  // Render Cross-Team Distribution (Segmented Bar + Pills)
  function renderCrossTeamDistribution(teams, totalHours) {
    if (!teamSegmentedBar || !teamPillsRow) return;

    teamSegmentedBar.innerHTML = '';
    teamPillsRow.innerHTML = '';

    if (!teams || teams.length === 0 || totalHours <= 0) {
      teamSegmentedBar.innerHTML = `<div class="empty-bar-fill" style="width: 100%;"></div>`;
      teamPillsRow.innerHTML = `<span class="text-muted-sm">Sin horas registradas en los equipos seleccionados.</span>`;
      return;
    }

    teams.forEach((team, idx) => {
      const color = TEAM_PALETTE[idx % TEAM_PALETTE.length];
      const pct = team.percentage || (totalHours > 0 ? Math.round((team.totalHours / totalHours) * 1000) / 10 : 0);

      // Segment
      const segment = document.createElement('div');
      segment.className = 'bar-segment';
      segment.style.width = `${pct}%`;
      segment.style.backgroundColor = color;
      segment.title = `${team.name}: ${team.totalHours}h (${pct}%)`;
      teamSegmentedBar.appendChild(segment);

      // Pill
      const pill = document.createElement('div');
      pill.className = 'team-pill';
      pill.innerHTML = `
        <span class="team-pill-dot" style="background-color: ${color}; box-shadow: 0 0 6px ${color};"></span>
        <span class="team-pill-name">${escapeHtml(team.name)}</span>
        <span class="team-pill-hours">${team.totalHours}h</span>
        <span class="team-pill-pct">(${pct}%)</span>
      `;

      pill.addEventListener('click', () => {
        if (timeFilterTeam) {
          timeFilterTeam.value = team.name;
          loadSprintsForTeam(team.name);
          queryTimeHistory();
        }
      });

      teamPillsRow.appendChild(pill);
    });
  }

  // View 1: Team Sprints Accordion
  function renderViewTeamSprints(teams) {
    if (!teamSprintsAccordion) return;
    teamSprintsAccordion.innerHTML = '';

    if (!teams || teams.length === 0) return;

    teams.forEach((team, teamIdx) => {
      const color = TEAM_PALETTE[teamIdx % TEAM_PALETTE.length];
      const teamCard = document.createElement('div');
      teamCard.className = 'team-card';
      teamCard.setAttribute('data-team-name', (team.name || '').toLowerCase());

      const sprints = team.sprintsList || Object.values(team.sprints || {});

      teamCard.innerHTML = `
        <div class="team-card-header">
          <div class="team-title-group">
            <div class="team-badge-icon" style="border-color: ${color};">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <div>
              <div class="team-name-text">${escapeHtml(team.name)}</div>
              <div class="team-tasks-count">${sprints.length} sprint${sprints.length > 1 ? 's' : ''} • ${team.taskCount} tarea${team.taskCount > 1 ? 's' : ''}</div>
            </div>
          </div>
          <div class="team-stats-row">
            <div class="team-hours-badge" style="border-color: ${color}; color: ${color}; background: rgba(255,255,255,0.06);">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>${team.totalHours}h</span>
            </div>
            <svg class="accordion-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>
        <div class="team-card-body"></div>
      `;

      const header = teamCard.querySelector('.team-card-header');
      header.addEventListener('click', () => {
        teamCard.classList.toggle('collapsed');
      });

      const body = teamCard.querySelector('.team-card-body');

      sprints.forEach(sprint => {
        const sprintCard = document.createElement('div');
        sprintCard.className = 'sprint-subcard';
        sprintCard.setAttribute('data-sprint-name', (sprint.name || '').toLowerCase());

        let tasksHtml = '';
        (sprint.tasks || []).forEach(task => {
          tasksHtml += `
            <tr class="task-row" data-search="${escapeHtml(`${task.id} ${task.title} ${task.activity} ${sprint.name} ${team.name}`.toLowerCase())}">
              <td style="width: 85px;">
                <a href="${task.url || '#'}" target="_blank" class="task-id-badge" title="Abrir tarea en Azure DevOps">
                  #${task.id}
                </a>
              </td>
              <td style="width: 320px;">
                <div class="task-title-cell" title="${escapeHtml(task.title)}">
                  ${escapeHtml(task.title)}
                </div>
              </td>
              <td style="width: 95px; text-align: right;">
                <span class="hours-pill-badge">${task.hours}h</span>
              </td>
              <td style="width: 130px;">
                <span class="text-muted-sm">${escapeHtml(task.dateFormatted || task.rawDate || '')}</span>
              </td>
              <td style="width: 105px;">
                <span class="activity-badge">${escapeHtml(task.activity || 'General')}</span>
              </td>
              <td style="width: 85px; text-align: center;">
                <span class="state-done-badge">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Done</span>
                </span>
              </td>
            </tr>
          `;
        });

        sprintCard.innerHTML = `
          <div class="sprint-header-row">
            <div class="sprint-name-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              <span>${escapeHtml(sprint.name)}</span>
            </div>
            <div class="sprint-subtotal">
              Subtotal: <strong>${sprint.totalHours}h</strong> (${(sprint.tasks || []).length} tareas)
            </div>
          </div>
          <div class="table-responsive">
            <table class="styled-tasks-table sprint-table">
              <thead>
                <tr>
                  <th style="width: 85px;">ID</th>
                  <th style="width: 320px;">Título de la Tarea</th>
                  <th style="width: 95px; text-align: right;">Completed</th>
                  <th style="width: 130px;">Fecha Trabajo</th>
                  <th style="width: 105px;">Actividad</th>
                  <th style="width: 85px; text-align: center;">Estado</th>
                </tr>
              </thead>
              <tbody>
                ${tasksHtml}
              </tbody>
            </table>
          </div>
        `;

        body.appendChild(sprintCard);
      });

      teamSprintsAccordion.appendChild(teamCard);
    });
  }

  // View 2: All Tasks Flat Table
  function renderViewAllTasks(tasks) {
    if (!allTasksTableBody) return;
    allTasksTableBody.innerHTML = '';
    if (allTasksCount) allTasksCount.textContent = tasks.length;

    if (!tasks || tasks.length === 0) return;

    tasks.forEach(task => {
      const tr = document.createElement('tr');
      tr.className = 'task-row';
      tr.setAttribute('data-search', `${task.id} ${task.title} ${task.teamName} ${task.sprintName} ${task.activity}`.toLowerCase());

      tr.innerHTML = `
        <td style="width: 85px;">
          <a href="${task.url || '#'}" target="_blank" class="task-id-badge" title="Abrir tarea en Azure DevOps">
            #${task.id}
          </a>
        </td>
        <td style="width: 280px;">
          <div class="task-title-cell" title="${escapeHtml(task.title)}">
            ${escapeHtml(task.title)}
          </div>
        </td>
        <td style="width: 200px;">
          <span class="task-team-pill" title="${escapeHtml(task.teamName || 'Equipo General')}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span class="pill-text">${escapeHtml(task.teamName || 'General')}</span>
          </span>
        </td>
        <td style="width: 130px;">
          <span class="task-sprint-pill" title="${escapeHtml(task.sprintName || 'Sprint General')}">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
            <span class="pill-text">${escapeHtml(task.sprintName || 'General')}</span>
          </span>
        </td>
        <td style="width: 95px; text-align: right;">
          <span class="hours-pill-badge">${task.hours}h</span>
        </td>
        <td style="width: 130px;">
          <span class="text-muted-sm">${escapeHtml(task.dateFormatted || task.rawDate || '')}</span>
        </td>
        <td style="width: 105px;">
          <span class="activity-badge">${escapeHtml(task.activity || 'General')}</span>
        </td>
        <td style="width: 85px; text-align: center;">
          <span class="state-done-badge">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Done</span>
          </span>
        </td>
      `;

      allTasksTableBody.appendChild(tr);
    });
  }

  // View 3: Daily Log Timeline
  function renderViewDailyLog(dailyLog) {
    if (!dailyLogTree) return;
    dailyLogTree.innerHTML = '';

    if (!dailyLog || dailyLog.length === 0) return;

    dailyLog.forEach(day => {
      const card = document.createElement('div');
      card.className = 'daily-card';

      let tasksHtml = '';
      (day.tasks || []).forEach(task => {
        tasksHtml += `
          <tr class="task-row" data-search="${escapeHtml(`${task.id} ${task.title} ${task.teamName} ${task.sprintName}`.toLowerCase())}">
            <td style="width: 85px;">
              <a href="${task.url || '#'}" target="_blank" class="task-id-badge" title="Abrir tarea en Azure DevOps">#${task.id}</a>
            </td>
            <td style="width: 300px;">
              <div class="task-title-cell" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</div>
            </td>
            <td style="width: 200px;">
              <span class="task-team-pill" title="${escapeHtml(task.teamName || 'Equipo')}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                <span class="pill-text">${escapeHtml(task.teamName || 'General')}</span>
              </span>
            </td>
            <td style="width: 130px;">
              <span class="task-sprint-pill" title="${escapeHtml(task.sprintName || 'Sprint')}">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                <span class="pill-text">${escapeHtml(task.sprintName || 'General')}</span>
              </span>
            </td>
            <td style="text-align: right; width: 90px;">
              <span class="hours-pill-badge">${task.hours}h</span>
            </td>
          </tr>
        `;
      });

      card.innerHTML = `
        <div class="daily-header">
          <div class="daily-date-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>${escapeHtml(day.dateFormatted || day.dateKey)}</span>
          </div>
          <div class="daily-hours-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span>${day.totalHours}h acumuladas (${day.taskCount} tarea${day.taskCount > 1 ? 's' : ''})</span>
          </div>
        </div>
        <div class="table-responsive">
          <table class="styled-tasks-table daily-table">
            <thead>
              <tr>
                <th style="width: 85px;">ID</th>
                <th style="width: 300px;">Tarea</th>
                <th style="width: 200px;">Equipo</th>
                <th style="width: 130px;">Sprint</th>
                <th style="width: 90px; text-align: right;">Horas</th>
              </tr>
            </thead>
            <tbody>
              ${tasksHtml}
            </tbody>
          </table>
        </div>
      `;

      dailyLogTree.appendChild(card);
    });
  }

  // Real-time Search Filtering
  function filterTasksRealtime(searchTerm) {
    timeHistoryCurrentFilterText = (searchTerm || '').trim().toLowerCase();
    const rows = document.querySelectorAll('.task-row');

    if (btnClearSearch) {
      if (timeHistoryCurrentFilterText) {
        btnClearSearch.classList.remove('hidden');
      } else {
        btnClearSearch.classList.add('hidden');
      }
    }

    rows.forEach(row => {
      const text = row.getAttribute('data-search') || '';
      if (!timeHistoryCurrentFilterText || text.includes(timeHistoryCurrentFilterText)) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
  }

  // Export to CSV
  function exportTimeDataToCsv() {
    if (!timeHistoryCurrentData || !timeHistoryCurrentData.tasks || timeHistoryCurrentData.tasks.length === 0) {
      alert('No hay datos de tareas para exportar.');
      return;
    }

    const headers = ['ID', 'Titulo', 'Equipo', 'Sprint', 'CompletedWork_Horas', 'FechaTrabajo', 'Actividad', 'Estado', 'Url'];
    const rows = timeHistoryCurrentData.tasks.map(t => [
      t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.teamName || '').replace(/"/g, '""')}"`,
      `"${(t.sprintName || '').replace(/"/g, '""')}"`,
      t.hours || 0,
      `"${t.dateFormatted || t.rawDate || ''}"`,
      `"${(t.activity || 'General').replace(/"/g, '""')}"`,
      `"${t.state || 'Done'}"`,
      `"${t.url || ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const nowStr = toYmd(new Date());
    link.download = `reporte-tiempos-teams-${nowStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Copy Summary to Clipboard
  function copyTimeSummaryToClipboard() {
    if (!timeHistoryCurrentData || !timeHistoryCurrentData.tasks || timeHistoryCurrentData.tasks.length === 0) {
      alert('No hay datos para copiar.');
      return;
    }

    const d = timeHistoryCurrentData;
    const start = timeFilterStartDate?.value || '';
    const end = timeFilterEndDate?.value || '';

    let text = `========================================\n`;
    text += `REPORTE DE HORAS TASKEADAS (DONE)\n`;
    text += `========================================\n`;
    text += `Usuario: ${d.user || 'Asignado'}\n`;
    text += `Período: ${start} al ${end}\n`;
    text += `Total General: ${d.totalHours} hrs (${d.totalTasks} tareas)\n\n`;

    text += `DESGLOSE POR EQUIPO Y SPRINT:\n`;
    (d.teams || []).forEach(team => {
      text += `\n[Equipo] ${team.name}: ${team.totalHours} hrs (${team.percentage}%)\n`;
      const sprints = team.sprintsList || Object.values(team.sprints || {});
      sprints.forEach(sprint => {
        text += `   • ${sprint.name}: ${sprint.totalHours} hrs (${(sprint.tasks || []).length} tareas)\n`;
        (sprint.tasks || []).forEach(task => {
          text += `     - #${task.id} [${task.hours}h] ${task.title} (${task.dateFormatted || ''})\n`;
        });
      });
    });

    navigator.clipboard.writeText(text).then(() => {
      renderFloatingToast({
        id: `copy-${Date.now()}`,
        category: 'HU_DONE',
        title: '¡Reporte Copiado!',
        message: `Se copió el resumen de ${d.totalHours} hrs taskeadas al portapapeles.`
      });
    }).catch(err => {
      console.warn('Error al copiar:', err);
    });
  }

  // Main Initializer for the Tab
  function initTimeHistoryTab() {
    if (timeHistoryInitialized) return;
    timeHistoryInitialized = true;

    // 1. Initial Defaults
    applyDatePreset('thisWeek');
    loadTeamsDropdown();

    // 2. Event Listeners for Filters
    if (btnReloadTeams) {
      btnReloadTeams.addEventListener('click', () => loadTeamsDropdown(true));
    }

    if (timeFilterTeam) {
      timeFilterTeam.addEventListener('change', () => {
        loadSprintsForTeam(timeFilterTeam.value);
      });
    }

    if (timeFilterSprint) {
      timeFilterSprint.addEventListener('change', onSprintSelectionChanged);
    }

    if (btnApplySprintDates) {
      btnApplySprintDates.addEventListener('click', () => {
        if (!timeFilterSprint) return;
        const opt = timeFilterSprint.options[timeFilterSprint.selectedIndex];
        if (opt) {
          const s = parseAnyDate(opt.getAttribute('data-start'));
          const e = parseAnyDate(opt.getAttribute('data-end'));
          if (s && timeFilterStartDate) timeFilterStartDate.value = toYmd(s);
          if (e && timeFilterEndDate) timeFilterEndDate.value = toYmd(e);
          queryTimeHistory();
        }
      });
    }

    // 3. Preset chips
    timePresetChips.forEach(chip => {
      chip.addEventListener('click', () => {
        timePresetChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        applyDatePreset(chip.getAttribute('data-range'));
        queryTimeHistory();
      });
    });

    // 4. Query button
    if (btnQueryTimeHistory) {
      btnQueryTimeHistory.addEventListener('click', () => queryTimeHistory());
    }

    // 5. View Switcher Tabs
    viewTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        viewTabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const viewMode = btn.getAttribute('data-view');

        if (viewTeamSprintsContainer) viewTeamSprintsContainer.classList.toggle('active', viewMode === 'teamSprints');
        if (viewAllTasksContainer) viewAllTasksContainer.classList.toggle('active', viewMode === 'allTasks');
        if (viewDailyLogContainer) viewDailyLogContainer.classList.toggle('active', viewMode === 'dailyLog');
      });
    });

    // 6. Search Bar
    if (timeTasksSearch) {
      timeTasksSearch.addEventListener('input', (e) => {
        filterTasksRealtime(e.target.value);
      });
    }

    if (btnClearSearch) {
      btnClearSearch.addEventListener('click', () => {
        if (timeTasksSearch) timeTasksSearch.value = '';
        filterTasksRealtime('');
      });
    }

    // 7. Export & Copy
    if (btnExportTimeCsv) {
      btnExportTimeCsv.addEventListener('click', exportTimeDataToCsv);
    }

    if (btnCopyTimeSummary) {
      btnCopyTimeSummary.addEventListener('click', copyTimeSummaryToClipboard);
    }

    // 8. Auto-run initial query
    queryTimeHistory();
  }
});
