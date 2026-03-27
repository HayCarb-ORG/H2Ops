const API = {
  base: "https://h2opsbackend.onrender.com/api",
  endpoints: {
    login: "/auth/login",
    stats: "/dashboard/stats",
    logs: "/logs",
    incidents: "/incidents",
    datasheets: "/datasheets",
    users: "/auth/users",
    sop: "/sop"
  }
};

const state = {
  accessToken: localStorage.getItem("token") || "",
  refreshToken: localStorage.getItem("refreshToken") || "",
  user: JSON.parse(localStorage.getItem("user") || "null"),
  dashboards: null,
  lastStatsFetch: null,
  activeTab: "dash",
  datasheets: [],
  logs: [],
  incidents: [],
  sop: localStorage.getItem("sop") || '',
  plants: JSON.parse(localStorage.getItem("plants") || "[]"),
  selectedPlant: localStorage.getItem("selectedPlant") || "",
  selectedDatasheetId: null
};

function qs(sel, parent = document){ return parent.querySelector(sel); }
function qsa(sel, parent = document){ return Array.from(parent.querySelectorAll(sel)); }
function asFormData(form){
  const fd = new FormData(form);
  return Object.fromEntries(fd.entries());
}
function toast(msg){
  alert(msg);
}

async function api(path, options = {}){
  const headers = options.headers || {};
  if (state.accessToken) headers["Authorization"] = `Bearer ${state.accessToken}`;
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API.base}${path}`, { ...options, headers });
  if (res.status === 401 && state.refreshToken){
    await refreshSession();
    return api(path, options);
  }
  if (!res.ok) throw new Error((await res.json()).message || "Request failed");
  return res.json();
}

async function refreshSession(){
  if (!state.refreshToken) return logout();
  const res = await fetch(`${API.base}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: state.refreshToken })
  });
  if (!res.ok) return logout();
  const data = await res.json();
  state.accessToken = data.accessToken;
  localStorage.setItem("token", data.accessToken);
}

function saveSession(data){
  state.accessToken = data.accessToken;
  state.refreshToken = data.refreshToken;
  state.user = data.user;
  localStorage.setItem("token", data.accessToken);
  localStorage.setItem("refreshToken", data.refreshToken);
  localStorage.setItem("user", JSON.stringify(data.user));
}

function clearSession(){
  state.accessToken = "";
  state.refreshToken = "";
  state.user = null;
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}

async function handleLogin(e){
  e.preventDefault();
  const { email, password } = asFormData(e.target);
  qs("#loginBtn").disabled = true;
  try{
    const data = await api(API.endpoints.login, {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    saveSession(data);
    await hydrateApp();
    qs("#auth").style.display = "none";
    qs("header").style.display = "flex";
    qs("main").style.display = "block";
  }catch(err){
    toast(err.message ?? "Login failed");
  }finally{
    qs("#loginBtn").disabled = false;
  }
}

function logout(){
  clearSession();
  qs("#auth").style.display = "grid";
  qs("header").style.display = "none";
  qs("main").style.display = "none";
}

async function hydrateApp(){
  await Promise.all([
    loadDashboardStats(),
    loadLogs(),
    loadIncidents(),
    loadDatasheets(),
    loadSOP()
  ]);
  renderUser();
  renderPlants();
}

async function loadDashboardStats(){
  try {
    const stats = await api(API.endpoints.stats);
    state.dashboards = stats;
    state.lastStatsFetch = new Date().toISOString();
    renderDashboards();
  } catch (error) {
    console.error("Failed to load dashboard stats:", error);
  }
}

function renderDashboards(){
  const stats = state.dashboards;
  if(!stats) return;
  qs("#totals").textContent = stats.totalLogs || 0;
  qs("#incCount").textContent = stats.openIncidents || 0;
  qs("#chemStatus").textContent = stats.chemicalStatus || "Stable";
  qs("#alerts").textContent = stats.activeAlerts || 0;
  qs("#dashLogs").innerHTML = (stats.recentLogs || []).map(log => `
    <div>
      <strong>${log.parameter}</strong> ${log.value}${log.unit} @ ${new Date(log.timestamp).toLocaleString()}
      <div class="help">${log.notes || ""}</div>
    </div>
  `).join("") || '<div class="empty">No logs yet</div>';
  qs("#dashInc").innerHTML = (stats.openIncidentDetails || []).map(inc => `
    <div>
      <div class="row">
        <strong>${inc.title}</strong>
        <span class="sev-pill sev-${inc.severity?.toLowerCase()}">${inc.severity}</span>
      </div>
      <div class="help">${inc.status} • ${new Date(inc.date || inc.createdAt).toLocaleString()}</div>
    </div>
  `).join("") || '<div class="empty">No incidents open</div>';
}

async function loadLogs(){
  try {
    const data = await api(API.endpoints.logs);
    state.logs = data;
    renderLogs();
  } catch (error) {
    console.error("Failed to load logs:", error);
  }
}

function renderLogs(){
  const rows = state.logs.map(log => `
    <tr>
      <td>${log.plant || "Central"}</td>
      <td>${log.operator}</td>
      <td>${log.parameter}</td>
      <td>${log.value}</td>
      <td>${log.unit || ""}</td>
      <td>${log.status || "OK"}</td>
      <td>${new Date(log.timestamp).toLocaleString()}</td>
    </tr>
  `).join("");
  qs("#logRows").innerHTML = rows || '<tr><td colspan="7" class="empty">No logs yet</td></tr>';
}

async function loadIncidents(){
  try {
    const data = await api(API.endpoints.incidents);
    state.incidents = data;
    renderIncidents();
  } catch (error) {
    console.error("Failed to load incidents:", error);
  }
}

function renderIncidents(){
  const rows = state.incidents.map(i => `
    <tr>
      <td>${i.title}</td>
      <td>${i.severity}</td>
      <td>${i.status}</td>
      <td>${new Date(i.date || i.createdAt).toLocaleDateString()}</td>
      <td>${i.action || ""}</td>
      <td>${i.owner || ""}</td>
    </tr>
  `).join("");
  qs("#incidentRows").innerHTML = rows || '<tr><td colspan="6" class="empty">No incidents logged</td></tr>';
}

async function loadDatasheets(){
  try {
    const data = await api(API.endpoints.datasheets);
    state.datasheets = data;
    renderDatasheets();
    renderDatasheetSelector();
  } catch (error) {
    console.error("Failed to load datasheets:", error);
  }
}

async function loadSOP(){
  try {
    const data = await api(API.endpoints.sop);
    state.sop = data.content || '';
    localStorage.setItem('sop', state.sop);
    renderSOP();
  } catch (error) {
    console.error("Failed to load SOP:", error);
  }
}

function renderSOP(){
  const output = qs('#sopOutput');
  const input = qs('#sopInput');
  if(output) output.textContent = state.sop;
  if(input) input.value = state.sop;
}

function renderUser(){
  const user = state.user;
  if(!user) return;
  qs("#userName").textContent = user.name || user.email;
}

function renderPlants(){
  const select = qs('#plantSelect');
  if(!select) return;
  const options = state.plants.map(p => `<option value="${p.id}">${p.name}</option>`);
  select.innerHTML = '<option value="">All Plants</option>' + options.join('');
  select.value = state.selectedPlant || '';
}

function setTab(tab){
  state.activeTab = tab;
  qsa('.panel').forEach(p => p.hidden = p.id !== `panel-${tab}`);
  qsa('.tab').forEach(btn => btn.setAttribute('aria-selected', btn.dataset.tab === tab));
}

async function refreshAll(){
  await hydrateApp();
}

function addRow(tableId, row){
  const tbody = qs(`#${tableId} tbody`);
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = row;
  tbody.appendChild(tr);
}

function readRows(tableId){
  const tbody = qs(`#${tableId} tbody`);
  if (!tbody) return [];
  return Array.from(tbody.querySelectorAll('tr')).map(tr =>
    Array.from(tr.cells).map(cell => cell.textContent.trim())
  );
}

function makeSheetData(id){
  const card = qs(`[data-sheet="${id}"]`);
  if(!card) return null;
  const name = card.querySelector('h3').textContent.trim();
  const groups = Array.from(card.querySelectorAll('.sheet-group')).map(group => {
    const label = group.dataset.label || "";
    const rows = Array.from(group.querySelectorAll('tbody tr')).map(tr =>
      Array.from(tr.cells).map(cell => cell.textContent.trim())
    );
    return { label, rows };
  });
  return { id, name, groups };
}

function renderDatasheetSelector(){
  const selector = qs('#datasheetSelect');
  if(!selector) return;
  selector.innerHTML = state.datasheets.map(sheet =>
    `<option value="${sheet._id}">${sheet.name}</option>`
  ).join('');
  if(state.datasheets.length && !state.selectedDatasheetId){
    state.selectedDatasheetId = state.datasheets[0]._id;
  }
  selector.value = state.selectedDatasheetId || '';
  selector.dispatchEvent(new Event('change'));
}

function renderDatasheets(){
  const container = qs('#datasheetCards');
  if(!container) return;
  container.innerHTML = state.datasheets.map(sheet => {
    const groups = sheet.sections?.map(section => {
      const rows = section.rows?.map(row => `
        <tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>
      `).join('') || '';
      return `
        <section class="card sheet-group" data-label="${section.name}">
          <h4>${section.name}</h4>
          <div class="body">
            <table class="table">
              <tbody>${rows}</tbody>
            </table>
          </div>
        </section>
      `;
    }).join('') || '';
    return `
      <article class="sheet" data-sheet="${sheet._id}">
        <header class="row">
          <div>
            <h3>${sheet.name}</h3>
            <p class="help">${sheet.description || ''}</p>
          </div>
          <div class="right">
            <button type="button" onclick="exportDatasheet('${sheet._id}','xls')">XLS</button>
            <button type="button" onclick="exportDatasheet('${sheet._id}','doc')">DOC</button>
            <button type="button" onclick="exportDatasheet('${sheet._id}','pdf')">PDF</button>
          </div>
        </header>
        <div class="grid g2">${groups}</div>
      </article>
    `;
  }).join('') || '<div class="empty">No datasheets defined</div>';
}

function exportAllDatasheets(format){
  const table = format === 'pdf' ? createDatasheetTableElement() : makeDatasheetExport();
  if(format === 'xls') return tableDLxls(table, 'datasheets.xls');
  if(format === 'doc') return docDL(table, 'datasheets.doc');
  if(format === 'pdf') return pdfDL(table, 'datasheets.pdf');
}

function exportDatasheet(id, format){
  const sheet = state.datasheets.find(ds => ds._id === id);
  if(!sheet) return;
  const table = format === 'pdf' ? createSingleDatasheetElement(sheet) : makeSingleDatasheetExport(sheet);
  if(format === 'xls') return tableDLxls(table, `${sheet.name}.xls`);
  if(format === 'doc') return docDL(table, `${sheet.name}.doc`);
  if(format === 'pdf') return pdfDL(table, `${sheet.name}.pdf`);
}

function makeDatasheetExport(){
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  state.datasheets.forEach(sheet => {
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = `<th colspan="4">${sheet.name}</th>`;
    tbody.appendChild(headerRow);
    sheet.sections?.forEach(section => {
      const sectionHeader = document.createElement('tr');
      sectionHeader.innerHTML = `<td colspan="4"><strong>${section.name}</strong></td>`;
      tbody.appendChild(sectionHeader);
      section.rows?.forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
          const td = document.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    });
  });
  table.appendChild(tbody);
  return table;
}

function makeSingleDatasheetExport(sheet){
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  const headerRow = document.createElement('tr');
  headerRow.innerHTML = `<th colspan="4">${sheet.name}</th>`;
  tbody.appendChild(headerRow);
  sheet.sections?.forEach(section => {
    const sectionHeader = document.createElement('tr');
    sectionHeader.innerHTML = `<td colspan="4"><strong>${section.name}</strong></td>`;
    tbody.appendChild(sectionHeader);
    section.rows?.forEach(row => {
      const tr = document.createElement('tr');
      row.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell;
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  });
  table.appendChild(tbody);
  return table;
}

function createDatasheetTableElement(){
  const container = document.createElement('div');
  container.className = 'datasheet-export';
  state.datasheets.forEach(sheet => {
    const section = document.createElement('section');
    section.innerHTML = `
      <h3>${sheet.name}</h3>
      ${(sheet.sections || []).map(sec => `
        <div>
          <strong>${sec.name}</strong>
          <table class="table">
            <tbody>
              ${(sec.rows || []).map(row => `
                <tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `).join('')}
    `;
    container.appendChild(section);
  });
  return container;
}

function createSingleDatasheetElement(sheet){
  const container = document.createElement('div');
  container.className = 'datasheet-export';
  container.innerHTML = `
    <h3>${sheet.name}</h3>
    ${(sheet.sections || []).map(sec => `
      <div>
        <strong>${sec.name}</strong>
        <table class="table">
          <tbody>
            ${(sec.rows || []).map(row => `
              <tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `).join('')}
  `;
  return container;
}

function tableDLxls(table, filename){
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8" /><style>table{border-collapse:collapse;font-family:Inter,Arial;font-size:12px}td,th{border:1px solid #d1d5db;padding:4px 6px}</style></head>
    <body>${table.outerHTML}</body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function docDL(content, filename){
  const html = `
    <html xmlns:w="urn:schemas-microsoft-com:office:word">
    <head><meta charset="utf-8" /><style>body{font-family:Inter,Arial;line-height:1.4}</style></head>
    <body>${content.outerHTML || content}</body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/msword" });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function pdfDL(content, filename){
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
    <head>
      <title>${filename}</title>
      <style>
        body{font-family:Inter,Arial;margin:20px;line-height:1.4}
        table{width:100%;border-collapse:collapse;margin-bottom:16px}
        th,td{border:1px solid #d1d5db;padding:6px 8px}
        h3{margin-top:24px}
      </style>
    </head>
    <body>${content.outerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function exportDatasheetsXLS(){
  const table = makeDatasheetExport();
  tableDLxls(table, 'datasheets.xls');
}

function exportDatasheetsDOC(){
  const table = makeDatasheetExport();
  docDL(table, 'datasheets.doc');
}

function exportDatasheetsPDF(){
  const table = createDatasheetTableElement();
  pdfDL(table, 'datasheets.pdf');
}

function exportDatasheetXLS(){
  const id = qs('#datasheetSelect').value;
  if(!id) return;
  exportDatasheet(id, 'xls');
}

function exportDatasheetDOC(){
  const id = qs('#datasheetSelect').value;
  if(!id) return;
  exportDatasheet(id, 'doc');
}

function exportDatasheetPDF(){
  const id = qs('#datasheetSelect').value;
  if(!id) return;
  exportDatasheet(id, 'pdf');
}

function setDatasheet(id){
  state.selectedDatasheetId = id;
  qsa('.sheet').forEach(sheet => sheet.hidden = sheet.dataset.sheet !== id);
}

function populateDatasheet(data){
  const datasheetView = qs('#datasheetView');
  if(!datasheetView) return;
  datasheetView.innerHTML = data.sections?.map(section => `
    <section class="card">
      <h4>${section.name}</h4>
      <div class="body">
        <table class="table">
          <tbody>
            ${section.rows?.map(row => `
              <tr>${row.map(cell => `<td>${cell || ''}</td>`).join('')}</tr>
            `).join('') || ''}
          </tbody>
        </table>
      </div>
    </section>
  `).join('') || '<div class="empty">No data</div>';
}

function editDatasheet(){
  const id = qs('#datasheetSelect').value;
  if(!id) return;
  const data = state.datasheets.find(ds => ds._id === id);
  if(!data) return;
  populateDatasheet(data);
}

async function saveDatasheet(e){
  e.preventDefault();
  const id = qs('#datasheetSelect').value;
  if(!id) return;
  const form = e.target;
  const sections = Array.from(form.querySelectorAll('[data-section]')).map(section => ({
    name: section.querySelector('input[name="sectionName"]').value,
    rows: Array.from(section.querySelectorAll('tbody tr')).map(tr =>
      Array.from(tr.cells).map(cell => cell.querySelector('input')?.value || cell.textContent)
    )
  }));
  try {
    const updated = await api(`${API.endpoints.datasheets}/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ sections })
    });
    state.datasheets = state.datasheets.map(ds => ds._id === id ? updated : ds);
    renderDatasheets();
  } catch (error) {
    console.error("Failed to save datasheet:", error);
  }
}

async function createDatasheet(e){
  e.preventDefault();
  const form = e.target;
  const data = asFormData(form);
  const payload = {
    name: data.name,
    description: data.description,
    sections: []
  };
  try {
    const created = await api(API.endpoints.datasheets, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    state.datasheets.push(created);
    renderDatasheets();
    renderDatasheetSelector();
    form.reset();
  } catch (error) {
    console.error("Failed to create datasheet:", error);
  }
}

function addSection(){
  const container = qs('#datasheetSections');
  if(!container) return;
  const index = container.children.length;
  const section = document.createElement('section');
  section.className = 'card';
  section.dataset.section = index;
  section.innerHTML = `
    <h4>Section ${index + 1}</h4>
    <div class="stack">
      <label class="stack">
        <span class="help">Section Name</span>
        <input name="sectionName" required />
      </label>
      <button type="button" onclick="addRowToSection(${index})">Add Row</button>
      <table class="table">
        <tbody></tbody>
      </table>
    </div>
  `;
  container.appendChild(section);
}

function addRowToSection(index){
  const section = qs(`[data-section="${index}"]`);
  if(!section) return;
  const tbody = section.querySelector('tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input /></td>
    <td><input /></td>
    <td><input /></td>
    <td><input /></td>
  `;
  tbody.appendChild(tr);
}

async function submitLog(e){
  e.preventDefault();
  const data = asFormData(e.target);
  try {
    const created = await api(API.endpoints.logs, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    state.logs.unshift(created);
    renderLogs();
    e.target.reset();
  } catch (error) {
    console.error("Failed to submit log:", error);
  }
}

async function submitIncident(e){
  e.preventDefault();
  const data = asFormData(e.target);
  try {
    const created = await api(API.endpoints.incidents, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    state.incidents.unshift(created);
    renderIncidents();
    e.target.reset();
  } catch (error) {
    console.error("Failed to submit incident:", error);
  }
}

async function loadUsers(){
  try {
    const data = await api(API.endpoints.users);
    const list = qs('#userList');
    if(list){
      list.innerHTML = data.map(u => `<li>${u.name || u.email}</li>`).join('');
    }
  } catch (error) {
    console.error("Failed to load users:", error);
  }
}

function addPlant(){
  const name = prompt('Plant name');
  if(!name) return;
  const id = `plant-${Date.now()}`;
  const plant = { id, name };
  state.plants.push(plant);
  localStorage.setItem('plants', JSON.stringify(state.plants));
  renderPlants();
}

function removePlant(id){
  state.plants = state.plants.filter(p => p.id !== id);
  localStorage.setItem('plants', JSON.stringify(state.plants));
  renderPlants();
}

function selectPlant(id){
  state.selectedPlant = id;
  localStorage.setItem('selectedPlant', id);
}

async function saveSOP(e){
  e.preventDefault();
  const content = qs('#sopInput').value;
  try {
    const saved = await api(API.endpoints.sop, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
    state.sop = saved.content;
    localStorage.setItem('sop', state.sop);
    renderSOP();
  } catch (error) {
    console.error("Failed to save SOP:", error);
  }
}

function renderDatasheet(id){
  const ds = state.datasheets.find(d => d._id === id);
  if(!ds) return;
  const view = qs('#datasheetView');
  if(!view) return;
  view.innerHTML = ds.sections?.map(section => `
    <section class="card">
      <h4>${section.name}</h4>
      <div class="body">
        <table class="table">
          <tbody>
            ${section.rows?.map(row => `
              <tr>${row.map(cell => `<td>${cell || ''}</td>`).join('')}</tr>
            `).join('') || ''}
          </tbody>
        </table>
      </div>
    </section>
  `).join('') || '<div class="empty">No data</div>';
}

async function updateDatasheetView(){
  const id = qs('#datasheetSelect').value;
  if(!id) return;
  try {
    const data = await api(`${API.endpoints.datasheets}/${id}`);
    const existingIndex = state.datasheets.findIndex(ds => ds._id === id);
    if(existingIndex !== -1){
      state.datasheets[existingIndex] = data;
    } else {
      state.datasheets.push(data);
    }
    renderDatasheet(id);
    updateDropdowns();
  } catch (error) {
    console.error("Failed to update datasheet view:", error);
  }
}

function updateDropdowns(){
  const selects = qsa('select[name="datasheet"]');
  selects.forEach(select => {
    const currentValue = select.value;
    select.innerHTML = state.datasheets.map(ds => `<option value="${ds._id}">${ds.name}</option>`).join('');
    select.value = currentValue || state.datasheets[0]?._id || '';
  });
}

function updateDatasheetSelectOptions(){
  const datasheetSelect = qs('#datasheetSelect');
  if(datasheetSelect){
    const options = state.datasheets.map(ds => `<option value="${ds._id}">${ds.name}</option>`).join('');
    datasheetSelect.innerHTML = options;
    datasheetSelect.value = state.selectedDatasheetId || state.datasheets[0]?._id || '';
  }
}

function handleDatasheetChange(){
  const id = qs('#datasheetSelect').value;
  if(!id) return;
  state.selectedDatasheetId = id;
  renderDatasheet(id);
}

function setupEventListeners(){
  qs('#loginForm')?.addEventListener('submit', handleLogin);
  qs('#logoutBtn')?.addEventListener('click', logout);
  qsa('.tab').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  qs('#refreshBtn')?.addEventListener('click', refreshAll);
  qs('#datasheetSelect')?.addEventListener('change', handleDatasheetChange);
  qs('#datasheetForm')?.addEventListener('submit', saveDatasheet);
  qs('#newSheetForm')?.addEventListener('submit', createDatasheet);
  qs('#logForm')?.addEventListener('submit', submitLog);
  qs('#incidentForm')?.addEventListener('submit', submitIncident);
  qs('#sopForm')?.addEventListener('submit', saveSOP);
  qs('#exportXLS')?.addEventListener('click', exportDatasheetsXLS);
  qs('#exportDOC')?.addEventListener('click', exportDatasheetsDOC);
  qs('#exportPDF')?.addEventListener('click', exportDatasheetsPDF);
  qs('#exportSheetXLS')?.addEventListener('click', exportDatasheetXLS);
  qs('#exportSheetDOC')?.addEventListener('click', exportDatasheetDOC);
  qs('#exportSheetPDF')?.addEventListener('click', exportDatasheetPDF);
  qs('#datasheetSelect')?.addEventListener('change', updateDatasheetView);
  qs('#plantSelect')?.addEventListener('change', e => selectPlant(e.target.value));
}

async function init(){
  setupEventListeners();
  if(state.accessToken){
    try{
      await hydrateApp();
      qs("#auth").style.display = "none";
      qs("header").style.display = "flex";
      qs("main").style.display = "block";
    }catch(err){
      console.error(err);
      logout();
    }
  }
}

document.addEventListener('DOMContentLoaded', init);
