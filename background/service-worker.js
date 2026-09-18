/**
 * Azure DevOps Real-Time Notifier - Background Service Worker
 * Manifest V3 compatible
 */

const DEFAULT_SETTINGS = {
  org: '',
  project: '',
  pat: '',
  assignedUser: '', // email or displayName
  filterHUByUser: false, // Si es false, notifica todas las HUs del proyecto; si es true, filtra por usuario asignado/responsable
  pollingInterval: 1, // in minutes
  enableDesktopNotifications: true,
  enableInPageToasts: true,
  enableSound: true,
  stateMappings: {
    huTypes: ['Product Backlog Item', 'PBI', 'User Story', 'Historia de Usuario', 'Feature', 'Epic'],
    bugTypes: ['Bug', 'Defect', 'Fallo', 'Error'],
    newBugStates: ['New', 'Nuevo', 'To Do', 'Por hacer', 'Created'],
    qaBugStates: ['Qa', 'QA', 'In QA', 'Testing', 'En QA', 'Ready for QA', 'En Pruebas'],
    reopenBugStates: ['Reopened', 'Reopen', 'Reabierto', 'Re-opened'],
    doneBugStates: ['Done', 'Closed', 'Resolved', 'Cerrado', 'Resuelto', 'Finalizado'],
    qaHuStates: ['Qa', 'QA', 'In QA', 'Testing', 'En QA', 'Ready for QA', 'En Pruebas'],
    reviewPoHuStates: [
      'Review PO',
      'Review Po',
      'PO Review',
      'PO',
      'En Revisión PO',
      'En Revision PO',
      'Revision PO',
      'Revisión PO',
      'Aprobación PO',
      'Aprobacion PO',
      'Validación PO',
      'Validacion PO',
      'Aceptación PO',
      'Aceptacion PO',
      'Product Owner',
      'In Review PO',
      'PO Review Pending',
      'Demo PO',
      'Review'
    ],
    doneHuStates: ['Done', 'Closed', 'Resolved', 'Cerrado', 'Resuelto', 'Finalizado'],
    impedimentHuStates: ['Impediment', 'Blocked', 'Impedimento', 'Bloqueado', 'Bloqueada'],
    stageHuStates: ['In Stage', 'Stage', 'En Stage', 'Staging'],
    committedHuStates: ['Committed', 'In Progress', 'En Progreso', 'En Desarrollo', 'Approved']
  }
};

// URL mapping store for notification clicks
const notificationUrlMap = new Map();

// Helper to remove accents/diacritics and convert to lowercase for robust matching
function removeAccents(str) {
  return (str || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

// Token-based fuzzy matcher supporting inverted names (e.g. "Perez Gomez, Juan Carlos" vs "Juan Carlos Perez")
function isTextMatch(text, filter) {
  if (!text || !filter) return false;
  const t = removeAccents(text);
  const f = removeAccents(filter);
  if (!t || !f) return false;

  // 1. Exact or substring match
  if (t === f || t.includes(f) || f.includes(t)) return true;

  // 2. Email match (e.g. juan.perez in juan.perez@empresa.com)
  if (f.includes('@') || t.includes('@')) {
    const fUser = f.split('@')[0].replace(/[^a-z0-9]/g, '');
    const tUser = t.split('@')[0].replace(/[^a-z0-9]/g, '');
    if (fUser && tUser && (fUser.includes(tUser) || tUser.includes(fUser))) return true;
  }

  // 3. Token-based word matching (supports inverted active directory names)
  const filterTokens = f.split(/[^a-z0-9]+/).filter(tok => tok.length >= 2);
  const textTokens = t.split(/[^a-z0-9]+/).filter(tok => tok.length >= 2);

  if (filterTokens.length === 0 || textTokens.length === 0) return false;

  let matchCount = 0;
  for (const ft of filterTokens) {
    if (textTokens.some(tt => tt === ft || (tt.length > 3 && ft.includes(tt)) || (ft.length > 3 && tt.includes(ft)))) {
      matchCount++;
    }
  }

  // Require at least 2 matching words, or 1 if the filter only consists of 1 word
  const requiredMatches = Math.min(2, filterTokens.length);
  return matchCount >= requiredMatches;
}

// Helper to clean identity values while preserving ADO identity strings like "Name <email@domain.com>"
function extractCleanIdentity(val) {
  if (!val) return '';
  if (typeof val === 'object') {
    return (val.displayName || val.name || val.distinctDisplayName || val.uniqueName || val.mailAddress || val.value || '').trim();
  }
  const s = String(val).trim();
  // Filter out actual HTML markup elements if any, but preserve identity strings
  if (/<(p|div|br|span|html|body|table|tr|td|ul|li|h[1-6]|font|a\s)[^>]*>/i.test(s)) {
    return '';
  }
  return s;
}

// Extract human-readable roles from Azure DevOps work item fields (strictly ignores audit/system fields)
function extractWorkItemRoles(fields) {
  let assignedTo = null;
  let responsibleQA = null;
  let responsibleBackend = null;
  let responsibleMaquetacion = null;
  let responsibleIntegrador = null;
  const otherRoles = {};

  for (const [key, val] of Object.entries(fields || {})) {
    if (!val) continue;
    const k = key.toLowerCase();

    // STRICTLY IGNORE audit, author, changelog and text/metadata fields
    if (
      k.includes('createdby') ||
      k.includes('changedby') ||
      k.includes('authorizedas') ||
      k.includes('watermark') ||
      k.includes('description') ||
      k.includes('history') ||
      k.includes('title') ||
      k.includes('comment') ||
      k.includes('iteration') ||
      k.includes('area') ||
      k.includes('reason') ||
      k.includes('rev') ||
      k.includes('nodename') ||
      k.includes('state') ||
      k.includes('tags') ||
      k.includes('criteria')
    ) {
      continue;
    }

    const strVal = extractCleanIdentity(val);
    if (!strVal || strVal.length > 150) continue;

    if (k.includes('assignedto')) {
      assignedTo = strVal;
    } else if (k.includes('qa') || k.includes('tester') || k.includes('calidad') || k.includes('pruebas')) {
      responsibleQA = strVal;
    } else if (k.includes('backend') || k.includes('back-end') || k.includes('desarrollador') || k.includes('developer')) {
      responsibleBackend = strVal;
    } else if (k.includes('maquetacion') || k.includes('maquetador') || k.includes('frontend') || k.includes('layout')) {
      responsibleMaquetacion = strVal;
    } else if (k.includes('integrador') || k.includes('integration')) {
      responsibleIntegrador = strVal;
    } else if (k.includes('responsable') || k.includes('owner') || k.includes('lider') || k.includes('lead') || k.includes('po') || key.startsWith('Custom.') || typeof val === 'object') {
      const cleanKey = key.replace(/^(Custom\.|Microsoft\.VSTS\.[^.]+\.|System\.)/i, '');
      otherRoles[cleanKey] = strVal;
    }
  }

  return { assignedTo, responsibleQA, responsibleBackend, responsibleMaquetacion, responsibleIntegrador, otherRoles };
}

// Automatically inject content scripts and CSS into existing open tabs
async function autoInjectOpenTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    for (const tab of tabs) {
      if (tab.id) {
        chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content/toast.css']
        }).catch(() => {});

        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content-script.js']
        }).catch(() => {});
      }
    }
    console.log(`[ADO Notifier] Content scripts auto-inyectados en ${tabs.length} pestañas abiertas.`);
  } catch (e) {
    console.warn('[ADO Notifier] No se pudieron auto-inyectar scripts en pestañas:', e);
  }
}

// Initialize service worker listeners
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[ADO Notifier] Service Worker instalado');
  const stored = await chrome.storage.local.get(['settings', 'history']);
  if (!stored.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS, workItemsCache: {}, notifiedStates: {}, history: [] });
  } else {
    // Migrate existing settings to include any new state mappings and filter preference
    const currentMappings = stored.settings.stateMappings || {};
    const updatedSettings = {
      ...DEFAULT_SETTINGS,
      ...stored.settings,
      filterHUByUser: stored.settings.filterHUByUser !== undefined ? stored.settings.filterHUByUser : DEFAULT_SETTINGS.filterHUByUser,
      stateMappings: {
        ...DEFAULT_SETTINGS.stateMappings,
        ...currentMappings,
        doneBugStates: currentMappings.doneBugStates || DEFAULT_SETTINGS.stateMappings.doneBugStates,
        qaHuStates: currentMappings.qaHuStates || DEFAULT_SETTINGS.stateMappings.qaHuStates,
        reviewPoHuStates: currentMappings.reviewPoHuStates || DEFAULT_SETTINGS.stateMappings.reviewPoHuStates,
        doneHuStates: currentMappings.doneHuStates || DEFAULT_SETTINGS.stateMappings.doneHuStates,
        impedimentHuStates: currentMappings.impedimentHuStates || DEFAULT_SETTINGS.stateMappings.impedimentHuStates,
        stageHuStates: currentMappings.stageHuStates || DEFAULT_SETTINGS.stateMappings.stageHuStates,
        committedHuStates: currentMappings.committedHuStates || DEFAULT_SETTINGS.stateMappings.committedHuStates
      }
    };
    await chrome.storage.local.set({ settings: updatedSettings });
  }
  await updateBadge(stored.history || []);
  setupAlarm();
  autoInjectOpenTabs();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[ADO Notifier] Service Worker iniciado');
  setupAlarm();
  const { history = [] } = await chrome.storage.local.get('history');
  await updateBadge(history);
  checkForUpdates();
  autoInjectOpenTabs();
});

// Alarm management for periodic background polling
async function setupAlarm() {
  try {
    const { settings } = await chrome.storage.local.get('settings');
    const interval = (settings && settings.pollingInterval) ? Math.max(1, parseInt(settings.pollingInterval, 10)) : 1;
    
    const existing = await chrome.alarms.get('ado_check_alarm');
    if (!existing || existing.periodInMinutes !== interval) {
      await chrome.alarms.clear('ado_check_alarm');
      chrome.alarms.create('ado_check_alarm', {
        delayInMinutes: interval,
        periodInMinutes: interval
      });
      console.log(`[ADO Notifier] Alarma periódica configurada cada ${interval} minuto(s)`);
    } else {
      console.log(`[ADO Notifier] Alarma ya activa cada ${existing.periodInMinutes} minuto(s)`);
    }
  } catch (e) {
    console.warn('[ADO Notifier] Error configurando alarma:', e);
  }
}

// Ensure alarm is active when service worker wakes up
setupAlarm();

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'ado_check_alarm') {
    console.log('[ADO Notifier] Alarma disparada automáticamente:', new Date().toLocaleTimeString());
    checkForUpdates();
  }
});

// Listen to storage changes to update alarm
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.settings) {
    const oldInterval = changes.settings.oldValue?.pollingInterval;
    const newInterval = changes.settings.newValue?.pollingInterval;
    if (oldInterval !== newInterval) {
      setupAlarm();
    }
  }
});

/**
 * Strict verification that user filter matches actual assigned roles
 * (AssignedTo, Responsable QA, Backend, Maquetador, Integrador or custom role).
 * Never matches CreatedBy or ChangedBy.
 */
function checkUserAssociation(roles, userFilter, fields) {
  if (!userFilter) return true;
  if (!roles && !fields) return false;

  if (roles) {
    if (roles.assignedTo && isUserMatch(roles.assignedTo, userFilter)) return true;
    if (roles.responsibleQA && isUserMatch(roles.responsibleQA, userFilter)) return true;
    if (roles.responsibleBackend && isUserMatch(roles.responsibleBackend, userFilter)) return true;
    if (roles.responsibleMaquetacion && isUserMatch(roles.responsibleMaquetacion, userFilter)) return true;
    if (roles.responsibleIntegrador && isUserMatch(roles.responsibleIntegrador, userFilter)) return true;

    if (roles.otherRoles) {
      for (const [roleName, roleVal] of Object.entries(roles.otherRoles)) {
        if (roleVal && isUserMatch(roleVal, userFilter)) return true;
      }
    }
  }

  // Fallback: search person/identity fields in fields
  if (fields) {
    for (const [key, val] of Object.entries(fields)) {
      if (!val) continue;
      const k = key.toLowerCase();
      if (
        k.includes('createdby') ||
        k.includes('changedby') ||
        k.includes('authorizedas') ||
        k.includes('watermark') ||
        k.includes('description') ||
        k.includes('history') ||
        k.includes('title') ||
        k.includes('comment') ||
        k.includes('iteration') ||
        k.includes('area') ||
        k.includes('reason') ||
        k.includes('rev') ||
        k.includes('state') ||
        k.includes('tags')
      ) {
        continue;
      }
      if (isUserMatch(val, userFilter)) return true;
    }
  }

  return false;
}

// Helper to identify if a work item is an HU / User Story / PBI (Strictly excludes Tasks)
function isWorkItemHU(type, title, mappings) {
  if (!type) return false;
  const t = type.toLowerCase().trim();

  // Explicitly exclude Tasks and other work item types
  if (t === 'task' || t === 'tarea' || t === 'test case' || t === 'test suite' || t === 'code review' || t === 'impediment' || t === 'issue') {
    return false;
  }

  const huList = (mappings?.huTypes || DEFAULT_SETTINGS.stateMappings.huTypes).map(h => h.toLowerCase().trim());
  if (huList.some(h => h === t || t.includes(h) || h.includes(t))) return true;
  if (t === 'product backlog item' || t === 'user story' || t === 'pbi' || t === 'historia de usuario' || t === 'feature' || t === 'epic' || t === 'requirement') return true;
  if (/^hu[\s\-_:]/i.test(title || '') || /^pbi[\s\-_:]/i.test(title || '')) return true;
  return false;
}

// Helper to identify if a work item is a Bug (Strictly excludes Tasks)
function isWorkItemBug(type, title, mappings) {
  if (!type) return false;
  const t = type.toLowerCase().trim();

  // Explicitly exclude Tasks
  if (t === 'task' || t === 'tarea') return false;

  const bugList = (mappings?.bugTypes || DEFAULT_SETTINGS.stateMappings.bugTypes).map(b => b.toLowerCase().trim());
  if (bugList.some(b => b === t || t.includes(b) || b.includes(t))) return true;
  if (t === 'bug' || t === 'defect' || t === 'fallo' || t === 'error') return true;
  if (/^bug[\s\-_:]/i.test(title || '')) return true;
  return false;
}

// Helper to check if a value matches user filter with accents ignored and token matching
function isUserMatch(val, userFilter) {
  if (!val || !userFilter) return false;

  if (typeof val === 'object') {
    const name = val.displayName || val.distinctDisplayName || val.name || '';
    const email = val.uniqueName || val.mail || val.mailAddress || val.email || '';
    return isTextMatch(name, userFilter) || isTextMatch(email, userFilter);
  }

  return isTextMatch(String(val), userFilter);
}

// Main Update Checker & Concurrency Lock
let isCheckingUpdates = false;

// Helper to determine if a work item has already been notified for a specific state
function hasAlreadyBeenNotifiedForState(id, cleanTargetState, cachedItem, notifiedStatesMap, currentHistory) {
  if (!cleanTargetState) return false;
  const target = removeAccents(String(cleanTargetState)).trim();
  const strId = String(id);

  // 1. Check persistent notifiedStates map
  if (notifiedStatesMap) {
    const mapped = notifiedStatesMap[id] || notifiedStatesMap[strId];
    if (mapped && removeAccents(String(mapped)).trim() === target) {
      return true;
    }
  }

  // 2. Check cached work item's lastNotifiedState
  if (cachedItem && cachedItem.lastNotifiedState) {
    if (removeAccents(String(cachedItem.lastNotifiedState)).trim() === target) {
      return true;
    }
  }

  // 3. Check history list in storage
  if (Array.isArray(currentHistory)) {
    const inHistory = currentHistory.some(h =>
      (String(h.workItemId) === strId) &&
      removeAccents(String(h.state || '')).trim() === target
    );
    if (inHistory) return true;
  }

  return false;
}

// Main Update Checker
async function checkForUpdates() {
  if (isCheckingUpdates) {
    console.log('[ADO Notifier] Ya hay una verificación en curso. Omitiendo ejecución concurrente.');
    return { success: true, message: 'Verificación en progreso', updatedCount: 0 };
  }
  isCheckingUpdates = true;

  console.log('[ADO Notifier] Ejecutando verificación de actualizaciones...');
  const {
    settings: rawSettings = {},
    workItemsCache = {},
    notifiedStates = {},
    history = [],
    isInitialized
  } = await chrome.storage.local.get([
    'settings',
    'workItemsCache',
    'notifiedStates',
    'history',
    'isInitialized'
  ]);

  const settings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings,
    filterHUByUser: rawSettings.filterHUByUser === true,
    stateMappings: {
      ...DEFAULT_SETTINGS.stateMappings,
      ...(rawSettings.stateMappings || {})
    }
  };

  if (!settings.org || !settings.project || !settings.pat) {
    console.log('[ADO Notifier] Credenciales incompletas en la configuración.');
    isCheckingUpdates = false;
    return { success: false, message: 'Por favor completa Organización, Proyecto y Personal Access Token (PAT) en la pestaña Credenciales.' };
  }

  try {
    const authHeader = 'Basic ' + btoa(':' + settings.pat.trim());
    const org = encodeURIComponent(settings.org.trim());
    const project = encodeURIComponent(settings.project.trim());

    // 1. WIQL Query
    const wiqlUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/wiql?api-version=7.0`;
    const wiqlQuery = {
      query: `SELECT [System.Id], [System.Title], [System.WorkItemType], [System.State], [System.AssignedTo], [System.ChangedDate] FROM WorkItems WHERE [System.TeamProject] = @project AND [System.ChangedDate] >= @today - 14 ORDER BY [System.ChangedDate] DESC`
    };

    const wiqlResponse = await fetch(wiqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(wiqlQuery)
    });

    if (!wiqlResponse.ok) {
      let errDetail = wiqlResponse.statusText;
      try {
        const errJson = await wiqlResponse.json();
        errDetail = errJson.message || JSON.stringify(errJson);
      } catch (e) {
        errDetail = await wiqlResponse.text();
      }
      console.error('[ADO Notifier] Error HTTP en WIQL:', wiqlResponse.status, errDetail);
      return { success: false, message: `Error HTTP ${wiqlResponse.status}: ${errDetail}` };
    }

    const wiqlData = await wiqlResponse.json();
    const workItemIds = (wiqlData.workItems || []).slice(0, 200).map(item => item.id);

    if (workItemIds.length === 0) {
      console.log('[ADO Notifier] Sin elementos de trabajo modificados recientemente.');
      await chrome.storage.local.set({ lastSync: new Date().toISOString(), isInitialized: true });
      return { success: true, updatedCount: 0 };
    }

    // 2. Fetch Work Item Details
    const detailsUrl = `https://dev.azure.com/${org}/${project}/_apis/wit/workitems?ids=${workItemIds.join(',')}&$expand=All&api-version=7.0`;
    const detailsResponse = await fetch(detailsUrl, {
      headers: { 'Authorization': authHeader }
    });

    if (!detailsResponse.ok) {
      let errDetail = detailsResponse.statusText;
      try {
        const errJson = await detailsResponse.json();
        errDetail = errJson.message || JSON.stringify(errJson);
      } catch (e) {
        errDetail = await detailsResponse.text();
      }
      console.error('[ADO Notifier] Error obteniendo detalles:', detailsResponse.status, errDetail);
      return { success: false, message: `Error obteniendo detalles (${detailsResponse.status}): ${errDetail}` };
    }

    const detailsData = await detailsResponse.json();
    const items = detailsData.value || [];

    const newCache = { ...workItemsCache };
    const newNotifiedStates = { ...notifiedStates };
    const notificationsToTrigger = [];
    const updatedHistory = [...history];

    const assignedUserFilter = (settings.assignedUser || '').trim();
    const filterHUByUser = settings.filterHUByUser === true;
    const mappings = settings.stateMappings;
    const doneStates = mappings.doneBugStates || DEFAULT_SETTINGS.stateMappings.doneBugStates;
    const qaHuStates = mappings.qaHuStates || DEFAULT_SETTINGS.stateMappings.qaHuStates;
    const reviewPoHuStates = mappings.reviewPoHuStates || DEFAULT_SETTINGS.stateMappings.reviewPoHuStates;
    const doneHuStates = mappings.doneHuStates || DEFAULT_SETTINGS.stateMappings.doneHuStates;
    const impedimentHuStates = mappings.impedimentHuStates || DEFAULT_SETTINGS.stateMappings.impedimentHuStates;
    const stageHuStates = mappings.stageHuStates || DEFAULT_SETTINGS.stateMappings.stageHuStates;
    const committedHuStates = mappings.committedHuStates || DEFAULT_SETTINGS.stateMappings.committedHuStates;
    const isFirstBaseline = !isInitialized || Object.keys(workItemsCache).length === 0;

    for (const item of items) {
      const id = item.id;
      const title = item.fields['System.Title'] || 'Sin Título';
      const type = item.fields['System.WorkItemType'] || '';
      const state = item.fields['System.State'] || '';
      const changedDate = item.fields['System.ChangedDate'] || '';

      const currentRoles = extractWorkItemRoles(item.fields);
      const itemUrl = `https://dev.azure.com/${settings.org.trim()}/${settings.project.trim()}/_workitems/edit/${id}`;
      const cached = workItemsCache[id];

      let notificationReason = null;
      let notificationCategory = null;
      let notificationTitle = null;

      const isBug = isWorkItemBug(type, title, mappings);
      const isHU = isWorkItemHU(type, title, mappings);

      // 1. Strict Type Filter: ONLY Product Backlog Items (HUs) and Bugs.
      // Ignore Tasks, Tareas, Test Cases, Impediments, etc.
      if (!isBug && !isHU) {
        newCache[id] = {
          id,
          title,
          type,
          state,
          changedDate,
          roles: currentRoles,
          assignedTo: currentRoles.assignedTo,
          responsibleQA: currentRoles.responsibleQA,
          responsibleBackend: currentRoles.responsibleBackend,
          responsibleMaquetacion: currentRoles.responsibleMaquetacion,
          responsibleIntegrador: currentRoles.responsibleIntegrador,
          otherRoles: currentRoles.otherRoles,
          url: itemUrl,
          lastSeen: new Date().toISOString()
        };
        continue;
      }

      // 2. User Association Filter:
      // - Bugs: always require user association (if assignedUserFilter is set)
      // - HUs: only require user association when filterHUByUser = true
      const isUserAssociated = !assignedUserFilter || checkUserAssociation(currentRoles, assignedUserFilter, item.fields);
      // For HUs: if filterHUByUser=false, notify regardless of user association
      const isHuShouldNotify = isHU && (!filterHUByUser || isUserAssociated);
      // For Bugs: always require user association
      const isBugShouldNotify = isBug && isUserAssociated;

      const cleanState = removeAccents(state).trim();

      // Precise State Mapping for BUGS
      const isDoneState = doneStates.some(s => removeAccents(s) === cleanState) ||
        cleanState.includes('done') ||
        cleanState.includes('cerrad') ||
        cleanState.includes('resuelt') ||
        cleanState.includes('resolved') ||
        cleanState.includes('closed') ||
        cleanState.includes('fixed') ||
        cleanState.includes('finaliz');

      const isReopenState = mappings.reopenBugStates.some(s => removeAccents(s) === cleanState) ||
        cleanState.includes('reopen') ||
        cleanState.includes('reabiert');

      const isQaState = !isDoneState && !isReopenState && (
        mappings.qaBugStates.some(s => removeAccents(s) === cleanState) ||
        cleanState.includes('qa') ||
        cleanState.includes('test') ||
        cleanState.includes('prueba')
      );

      const isNewState = !isDoneState && !isReopenState && !isQaState && (
        mappings.newBugStates.some(s => removeAccents(s) === cleanState) ||
        cleanState.includes('new') ||
        cleanState.includes('nuevo') ||
        cleanState.includes('todo') ||
        cleanState.includes('to do') ||
        cleanState.includes('por hacer') ||
        cleanState.includes('created')
      );

      // HU States matching with robust Review PO detection
      const isHuReviewPoState = reviewPoHuStates.some(s => removeAccents(s) === cleanState) ||
        cleanState.includes('review po') ||
        cleanState.includes('po review') ||
        cleanState.includes('revision po') ||
        cleanState.includes('aprobacion po') ||
        cleanState.includes('validacion po') ||
        cleanState.includes('aceptacion po') ||
        cleanState.includes('product owner') ||
        (cleanState.includes('review') && cleanState.includes('po')) ||
        cleanState === 'review po' ||
        cleanState === 'po';

      const isHuQaState = !isHuReviewPoState && (qaHuStates.some(s => removeAccents(s) === cleanState) || isQaState || cleanState.includes('qa') || cleanState.includes('test') || cleanState.includes('prueba'));
      const isHuDoneState = doneHuStates.some(s => removeAccents(s) === cleanState) || isDoneState;
      const isHuImpedimentState = impedimentHuStates.some(s => removeAccents(s) === cleanState) || cleanState.includes('imped') || cleanState.includes('block') || cleanState.includes('bloque');
      const isHuStageState = stageHuStates.some(s => removeAccents(s) === cleanState) || cleanState.includes('stage');
      const isHuCommittedState = committedHuStates.some(s => removeAccents(s) === cleanState) || cleanState.includes('commit') || cleanState.includes('progress') || cleanState.includes('desarrollo') || cleanState.includes('approv');

      if (!isFirstBaseline) {
        const alreadyNotifiedForThisState = hasAlreadyBeenNotifiedForState(id, cleanState, cached, newNotifiedStates, updatedHistory);

        if (cached) {
          const stateChanged = removeAccents(cached.state).trim() !== cleanState;
          const prevRoles = cached.roles || {
            assignedTo: cached.assignedTo,
            responsibleQA: cached.responsibleQA,
            responsibleBackend: cached.responsibleBackend,
            responsibleMaquetacion: cached.responsibleMaquetacion,
            responsibleIntegrador: cached.responsibleIntegrador,
            otherRoles: cached.otherRoles || {}
          };

          // Check if item was newly assigned or reassigned to user
          let assignmentChangeReason = null;
          if (assignedUserFilter) {
            const prevQaIsUser = isUserMatch(prevRoles.responsibleQA, assignedUserFilter);
            const nowQaIsUser = isUserMatch(currentRoles.responsibleQA, assignedUserFilter);
            const prevAssignedIsUser = isUserMatch(prevRoles.assignedTo, assignedUserFilter);
            const nowAssignedIsUser = isUserMatch(currentRoles.assignedTo, assignedUserFilter);
            const prevBackendIsUser = isUserMatch(prevRoles.responsibleBackend, assignedUserFilter);
            const nowBackendIsUser = isUserMatch(currentRoles.responsibleBackend, assignedUserFilter);
            const prevMaqIsUser = isUserMatch(prevRoles.responsibleMaquetacion, assignedUserFilter);
            const nowMaqIsUser = isUserMatch(currentRoles.responsibleMaquetacion, assignedUserFilter);
            const prevIntegIsUser = isUserMatch(prevRoles.responsibleIntegrador, assignedUserFilter);
            const nowIntegIsUser = isUserMatch(currentRoles.responsibleIntegrador, assignedUserFilter);

            if (!prevQaIsUser && nowQaIsUser) {
              assignmentChangeReason = `¡Se te asignó como Responsable QA! (Anterior: "${prevRoles.responsibleQA || 'Sin QA'}")`;
            } else if (!prevAssignedIsUser && nowAssignedIsUser) {
              assignmentChangeReason = `¡Se te asignó este ${isBug ? 'Bug' : 'Product Backlog Item'}! (Asignado anterior: "${prevRoles.assignedTo || 'Sin asignar'}")`;
            } else if (!prevBackendIsUser && nowBackendIsUser) {
              assignmentChangeReason = `¡Se te asignó como Responsable Backend! (Anterior: "${prevRoles.responsibleBackend || 'Sin asignar'}")`;
            } else if (!prevMaqIsUser && nowMaqIsUser) {
              assignmentChangeReason = `¡Se te asignó como Responsable Maquetación! (Anterior: "${prevRoles.responsibleMaquetacion || 'Sin asignar'}")`;
            } else if (!prevIntegIsUser && nowIntegIsUser) {
              assignmentChangeReason = `¡Se te asignó como Responsable Integrador! (Anterior: "${prevRoles.responsibleIntegrador || 'Sin asignar'}")`;
            } else if (currentRoles.otherRoles) {
              for (const [roleName, roleVal] of Object.entries(currentRoles.otherRoles)) {
                const prevOther = prevRoles.otherRoles ? prevRoles.otherRoles[roleName] : null;
                if (!isUserMatch(prevOther, assignedUserFilter) && isUserMatch(roleVal, assignedUserFilter)) {
                  assignmentChangeReason = `¡Se te asignó en "${roleName}"! (Anterior: "${prevOther || 'Sin asignar'}")`;
                  break;
                }
              }
            }
          }

          // Case A: Assignment changed to user (Trigger HU_ASSIGNED / BUG Notification)
          if (assignmentChangeReason) {
            if (isBug) {
              if (isDoneState) {
                notificationCategory = 'BUG_DONE'; // Green
              } else if (isQaState) {
                notificationCategory = 'BUG_QA'; // Yellow
              } else if (isReopenState) {
                notificationCategory = 'BUG_REOPEN'; // Purple
              } else {
                notificationCategory = 'BUG_NEW'; // Blue
              }
              notificationTitle = `[BUG ASIGNADO A TI] ${title} (#${id})`;
            } else {
              if (isHuReviewPoState) notificationCategory = 'HU_REVIEW_PO';
              else if (isHuQaState) notificationCategory = 'HU_QA';
              else if (isHuDoneState) notificationCategory = 'HU_DONE';
              else if (isHuImpedimentState) notificationCategory = 'HU_IMPEDIMENT';
              else if (isHuStageState) notificationCategory = 'HU_STAGE';
              else notificationCategory = 'HU_ASSIGNED';
              notificationTitle = `[HU ASIGNADA A TI] ${title} (#${id})`;
            }

            let roleDetails = '';
            if (currentRoles.responsibleQA) roleDetails += ` • QA: ${currentRoles.responsibleQA}`;
            if (currentRoles.assignedTo) roleDetails += ` • Asignado: ${currentRoles.assignedTo}`;

            if (stateChanged) {
              notificationReason = `${assignmentChangeReason} • Cambio de estado: "${cached.state}" ➔ "${state}"${roleDetails}`;
            } else {
              notificationReason = `${assignmentChangeReason} • Estado actual: "${state}"${roleDetails}`;
            }
          }
          // Case B: State changed
          // - HUs: notify if filterHUByUser=false OR user is associated
          // - Bugs: always requires user association
          // Dedup guard: Only notify if not already notified for this exact state
          else if (stateChanged && (isHuShouldNotify || isBugShouldNotify)) {
            if (alreadyNotifiedForThisState) {
              console.log(`[ADO Notifier] Dedup (cached): Ya se notificó #${id} para estado "${state}". Omitiendo notificación.`);
            } else {
              // Rule 1: Product Backlog Item (HU) Transitions
              if (isHU && isHuShouldNotify) {
                let roleDetails = '';
                if (currentRoles.responsibleQA) roleDetails += ` • QA: ${currentRoles.responsibleQA}`;
                if (currentRoles.assignedTo) roleDetails += ` • Asignado: ${currentRoles.assignedTo}`;
                if (currentRoles.responsibleBackend) roleDetails += ` • Backend: ${currentRoles.responsibleBackend}`;
                if (currentRoles.responsibleMaquetacion) roleDetails += ` • Maq: ${currentRoles.responsibleMaquetacion}`;
                if (currentRoles.responsibleIntegrador) roleDetails += ` • Integ: ${currentRoles.responsibleIntegrador}`;

                if (isHuReviewPoState) {
                  notificationCategory = 'HU_REVIEW_PO'; // Purple
                  notificationTitle = `[HU EN REVIEW PO] ${title} (#${id})`;
                  notificationReason = `HU pasó a Review PO (Estado: "${state}") • Cambio: "${cached.state}" ➔ "${state}"${roleDetails}`;
                } else if (isHuQaState) {
                  notificationCategory = 'HU_QA'; // Yellow
                  notificationTitle = `[HU EN QA] ${title} (#${id})`;
                  notificationReason = `HU pasó a QA (Estado: "${state}") • Cambio: "${cached.state}" ➔ "${state}"${roleDetails}`;
                } else if (isHuDoneState) {
                  notificationCategory = 'HU_DONE'; // Green
                  notificationTitle = `[HU FINALIZADA] ${title} (#${id})`;
                  notificationReason = `¡HU completada / Done! Estado: "${state}" • Cambio: "${cached.state}" ➔ "${state}"${roleDetails}`;
                } else if (isHuImpedimentState) {
                  notificationCategory = 'HU_IMPEDIMENT'; // Red
                  notificationTitle = `[HU CON IMPEDIMENTO] ${title} (#${id})`;
                  notificationReason = `¡ALERTA! HU con Impedimento (Estado: "${state}") • Cambio: "${cached.state}" ➔ "${state}"${roleDetails}`;
                } else if (isHuStageState) {
                  notificationCategory = 'HU_STAGE'; // Cyan
                  notificationTitle = `[HU EN STAGE] ${title} (#${id})`;
                  notificationReason = `HU en ambiente Stage (Estado: "${state}") • Cambio: "${cached.state}" ➔ "${state}"${roleDetails}`;
                } else if (isHuCommittedState) {
                  notificationCategory = 'HU_COMMITTED'; // Blue
                  notificationTitle = `[HU EN PROGRESO] ${title} (#${id})`;
                  notificationReason = `HU en desarrollo / progreso (Estado: "${state}") • Cambio: "${cached.state}" ➔ "${state}"${roleDetails}`;
                } else {
                  notificationCategory = 'HU'; // Blue
                  notificationTitle = `[HU ACTUALIZADA] ${title} (#${id})`;
                  notificationReason = `HU cambió de estado: "${cached.state}" ➔ "${state}"${roleDetails}`;
                }
              }

              // Rule 2: Bug transitions with EXACT Color Categories
              if (isBug && isBugShouldNotify) {
                let roleDetails = '';
                if (currentRoles.responsibleQA) roleDetails += ` • QA: ${currentRoles.responsibleQA}`;
                if (currentRoles.assignedTo) roleDetails += ` • Asignado: ${currentRoles.assignedTo}`;

                if (isDoneState) {
                  notificationCategory = 'BUG_DONE'; // Green
                  notificationTitle = `[BUG CERRADO] ${title} (#${id})`;
                  notificationReason = `¡Bug #${id} CERRADO / FINALIZADO! Estado: "${state}" • Cambio: "${cached.state}" ➔ "${state}"${roleDetails}`;
                } else if (isQaState) {
                  notificationCategory = 'BUG_QA'; // Yellow
                  notificationTitle = `[BUG EN QA] ${title} (#${id})`;
                  notificationReason = `Bug #${id} pasó a estado de QA (Estado: "${state}") • Cambio: "${cached.state}" ➔ "${state}"${roleDetails}`;
                } else if (isReopenState) {
                  notificationCategory = 'BUG_REOPEN'; // Purple
                  notificationTitle = `[BUG REABIERTO] ${title} (#${id})`;
                  notificationReason = `Bug #${id} ha sido REABIERTO (Estado: "${state}") • Cambio: "${cached.state}" ➔ "${state}"${roleDetails}`;
                } else if (isNewState) {
                  notificationCategory = 'BUG_NEW'; // Blue
                  notificationTitle = `[NUEVO BUG] ${title} (#${id})`;
                  notificationReason = `Bug #${id} cambió a estado New (Estado: "${state}") • Cambio: "${cached.state}" ➔ "${state}"${roleDetails}`;
                } else {
                  notificationCategory = 'BUG_NEW'; // Blue
                  notificationTitle = `[BUG ACTUALIZADO] ${title} (#${id})`;
                  notificationReason = `Bug #${id} cambió de estado: "${cached.state}" ➔ "${state}"${roleDetails}`;
                }
              }
            }
          }
        } else if (isHuShouldNotify || isBugShouldNotify) {
          // Uncached item path: only notify if freshly created (last 15 min) and NOT already notified for this state
          if (alreadyNotifiedForThisState) {
            console.log(`[ADO Notifier] Dedup (uncached): Ya se notificó #${id} para estado "${state}". Omitiendo notificación.`);
          } else {
            const createdDateStr = item.fields['System.CreatedDate'] || '';
            const createdTime = createdDateStr ? new Date(createdDateStr).getTime() : 0;
            const isNewlyCreated = createdTime > 0 && (Date.now() - createdTime) < (15 * 60 * 1000);

            if (isNewlyCreated) {
              if (isBug && isBugShouldNotify) {
                let roleDetails = '';
                if (currentRoles.responsibleQA) roleDetails += ` • QA: ${currentRoles.responsibleQA}`;
                if (currentRoles.assignedTo) roleDetails += ` • Asignado: ${currentRoles.assignedTo}`;

                if (isDoneState) {
                  notificationCategory = 'BUG_DONE';
                  notificationTitle = `[BUG CERRADO] ${title} (#${id})`;
                  notificationReason = `Bug #${id} detectado cerrado en estado "${state}"${roleDetails}`;
                } else if (isQaState) {
                  notificationCategory = 'BUG_QA';
                  notificationTitle = `[BUG EN QA] ${title} (#${id})`;
                  notificationReason = `Bug #${id} detectado en QA, estado "${state}"${roleDetails}`;
                } else if (isReopenState) {
                  notificationCategory = 'BUG_REOPEN';
                  notificationTitle = `[BUG REABIERTO] ${title} (#${id})`;
                  notificationReason = `Bug #${id} detectado reabierto, estado "${state}"${roleDetails}`;
                } else {
                  notificationCategory = 'BUG_NEW';
                  notificationTitle = `[NUEVO BUG] ${title} (#${id})`;
                  notificationReason = `Nuevo Bug #${id} recién creado en estado "${state}"${roleDetails}`;
                }
              } else if (isHU && isHuShouldNotify) {
                let roleDetails = '';
                if (currentRoles.responsibleQA) roleDetails += ` • QA: ${currentRoles.responsibleQA}`;
                if (currentRoles.assignedTo) roleDetails += ` • Asignado: ${currentRoles.assignedTo}`;
                if (currentRoles.responsibleBackend) roleDetails += ` • Backend: ${currentRoles.responsibleBackend}`;

                if (isHuReviewPoState) {
                  notificationCategory = 'HU_REVIEW_PO';
                  notificationTitle = `[HU EN REVIEW PO] ${title} (#${id})`;
                  notificationReason = `Nueva HU #${id} detectada en Review PO, estado "${state}"${roleDetails}`;
                } else if (isHuQaState) {
                  notificationCategory = 'HU_QA';
                  notificationTitle = `[HU EN QA] ${title} (#${id})`;
                  notificationReason = `Nueva HU #${id} detectada en QA, estado "${state}"${roleDetails}`;
                } else if (isHuDoneState) {
                  notificationCategory = 'HU_DONE';
                  notificationTitle = `[HU FINALIZADA] ${title} (#${id})`;
                  notificationReason = `Nueva HU #${id} detectada finalizada, estado "${state}"${roleDetails}`;
                } else if (isHuImpedimentState) {
                  notificationCategory = 'HU_IMPEDIMENT';
                  notificationTitle = `[HU CON IMPEDIMENTO] ${title} (#${id})`;
                  notificationReason = `Nueva HU #${id} detectada con impedimento, estado "${state}"${roleDetails}`;
                } else if (isHuStageState) {
                  notificationCategory = 'HU_STAGE';
                  notificationTitle = `[HU EN STAGE] ${title} (#${id})`;
                  notificationReason = `Nueva HU #${id} detectada en Stage, estado "${state}"${roleDetails}`;
                } else if (isHuCommittedState) {
                  notificationCategory = 'HU_COMMITTED';
                  notificationTitle = `[HU EN PROGRESO] ${title} (#${id})`;
                  notificationReason = `Nueva HU #${id} detectada en progreso, estado "${state}"${roleDetails}`;
                } else {
                  notificationCategory = 'HU';
                  notificationTitle = `[NUEVA HU CREADA] ${title} (#${id})`;
                  notificationReason = `Nueva HU #${id} recién creada en estado "${state}"${roleDetails}`;
                }
              }
            }
          }
        }
      } else {
        // First baseline: acknowledge current state in notifiedStates map so it never triggers on next poll
        newNotifiedStates[id] = cleanState;
        newNotifiedStates[String(id)] = cleanState;
      } // end if (!isFirstBaseline)

      // Determine the last notified state for cache tracking
      const itemLastNotifiedState = notificationReason
        ? state
        : (cached?.lastNotifiedState ?? (isFirstBaseline ? state : null));

      // Update Cache Entry with all roles + lastNotifiedState for deduplication
      newCache[id] = {
        id,
        title,
        type,
        state,
        changedDate,
        roles: currentRoles,
        assignedTo: currentRoles.assignedTo,
        responsibleQA: currentRoles.responsibleQA,
        responsibleBackend: currentRoles.responsibleBackend,
        responsibleMaquetacion: currentRoles.responsibleMaquetacion,
        responsibleIntegrador: currentRoles.responsibleIntegrador,
        otherRoles: currentRoles.otherRoles,
        url: itemUrl,
        lastSeen: new Date().toISOString(),
        lastNotifiedState: itemLastNotifiedState
      };

      if (notificationReason) {
        newNotifiedStates[id] = cleanState;
        newNotifiedStates[String(id)] = cleanState;

        const notifPayload = {
          id: `ado-${id}-${Date.now()}`,
          workItemId: id,
          title: notificationTitle || `[${notificationCategory}] ${type} #${id}`,
          message: `${notificationReason}\n"${title}"`,
          url: itemUrl,
          category: notificationCategory,
          type,
          state,
          itemTitle: title,
          timestamp: new Date().toISOString(),
          read: false,
          enableSound: settings.enableSound !== false
        };
        notificationsToTrigger.push(notifPayload);
        updatedHistory.unshift(notifPayload);
      }
    }

    // Retain all items in newCache without prematurely dropping active items.
    // Set a high ceiling (1500 items). If exceeded, prune ONLY items that were NOT
    // in the current query batch, ordered by oldest changedDate.
    const currentBatchIds = new Set(items.map(it => String(it.id)));
    const allCacheKeys = Object.keys(newCache);
    let prunedCache = newCache;

    if (allCacheKeys.length > 1500) {
      const nonBatchKeys = allCacheKeys.filter(k => !currentBatchIds.has(String(k)));
      nonBatchKeys.sort((a, b) => {
        const dateA = new Date(newCache[a].changedDate || newCache[a].lastSeen || 0).getTime();
        const dateB = new Date(newCache[b].changedDate || newCache[b].lastSeen || 0).getTime();
        return dateA - dateB;
      });
      const toRemoveCount = allCacheKeys.length - 1500;
      const keysToRemove = new Set(nonBatchKeys.slice(0, toRemoveCount));
      prunedCache = {};
      for (const k of allCacheKeys) {
        if (!keysToRemove.has(k)) {
          prunedCache[k] = newCache[k];
        }
      }
    }

    // Keep notifiedStates map bounded if it grows excessively
    const notifiedKeys = Object.keys(newNotifiedStates);
    if (notifiedKeys.length > 2500) {
      const prunedNotified = {};
      for (const k of Object.keys(prunedCache)) {
        if (newNotifiedStates[k]) prunedNotified[k] = newNotifiedStates[k];
      }
      for (const k of Object.keys(newNotifiedStates)) {
        if (!prunedNotified[k]) delete newNotifiedStates[k];
      }
    }

    // Filter out duplicate notifications for the exact same workItemId and state in history
    const seenHistoryKeys = new Set();
    const dedupedHistory = [];
    for (const notif of updatedHistory) {
      const key = `${notif.workItemId}_${removeAccents(notif.state || '')}`;
      if (!seenHistoryKeys.has(key)) {
        seenHistoryKeys.add(key);
        dedupedHistory.push(notif);
      }
    }
    const finalHistory = dedupedHistory.slice(0, 50);

    try {
      await chrome.storage.local.set({
        workItemsCache: prunedCache,
        notifiedStates: newNotifiedStates,
        history: finalHistory,
        lastSync: new Date().toISOString(),
        isInitialized: true
      });
    } catch (quotaErr) {
      console.warn('[ADO Notifier] Error guardando almacenamiento, limpiando cache previa:', quotaErr);
      const minimalCache = {};
      for (const item of items) {
        if (newCache[item.id]) minimalCache[item.id] = newCache[item.id];
      }
      await chrome.storage.local.set({
        workItemsCache: minimalCache,
        notifiedStates: newNotifiedStates,
        history: finalHistory.slice(0, 25),
        lastSync: new Date().toISOString(),
        isInitialized: true
      });
    }
    await updateBadge(finalHistory);

    for (const notif of notificationsToTrigger) {
      await triggerNotification(notif, settings);
    }

    return {
      success: true,
      updatedCount: notificationsToTrigger.length,
      lastSync: new Date().toISOString()
    };

  } catch (err) {
    console.error('[ADO Notifier] Excepción en checkForUpdates:', err);
    return { success: false, message: `Error inesperado: ${err.message}` };
  } finally {
    isCheckingUpdates = false;
  }
}

// Deliver in-page floating toast to a single tab, injecting script if needed
async function deliverToastToTab(tab, notif) {
  if (!tab || !tab.id || !tab.url) return;
  if (tab.url.startsWith('chrome') || tab.url.startsWith('edge') || tab.url.startsWith('about:') || tab.url.startsWith('devtools:')) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      action: 'SHOW_INPAGE_TOAST',
      payload: notif
    });
  } catch (err) {
    try {
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/toast.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content-script.js']
      });

      setTimeout(() => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'SHOW_INPAGE_TOAST',
          payload: notif
        }).catch(() => {});
      }, 100);
    } catch (injectErr) {}
  }
}

// Helper for Offscreen Document Audio Playback in Manifest V3
async function playChimeSoundViaOffscreen() {
  try {
    const existingContexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL('offscreen/offscreen.html')]
    });

    if (existingContexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: 'offscreen/offscreen.html',
        reasons: ['AUDIO_PLAYBACK'],
        justification: 'Reproducir timbre futurista de notificación'
      });
      await new Promise(resolve => setTimeout(resolve, 120));
    }

    chrome.runtime.sendMessage({ action: 'PLAY_CHIME_SOUND' }).catch(() => {});
  } catch (e) {
    console.warn('[ADO Notifier] Error al reproducir sonido offscreen:', e);
  }
}

// Notification Trigger Function
async function triggerNotification(notif, settings) {
  // 0. Play Chime Sound via Offscreen Document (Manifest V3)
  if (settings.enableSound !== false) {
    playChimeSoundViaOffscreen();
  }

  // 1. Desktop OS Native Notification
  if (settings.enableDesktopNotifications !== false) {
    const notifId = notif.id;
    notificationUrlMap.set(notifId, notif.url);

    try {
      chrome.notifications.create(notifId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('assets/icon128.png'),
        title: notif.title,
        message: notif.message,
        priority: 2,
        requireInteraction: true
      }, (createdId) => {
        if (chrome.runtime.lastError) {
          console.error('[ADO Notifier] Error en chrome.notifications.create:', chrome.runtime.lastError.message);
        } else {
          console.log('[ADO Notifier] Notificación nativa disparada:', createdId);
        }
      });
    } catch (err) {
      console.warn('[ADO Notifier] Error creando notificación nativa:', err);
    }
  }

  // 2. Broadcast to Extension Views (options.html)
  chrome.runtime.sendMessage({
    action: 'SHOW_INPAGE_TOAST',
    payload: notif
  }).catch(() => {});

  // 3. Deliver in-page toast to all active tabs across all browser windows
  if (settings.enableInPageToasts !== false) {
    try {
      const activeTabs = await chrome.tabs.query({ active: true });
      for (const tab of activeTabs) {
        await deliverToastToTab(tab, notif);
      }
    } catch (e) {
      console.warn('[ADO Notifier] Error enviando toast a pestañas:', e);
    }
  }
}

// Helper to update Extension Icon Badge with unread notifications count
async function updateBadge(historyList) {
  try {
    let list = historyList;
    if (!list) {
      const stored = await chrome.storage.local.get('history');
      list = stored.history || [];
    }
    const unreadCount = (list || []).filter(item => !item.read).length;
    if (chrome.action && chrome.action.setBadgeText) {
      if (unreadCount > 0) {
        chrome.action.setBadgeText({ text: String(unreadCount > 99 ? '99+' : unreadCount) });
        chrome.action.setBadgeBackgroundColor({ color: '#0078D4' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    }
  } catch (err) {
    console.warn('[ADO Notifier] Error actualizando badge:', err);
  }
}

// Handle notification click (redirects to Azure DevOps and marks as read)
chrome.notifications.onClicked.addListener(async (notificationId) => {
  let url = notificationUrlMap.get(notificationId);
  const { history = [] } = await chrome.storage.local.get('history');
  const item = history.find(h => h.id === notificationId);
  if (!url && item && item.url) {
    url = item.url;
  }
  
  if (url) {
    chrome.tabs.create({ url });
    chrome.notifications.clear(notificationId);
  }
  
  await markHistoryItemAsRead(notificationId);
});

// Runtime Message Handling (from Popup, Options Dashboard & Content Scripts)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'TEST_CONNECTION') {
    testAzureDevOpsConnection(request.credentials)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, message: err.message }));
    return true;
  }

  if (request.action === 'TRIGGER_MANUAL_SYNC') {
    checkForUpdates()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, message: err.message }));
    return true;
  }

  if (request.action === 'TRIGGER_TEST_NOTIFICATION') {
    handleTestNotification(request.category)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, message: err.message }));
    return true;
  }

  if (request.action === 'TRIGGER_TEST_SOUND') {
    playChimeSoundViaOffscreen()
      .then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, message: err.message }));
    return true;
  }

  if (request.action === 'MARK_AS_READ') {
    markHistoryItemAsRead(request.id)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, message: err.message }));
    return true;
  }

  if (request.action === 'MARK_MULTIPLE_READ') {
    markMultipleHistoryItemsAsRead(request.ids)
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, message: err.message }));
    return true;
  }

  if (request.action === 'MARK_ALL_AS_READ') {
    markAllHistoryAsRead()
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ success: false, message: err.message }));
    return true;
  }

  if (request.action === 'DELETE_HISTORY_ITEM') {
    deleteHistoryItem(request.id)
      .then(res => sendResponse(res));
    return true;
  }

  if (request.action === 'DELETE_MULTIPLE_HISTORY') {
    deleteMultipleHistoryItems(request.ids)
      .then(res => sendResponse(res));
    return true;
  }

  if (request.action === 'CLEAR_HISTORY') {
    chrome.storage.local.set({ history: [] })
      .then(async () => {
        await updateBadge([]);
        sendResponse({ success: true });
      });
    return true;
  }
});

async function markHistoryItemAsRead(id) {
  if (!id) return { success: false, message: 'ID no proporcionado' };
  const { history = [] } = await chrome.storage.local.get('history');
  let changed = false;
  const updated = history.map(item => {
    if ((item.id === id || String(item.workItemId) === String(id)) && !item.read) {
      changed = true;
      return { ...item, read: true };
    }
    return item;
  });

  if (changed) {
    await chrome.storage.local.set({ history: updated });
    await updateBadge(updated);
  }
  return { success: true, count: updated.length };
}

async function markMultipleHistoryItemsAsRead(ids) {
  const idsSet = new Set((ids || []).map(String));
  if (idsSet.size === 0) return { success: true };
  const { history = [] } = await chrome.storage.local.get('history');
  let changed = false;
  const updated = history.map(item => {
    if ((idsSet.has(item.id) || idsSet.has(String(item.workItemId))) && !item.read) {
      changed = true;
      return { ...item, read: true };
    }
    return item;
  });

  if (changed) {
    await chrome.storage.local.set({ history: updated });
    await updateBadge(updated);
  }
  return { success: true, count: updated.length };
}

async function markAllHistoryAsRead() {
  const { history = [] } = await chrome.storage.local.get('history');
  const updated = history.map(item => ({ ...item, read: true }));
  await chrome.storage.local.set({ history: updated });
  await updateBadge(updated);
  return { success: true, count: updated.length };
}

async function deleteHistoryItem(id) {
  const { history = [] } = await chrome.storage.local.get('history');
  const updated = history.filter(item => item.id !== id);
  await chrome.storage.local.set({ history: updated });
  await updateBadge(updated);
  return { success: true, count: updated.length };
}

async function deleteMultipleHistoryItems(ids) {
  const { history = [] } = await chrome.storage.local.get('history');
  const idsSet = new Set(ids || []);
  const updated = history.filter(item => !idsSet.has(item.id));
  await chrome.storage.local.set({ history: updated });
  await updateBadge(updated);
  return { success: true, count: updated.length };
}

// Test Connection Helper
async function testAzureDevOpsConnection(creds) {
  try {
    const { org, project, pat } = creds;
    if (!org || !project || !pat) {
      return { success: false, message: 'Por favor complete Organización, Proyecto y PAT.' };
    }

    const authHeader = 'Basic ' + btoa(':' + pat.trim());
    const cleanOrg = encodeURIComponent(org.trim());
    const cleanProject = encodeURIComponent(project.trim());

    const url = `https://dev.azure.com/${cleanOrg}/_apis/projects/${cleanProject}?api-version=7.0`;
    const res = await fetch(url, {
      headers: { 'Authorization': authHeader }
    });

    if (!res.ok) {
      if (res.status === 401) {
        return { success: false, message: 'Autenticación fallida (401). Verifique que el Personal Access Token (PAT) sea válido.' };
      }
      if (res.status === 404) {
        return { success: false, message: 'Proyecto u Organización no encontrados (404). Revise los nombres exactos.' };
      }
      let errDetail = res.statusText;
      try {
        const errJson = await res.json();
        errDetail = errJson.message || JSON.stringify(errJson);
      } catch (e) {}
      return { success: false, message: `Error HTTP ${res.status}: ${errDetail}` };
    }

    const data = await res.json();
    return {
      success: true,
      message: `¡Conexión Exitosa con Azure DevOps! Proyecto verificado: "${data.name}" (ID: ${data.id})`
    };

  } catch (err) {
    return { success: false, message: `Error de red o CORS: ${err.message}` };
  }
}

// Generate test notifications for demo/verification
async function handleTestNotification(category = 'HU') {
  const { settings } = await chrome.storage.local.get('settings');
  const org = settings?.org || 'mi-organizacion';
  const project = settings?.project || 'mi-proyecto';

  const mockNotifs = {
    HU: {
      category: 'HU',
      workItemId: 100001,
      title: '[HU ACTUALIZADA] HU-101 - Consultar información de usuario (#100001)',
      message: 'HU cambió de estado: "New" ➔ "Committed" • QA: Juan Pérez • Asignado: Carlos Rodríguez',
      url: `https://dev.azure.com/${org}/${project}/_workitems/edit/100001`
    },
    HU_QA: {
      category: 'HU_QA',
      workItemId: 100001,
      title: '[HU EN QA] HU-101 - Consultar información de usuario (#100001)',
      message: 'HU pasó a QA (Estado: "Qa") • Cambio: "Committed" ➔ "Qa" • QA: Juan Pérez • Asignado: Carlos Rodríguez',
      url: `https://dev.azure.com/${org}/${project}/_workitems/edit/100001`
    },
    HU_REVIEW_PO: {
      category: 'HU_REVIEW_PO',
      workItemId: 100001,
      title: '[HU EN REVIEW PO] HU-101 - Consultar información de usuario (#100001)',
      message: 'HU pasó a Review PO (Estado: "Review PO") • Cambio: "Qa" ➔ "Review PO" • QA: Juan Pérez',
      url: `https://dev.azure.com/${org}/${project}/_workitems/edit/100001`
    },
    HU_DONE: {
      category: 'HU_DONE',
      workItemId: 100001,
      title: '[HU FINALIZADA] HU-101 - Consultar información de usuario (#100001)',
      message: '¡HU COMPLETADA / FINALIZADA! Estado: "Done" • Cambio: "In Stage" ➔ "Done" • QA: Juan Pérez',
      url: `https://dev.azure.com/${org}/${project}/_workitems/edit/100001`
    },
    HU_IMPEDIMENT: {
      category: 'HU_IMPEDIMENT',
      workItemId: 100001,
      title: '[HU CON IMPEDIMENTO] HU-101 - Consultar información de usuario (#100001)',
      message: '¡ALERTA! HU bloqueada con Impedimento (Estado: "Impediment") • QA: Juan Pérez',
      url: `https://dev.azure.com/${org}/${project}/_workitems/edit/100001`
    },
    HU_STAGE: {
      category: 'HU_STAGE',
      workItemId: 100001,
      title: '[HU EN STAGE] HU-101 - Consultar información de usuario (#100001)',
      message: 'HU desplegada en ambiente Stage (Estado: "In Stage") • QA: Juan Pérez',
      url: `https://dev.azure.com/${org}/${project}/_workitems/edit/100001`
    },
    HU_ASSIGNED: {
      category: 'HU_ASSIGNED',
      workItemId: 100002,
      title: '[HU ASIGNADA A TI] HU-088 - Visualizar página de inicio (#100002)',
      message: '¡Se te asignó como Responsable QA! (Anterior: "Sin QA") • Estado: "Qa" • Asignado: Juan Pérez',
      url: `https://dev.azure.com/${org}/${project}/_workitems/edit/100002`
    },
    BUG_NEW: {
      category: 'BUG_NEW',
      workItemId: 200001,
      title: '[NUEVO BUG] Bug #200001 (NEW)',
      message: 'Nuevo Bug #200001 reportado en estado "New"\n"Error en inicio de sesión al ingresar credenciales..."',
      url: `https://dev.azure.com/${org}/${project}/_workitems/edit/200001`
    },
    BUG_QA: {
      category: 'BUG_QA',
      workItemId: 200001,
      title: '[BUG EN QA] Bug #200001 (Qa)',
      message: 'Bug #200001 pasó a estado de QA ("Qa")\n"Error en inicio de sesión al ingresar credenciales..."',
      url: `https://dev.azure.com/${org}/${project}/_workitems/edit/200001`
    },
    BUG_DONE: {
      category: 'BUG_DONE',
      workItemId: 200001,
      title: '[BUG CERRADO] Bug #200001 (Done)',
      message: '¡Bug #200001 ha sido CERRADO y COMPLETADO! Estado: "Done"\n"Error en inicio de sesión al ingresar credenciales..."',
      url: `https://dev.azure.com/${org}/${project}/_workitems/edit/200001`
    },
    BUG_REOPEN: {
      category: 'BUG_REOPEN',
      workItemId: 200001,
      title: '[BUG REABIERTO] Bug #200001 (Reopened)',
      message: 'Bug #200001 ha sido REABIERTO (Estado: "Reopened")\n"Error en inicio de sesión al ingresar credenciales..."',
      url: `https://dev.azure.com/${org}/${project}/_workitems/edit/200001`
    }
  };

  const selected = mockNotifs[category] || mockNotifs.HU;
  const notifPayload = {
    id: `test-${Date.now()}`,
    ...selected,
    timestamp: new Date().toISOString(),
    read: false
  };

  const { history = [] } = await chrome.storage.local.get('history');
  history.unshift(notifPayload);
  const finalHistory = history.slice(0, 50);
  await chrome.storage.local.set({ history: finalHistory });
  await updateBadge(finalHistory);

  await triggerNotification(notifPayload, settings || DEFAULT_SETTINGS);
  return { success: true, notification: notifPayload };
}
