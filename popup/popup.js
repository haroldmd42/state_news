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

  const btnQuickSync = document.getElementById('btnQuickSync');
  const btnOpenOptions = document.getElementById('btnOpenOptions');
  const btnGoToDashboard = document.getElementById('btnGoToDashboard');
  const btnPopupClearAll = document.getElementById('btnPopupClearAll');
  const btnPopupMarkAllRead = document.getElementById('btnPopupMarkAllRead');

  // Load Data
  await refreshPopupData();

  // Real-time automatic updates when background sync completes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.lastSync || changes.history || changes.settings)) {
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
    const { settings, history = [], lastSync } = await chrome.storage.local.get(['settings', 'history', 'lastSync']);

    // Connection Status
    if (settings && settings.org && settings.project && settings.pat) {
      popupStatusBanner.className = 'status-banner connected';
      popupStatusText.textContent = `Conectado: ${settings.project}`;
    } else {
      popupStatusBanner.className = 'status-banner disconnected';
      popupStatusText.textContent = 'Sin Configurar (Clic en ⚙️)';
    }

    // Last Sync Text
    if (lastSync) {
      const d = new Date(lastSync);
      lastSyncText.textContent = `Sync: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      lastSyncText.textContent = 'Sync: Nunca';
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
