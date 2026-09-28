/**
 * Azure DevOps Notifier - Popup Script with Delete Options
 */

document.addEventListener('DOMContentLoaded', async () => {
  const popupStatusBanner = document.getElementById('popupStatusBanner');
  const popupStatusText = document.getElementById('popupStatusText');
  const statHu = document.getElementById('statHu');
  const statNew = document.getElementById('statNew');
  const statQa = document.getElementById('statQa');
  const statDone = document.getElementById('statDone');
  const statPurple = document.getElementById('statPurple');
  const popupAlertsList = document.getElementById('popupAlertsList');
  const popupEmptyState = document.getElementById('popupEmptyState');
  const lastSyncText = document.getElementById('lastSyncText');
  const topSyncText = document.getElementById('topSyncText');
  const statTodayHours = document.getElementById('statTodayHours');
  const todayHoursBadge = document.getElementById('todayHoursBadge');
  const footerHoursText = document.getElementById('footerHoursText');

  const btnQuickSync = document.getElementById('btnQuickSync');
  const btnOpenOptions = document.getElementById('btnOpenOptions');
  const btnGoToDashboard = document.getElementById('btnGoToDashboard');
  const btnPopupClearAll = document.getElementById('btnPopupClearAll');
  const btnPopupMarkAllRead = document.getElementById('btnPopupMarkAllRead');

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

  // Load Data
  await refreshPopupData();

  // Real-time automatic updates when background sync completes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.lastSync || changes.history || changes.settings || changes.todayCompletedHours || changes.todayTasksSummary)) {
      refreshPopupData();
    }
  });

  // Button Action Handlers
  btnQuickSync.addEventListener('click', async () => {
    btnQuickSync.style.transform = 'rotate(180deg)';
    btnQuickSync.style.transition = 'transform 0.5s ease';

    chrome.runtime.sendMessage({ action: 'TRIGGER_MANUAL_SYNC' }, async () => {
      btnQuickSync.style.transform = 'rotate(0deg)';
      await refreshPopupData();
    });
  });

  const openOptions = () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  };

  btnOpenOptions.addEventListener('click', openOptions);
  btnGoToDashboard.addEventListener('click', openOptions);

  // Mark all notifications as read
  if (btnPopupMarkAllRead) {
    btnPopupMarkAllRead.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'MARK_ALL_AS_READ' }, async () => {
        await refreshPopupData();
      });
    });
  }

  // Clear All Notifications from Popup
  btnPopupClearAll.addEventListener('click', () => {
    if (confirm('¿Deseas eliminar todas las alertas recientes?')) {
      chrome.runtime.sendMessage({ action: 'CLEAR_HISTORY' }, async () => {
        await refreshPopupData();
      });
    }
  });

  // Data Refresh Helper
  async function refreshPopupData() {
    const {
      settings,
      history = [],
      lastSync,
      todayCompletedHours = 0,
      todayTasksSummary
    } = await chrome.storage.local.get([
      'settings',
      'history',
      'lastSync',
      'todayCompletedHours',
      'todayTasksSummary'
    ]);

    // Connection Status
    if (settings && settings.org && settings.project && settings.pat) {
      popupStatusBanner.className = 'status-banner connected';
      popupStatusText.textContent = `Conectado: ${settings.project}`;
    } else {
      popupStatusBanner.className = 'status-banner disconnected';
      popupStatusText.textContent = 'Sin Configurar (Clic en ⚙️)';
    }

    // Sync Text (Top Bar & Footer)
    let syncStr = 'Sync: Nunca';
    if (lastSync) {
      const d = new Date(lastSync);
      syncStr = `Sync: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    if (topSyncText) topSyncText.textContent = syncStr;
    if (lastSyncText) lastSyncText.textContent = syncStr;

    // Today's Work Hours (Completed Work acumulado hoy estrictamente)
    const now = new Date();
    const currentTodayKey = getTodayKey(now);

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

    const formattedHours = (hoursToday % 1 === 0) ? `${hoursToday}h` : `${hoursToday.toFixed(1)}h`;

    if (statTodayHours) {
      statTodayHours.textContent = formattedHours;
    }
    if (footerHoursText) {
      footerHoursText.textContent = `${formattedHours} hoy`;
    }

    if (todayHoursBadge) {
      if (taskList.length > 0) {
        const lines = taskList.map(t => `• #${t.id} [${t.hours}h] (${t.state || 'Task'}) ${t.title}`);
        todayHoursBadge.title = `Total: ${formattedHours} acumuladas hoy (${taskList.length} tarea${taskList.length > 1 ? 's' : ''}):\n` + lines.join('\n');
      } else if (hoursToday > 0) {
        todayHoursBadge.title = `Total: ${formattedHours} acumuladas hoy en tus tareas.`;
      }
      todayHoursBadge.style.cursor = 'pointer';
      todayHoursBadge.onclick = () => {
        const url = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
          ? chrome.runtime.getURL('options/options.html#time-history')
          : '../options/options.html#time-history';
        if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
          chrome.tabs.create({ url });
        } else {
          window.open(url, '_blank');
        }
      };
    }

    // Stats Computation
    let huCount = 0;
    let newCount = 0;
    let qaCount = 0;
    let doneCount = 0;
    let purpleCount = 0;

    history.forEach(item => {
      if (item.category && item.category.startsWith('HU')) huCount++;
      if (item.category === 'BUG_NEW' || item.category === 'HU_NEW') newCount++;
      if (item.category === 'BUG_QA' || item.category === 'HU_QA') qaCount++;
      if (item.category === 'BUG_DONE' || item.category === 'HU_DONE') doneCount++;
      if (item.category === 'BUG_REOPEN' || item.category === 'HU_REVIEW_PO') purpleCount++;
    });

    if (statHu) statHu.textContent = huCount;
    if (statNew) statNew.textContent = newCount;
    if (statQa) statQa.textContent = qaCount;
    if (statDone) statDone.textContent = doneCount;
    if (statPurple) statPurple.textContent = purpleCount;

    // Render Recent List (Top 10)
    popupAlertsList.innerHTML = '';
    const recent = history.slice(0, 10);

    if (recent.length === 0) {
      popupEmptyState.style.display = 'block';
      popupAlertsList.style.display = 'none';
      if (btnPopupMarkAllRead) btnPopupMarkAllRead.style.display = 'none';
      if (btnPopupClearAll) btnPopupClearAll.style.display = 'none';
      return;
    }

    if (btnPopupMarkAllRead) btnPopupMarkAllRead.style.display = 'inline';
    if (btnPopupClearAll) btnPopupClearAll.style.display = 'inline';
    popupEmptyState.style.display = 'none';
    popupAlertsList.style.display = 'flex';

    recent.forEach(item => {
      const li = document.createElement('li');
      const isRead = item.read === true;
      li.className = `popup-alert-item ${isRead ? 'read' : 'unread'}`;

      const timeAgo = formatTimeAgo(item.timestamp);

      li.innerHTML = `
        <div class="item-top">
          <div class="item-top-left">
            ${!isRead ? '<span class="unread-dot" title="No leída"></span>' : '<span class="read-indicator" title="Leída">✓</span>'}
            <span class="badge-micro ${item.category}">${getPillLabel(item.category)}</span>
          </div>
          <div class="item-top-right">
            <span class="item-time">${timeAgo}</span>
            <button class="item-delete-btn" title="Eliminar esta alerta">&times;</button>
          </div>
        </div>
        <div class="item-title">${escapeHtml(item.title)}</div>
        <div class="item-msg">${escapeHtml(item.message)}</div>
      `;

      // Single Delete Click
      const btnDelete = li.querySelector('.item-delete-btn');
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation(); // Don't trigger redirect link
        chrome.runtime.sendMessage({ action: 'DELETE_HISTORY_ITEM', id: item.id }, async () => {
          await refreshPopupData();
        });
      });

      // Item Card Click to Mark as Read and Open ADO URL
      li.addEventListener('click', () => {
        // Mark as read immediately in background
        if (!isRead && item.id) {
          chrome.runtime.sendMessage({ action: 'MARK_AS_READ', id: item.id }, () => {
            refreshPopupData();
          });
        }
        if (item.url) {
          chrome.tabs.create({ url: item.url });
        }
      });

      popupAlertsList.appendChild(li);
    });
  }

  function formatTimeAgo(ts) {
    if (!ts) return '';
    const diffMs = Date.now() - new Date(ts).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h`;
    return `${Math.floor(diffHours / 24)}d`;
  }

  function getPillLabel(category) {
    const labels = {
      'HU': 'HU Actualizada',
      'HU_QA': 'HU en QA',
      'HU_REVIEW_PO': 'Review PO',
      'HU_DONE': 'HU Finalizada',
      'HU_IMPEDIMENT': 'Impedimento',
      'HU_STAGE': 'HU en Stage',
      'HU_COMMITTED': 'En Progreso',
      'HU_ASSIGNED': 'HU Asignada',
      'BUG_NEW': 'Nuevo Bug',
      'BUG_QA': 'Bug en QA',
      'BUG_DONE': 'Bug Cerrado',
      'BUG_REOPEN': 'Bug Reabierto'
    };
    return labels[category] || category;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
});
