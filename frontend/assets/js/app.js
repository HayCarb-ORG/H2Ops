// H2Ops dashboard client script
const runtimeHost = window.location.hostname;
const isFileProtocol = window.location.protocol === "file:";
const isLoopbackHost = ["127.0.0.1", "localhost"].includes(runtimeHost);
const localBase = "http://localhost:5000/api";
const remoteBase = "https://h2opsbackend.onrender.com/api";
const API = {
  base: isFileProtocol || isLoopbackHost ? localBase : remoteBase,
  endpoints: {
    login: "/auth/login",
    register: "/auth/register",
    stats: "/dashboard/stats",
    logs: "/logs",
    incidents: "/incidents",
    datasheets: "/datasheets",
    users: "/auth/users",
    sop: "/sop",
  },
};

console.info(`[H2Ops] Using API base: ${API.base}`);

const safeParse = (value, fallback = null) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const state = {
  accessToken: localStorage.getItem("token") || "",
  refreshToken: localStorage.getItem("refreshToken") || "",
  user: safeParse(localStorage.getItem("user")),
  dashboard: null,
  logs: [],
  incidents: [],
  datasheetRecords: [],
  sops: [],
  activeSopId: null,
  sopSearch: "",
  sopChecklist: false,
  plants: safeParse(localStorage.getItem("plants"), []),
  selectedPlant: localStorage.getItem("selectedPlant") || "",
  activeTab: "dash",
};

const persistPlants = () => localStorage.setItem("plants", JSON.stringify(state.plants || []));
const qs = (selector, parent = document) => parent.querySelector(selector);
const qsa = (selector, parent = document) => Array.from(parent.querySelectorAll(selector));
const escapeHtml = (value = "") =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
const toast = (message) => window.alert(message);

async function api(path, options = {}) {
  const url = path.startsWith("http") ? path : `${API.base}${path}`;
  const headers = { ...(options.headers || {}) };
  let body = options.body;

  if (state.accessToken) headers.Authorization = `Bearer ${state.accessToken}`;
  const isFormData = body instanceof FormData;
  if (!isFormData && body && typeof body !== "string") {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(body);
  }

  const config = {
    method: options.method || "GET",
    headers,
  };
  if (body !== undefined) config.body = body;
  const usedAuth = Boolean(headers.Authorization);

  const response = await fetch(url, config);
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errorPayload = await response.json();
      message = errorPayload.message || message;
    } catch {
      // ignore JSON parse errors
    }
    if (response.status === 401 && usedAuth) {
      handleUnauthorized(message);
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function storeSession(payload = {}) {
  state.accessToken = payload.token || payload.accessToken || "";
  state.refreshToken = payload.refreshToken || "";
  state.user = payload.user || null;

  localStorage.setItem("token", state.accessToken);
  localStorage.setItem("refreshToken", state.refreshToken);
  if (state.user) {
    localStorage.setItem("user", JSON.stringify(state.user));
  } else {
    localStorage.removeItem("user");
  }
}

function clearSession() {
  state.accessToken = "";
  state.refreshToken = "";
  state.user = null;
  state.dashboard = null;
  state.logs = [];
  state.incidents = [];
  state.datasheetRecords = [];
  state.sops = [];
  state.activeSopId = null;
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
}

function handleUnauthorized(message) {
  if (!state.accessToken) return;
  logout();
  setAuthMessage("#loginMsg", message || "Session expired. Please sign in again.");
}

function setAuthMessage(selector, message) {
  const el = qs(selector);
  if (el) el.textContent = message || "";
}

function clearAuthMessages() {
  setAuthMessage("#loginMsg", "");
  setAuthMessage("#registerMsg", "");
}

function toggleAuthView(view) {
  const loginForm = qs("#loginForm");
  const registerForm = qs("#registerForm");
  if (!loginForm || !registerForm) return;
  const showLogin = view !== "register";
  loginForm.style.display = showLogin ? "block" : "none";
  registerForm.style.display = showLogin ? "none" : "block";
}

function showLoginShell(view = "login") {
  toggleAuthView(view);
  const auth = qs("#auth");
  const header = qs("header");
  const main = qs("main");
  if (auth) auth.style.display = "block";
  if (header) {
    header.hidden = true;
    header.style.display = "none";
  }
  if (main) {
    main.hidden = true;
    main.style.display = "none";
  }
}

function showAppShell() {
  const auth = qs("#auth");
  const header = qs("header");
  const main = qs("main");
  if (auth) auth.style.display = "none";
  if (header) {
    header.hidden = false;
    header.style.display = "flex";
  }
  if (main) {
    main.hidden = false;
    main.style.display = "block";
  }
}

function logout() {
  clearSession();
  clearAuthMessages();
  qs("#loginForm")?.reset();
  qs("#registerForm")?.reset();
  showLoginShell("login");
}

async function handleLogin(event) {
  event.preventDefault();
  clearAuthMessages();
  const username = qs("#loginUser")?.value.trim();
  const password = qs("#loginPass")?.value;
  if (!username || !password) {
    setAuthMessage("#loginMsg", "Enter username and password.");
    return;
  }
  const button = qs("#loginBtn");
  if (button) button.disabled = true;

  try {
    const data = await api(API.endpoints.login, {
      method: "POST",
      body: { username, password },
    });
    storeSession({ token: data.token, user: { username: data.username } });
    renderUser();
    showAppShell();
    await hydrateApp();
  } catch (err) {
    console.error(err);
    setAuthMessage("#loginMsg", err.message || "Login failed");
  } finally {
    if (button) button.disabled = false;
  }
}

async function handleRegister(event) {
  event.preventDefault();
  clearAuthMessages();
  const username = qs("#registerUser")?.value.trim();
  const password = qs("#registerPass")?.value;
  const confirmPassword = qs("#registerConfirm")?.value;
  if (!username || !password) {
    setAuthMessage("#registerMsg", "Username and password required.");
    return;
  }
  if (password !== confirmPassword) {
    setAuthMessage("#registerMsg", "Passwords do not match.");
    return;
  }
  const button = qs("#registerBtn");
  if (button) button.disabled = true;

  try {
    await api(API.endpoints.register, {
      method: "POST",
      body: { username, password },
    });
    setAuthMessage("#loginMsg", "Account created. Sign in now.");
    toggleAuthView("login");
    qs("#registerForm")?.reset();
  } catch (err) {
    console.error(err);
    setAuthMessage("#registerMsg", err.message || "Registration failed");
  } finally {
    if (button) button.disabled = false;
  }
}

async function hydrateApp() {
  await Promise.allSettled([
    loadDashboardStats(),
    loadLogs(),
    loadIncidents(),
    loadDatasheets(),
    loadSops(),
  ]);
  renderUser();
  renderPlants();
}

async function loadDashboardStats() {
  try {
    const stats = await api(API.endpoints.stats);
    state.dashboard = stats;
    renderDashboards();
  } catch (err) {
    console.error("Failed to load stats", err);
  }
}

const formatMetricValue = (metric) => {
  if (!metric || metric.value === undefined || metric.value === null) return "—";
  return metric.unit ? `${metric.value} ${metric.unit}` : metric.value;
};

const formatDateTime = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

function renderDashboards() {
  const stats = state.dashboard;
  if (!stats) return;
  const setText = (selector, value) => {
    const el = qs(selector);
    if (el) el.textContent = value;
  };

  setText("#kpiFilNTU", formatMetricValue(stats.filteredTurbidity));
  setText("#kpiFilNote", stats.filteredTurbidity?.status || "target ≤ 0.2 NTU");
  setText("#kpiCl2", formatMetricValue(stats.freeChlorine));
  setText("#kpiCT", formatMetricValue(stats.ctValue));
  setText("#kpiCTFlag", stats.chemicalStatus || "Stable");

  const logsContainer = qs("#dashLogs");
  if (logsContainer) {
    logsContainer.innerHTML = (stats.recentLogs || [])
      .map(
        (log) => `
          <div class="dash-row">
            <div class="row" style="justify-content:space-between">
              <strong>${escapeHtml(log.parameter || log.notes || "Entry")}</strong>
              <span class="help">${formatDateTime(log.timestamp)}</span>
            </div>
            <div>${escapeHtml(log.value ?? "")} ${escapeHtml(log.unit || "")}</div>
            <div class="help">${escapeHtml(log.notes || "")}</div>
          </div>
        `
      )
      .join("") || '<div class="empty">No logs yet</div>';
  }

  const incContainer = qs("#dashInc");
  if (incContainer) {
    incContainer.innerHTML = (stats.openIncidentDetails || [])
      .map(
        (inc) => `
          <div class="dash-row">
            <div class="row" style="justify-content:space-between">
              <strong>${escapeHtml(inc.title)}</strong>
              <span class="sev-pill sev-${(inc.severity || "low").toLowerCase()}">${escapeHtml(
          inc.severity || ""
        )}</span>
            </div>
            <div class="help">${escapeHtml(inc.status || "Open")} • ${formatDateTime(inc.timestamp)}</div>
          </div>
        `
      )
      .join("") || '<div class="empty">No incidents open</div>';
  }
}

async function loadLogs() {
  try {
    const data = await api(API.endpoints.logs);
    state.logs = Array.isArray(data) ? data : [];
    renderLogs();
  } catch (err) {
    console.error("Failed to load logs", err);
  }
}

function renderLogs() {
  const container = qs("#logTable");
  if (!container) return;
  if (!state.logs.length) {
    container.innerHTML = '<div class="empty">No logs yet</div>';
    return;
  }
  container.innerHTML = state.logs
    .map(
      (log) => `
        <div class="log-card">
          <div class="row" style="justify-content:space-between">
            <strong>${escapeHtml(log.parameter || log.notes || "Entry")}</strong>
            <span class="help">${formatDateTime(log.timestamp)}</span>
          </div>
          <div class="help">${escapeHtml(log.plant || "All Plants")}</div>
          <div>${escapeHtml(log.value ?? "")} ${escapeHtml(log.unit || "")}</div>
          <div class="help">${escapeHtml(log.notes || "")}</div>
          <div class="help">Operator: ${escapeHtml(log.operator || "")}</div>
        </div>
      `
    )
    .join("");
}

async function handleAddLog() {
  const noteInput = qs("#logText");
  const operatorInput = qs("#operator");
  if (!noteInput) return;
  const text = noteInput.value.trim();
  if (!text) {
    toast("Enter a log note first.");
    return;
  }
  const button = qs("#btnAddLog");
  if (button) button.disabled = true;

  try {
    const payload = {
      notes: text,
      text,
      operator: operatorInput?.value?.trim() || state.user?.username || "Operator",
      plant: state.selectedPlant,
      plantType: qs("#plantType")?.value || "",
    };
    const created = await api(API.endpoints.logs, { method: "POST", body: payload });
    state.logs.unshift(created);
    renderLogs();
    noteInput.value = "";
  } catch (err) {
    toast(err.message || "Failed to add log");
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadIncidents() {
  try {
    const data = await api(API.endpoints.incidents);
    state.incidents = Array.isArray(data) ? data : [];
    renderIncidents();
  } catch (err) {
    console.error("Failed to load incidents", err);
  }
}

function renderIncidents() {
  const container = qs("#incList");
  if (!container) return;
  if (!state.incidents.length) {
    container.innerHTML = '<div class="empty">No incidents yet</div>';
    return;
  }
  container.innerHTML = state.incidents
    .map(
      (inc) => `
        <div class="incident-card">
          <div class="row" style="justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
              <strong>${escapeHtml(inc.title)}</strong>
              <div class="help">${escapeHtml(inc.type || "")}</div>
            </div>
            <span class="sev-pill sev-${(inc.severity || "low").toLowerCase()}">${escapeHtml(
        inc.severity || "Low"
      )}</span>
          </div>
          <div class="help">${escapeHtml(inc.status || "Open")} • ${formatDateTime(inc.timestamp)}</div>
          <p>${escapeHtml(inc.description || "")}</p>
          <p class="help">Action: ${escapeHtml(inc.action || "")}</p>
        </div>
      `
    )
    .join("");
}

async function handleAddIncident() {
  const title = qs("#inc_title")?.value.trim();
  const type = qs("#inc_type")?.value;
  const severity = qs("#inc_sev")?.value;
  const description = qs("#inc_desc")?.value.trim();
  const action = qs("#inc_action")?.value.trim();
  if (!title) {
    toast("Add a title before saving the incident.");
    return;
  }
  if (!type) {
    toast("Select an incident type.");
    return;
  }
  const button = qs("#btnAddIncident");
  if (button) button.disabled = true;

  try {
    const payload = {
      title,
      type,
      severity,
      description,
      action,
      plant: state.selectedPlant,
      operator: state.user?.username || "Operator",
    };
    const created = await api(API.endpoints.incidents, { method: "POST", body: payload });
    state.incidents.unshift(created);
    renderIncidents();
    qs("#inc_title").value = "";
    qs("#inc_desc").value = "";
    qs("#inc_action").value = "";
  } catch (err) {
    toast(err.message || "Failed to add incident");
  } finally {
    if (button) button.disabled = false;
  }
}

const serializeDatasheetForm = () => {
  const panel = qs("#panel-datasheet");
  if (!panel) return {};
  const values = {};
  panel.querySelectorAll("input, textarea, select").forEach((input) => {
    if (!input.id || input.id === "plantPicker" || input.id === "plantType") return;
    if (input.type === "checkbox") {
      values[input.id] = input.checked;
    } else {
      values[input.id] = input.value;
    }
  });
  return values;
};

function clearDatasheetForm() {
  const panel = qs("#panel-datasheet");
  if (!panel) return;
  panel.querySelectorAll("input, textarea").forEach((input) => {
    if (input.type === "checkbox") {
      input.checked = false;
    } else {
      input.value = "";
    }
  });
  panel.querySelectorAll("select").forEach((select) => {
    if (select.id === "plantPicker" || select.id === "plantType") return;
    select.selectedIndex = 0;
  });
}

const applyDatasheetRecord = (record) => {
  const panel = qs("#panel-datasheet");
  if (!panel || !record) return;
  Object.entries(record.fields || {}).forEach(([key, value]) => {
    const input = panel.querySelector(`#${key}`);
    if (!input) return;
    if (input.type === "checkbox") {
      input.checked = Boolean(value);
    } else {
      input.value = value ?? "";
    }
  });
};

async function handleSaveDatasheet() {
  const fields = serializeDatasheetForm();
  if (!Object.keys(fields).length) {
    toast("Fill out the form before saving.");
    return;
  }
  const button = qs("#btnDSSave");
  if (button) button.disabled = true;

  try {
    const payload = {
      plant: state.selectedPlant,
      plantType: qs("#plantType")?.value || "",
      date: fields.ds_date || new Date().toISOString(),
      fields,
    };
    const created = await api(API.endpoints.datasheets, { method: "POST", body: payload });
    state.datasheetRecords.unshift(created);
    renderDatasheetRecords();
    toast("Datasheet saved.");
  } catch (err) {
    toast(err.message || "Failed to save datasheet");
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadDatasheets() {
  try {
    const plantQuery = state.selectedPlant ? `?plant=${encodeURIComponent(state.selectedPlant)}` : "";
    const records = await api(`${API.endpoints.datasheets}${plantQuery}`);
    state.datasheetRecords = Array.isArray(records) ? records : [];
    renderDatasheetRecords();
  } catch (err) {
    console.error("Failed to load datasheets", err);
  }
}

function renderDatasheetRecords() {
  const container = qs("#dsRecords");
  if (!container) return;
  if (!state.datasheetRecords.length) {
    container.innerHTML = '<div class="empty">No records saved yet</div>';
    return;
  }
  container.innerHTML = state.datasheetRecords
    .map(
      (record) => `
        <div class="ds-record" data-id="${record.id}">
          <div class="row" style="justify-content:space-between;gap:12px">
            <div>
              <strong>${escapeHtml(record.summary?.location || record.plant || "Record")}</strong>
              <div class="help">${escapeHtml(record.summary?.date || "")}</div>
            </div>
            <button class="secondary" data-role="load-ds" data-id="${record.id}">Load</button>
          </div>
          <div class="help">Visited by: ${escapeHtml(record.summary?.visitedBy || "-")}</div>
        </div>
      `
    )
    .join("");
}

function handleDatasheetList(event) {
  const button = event.target.closest("[data-role='load-ds']");
  if (!button) return;
  const record = state.datasheetRecords.find((item) => item.id === button.dataset.id);
  if (record) {
    applyDatasheetRecord(record);
    toast("Record loaded into the form.");
  }
}

async function loadSops() {
  try {
    const plantQuery = state.selectedPlant ? `?plant=${encodeURIComponent(state.selectedPlant)}` : "";
    const data = await api(`${API.endpoints.sop}${plantQuery}`);
    state.sops = Array.isArray(data) ? data : [];
    renderSopList();
  } catch (err) {
    console.error("Failed to load SOPs", err);
  }
}

function renderSopList() {
  const list = qs("#sopList");
  if (!list) return;
  const term = state.sopSearch.toLowerCase();
  const filtered = state.sops.filter((sop) => {
    const title = sop.title?.toLowerCase() || "";
    const steps = Array.isArray(sop.steps) ? sop.steps.join(" ").toLowerCase() : "";
    return title.includes(term) || steps.includes(term);
  });
  if (!filtered.length) {
    list.innerHTML = '<div class="empty">No SOPs yet</div>';
    return;
  }
  list.innerHTML = filtered
    .map((sop) => {
      const stepsMarkup = (sop.steps || [])
        .map((step) => {
          if (state.sopChecklist) {
            return `
              <label class="sop-step">
                <input type="checkbox"> <span>${escapeHtml(step)}</span>
              </label>
            `;
          }
          return `<li>${escapeHtml(step)}</li>`;
        })
        .join("");
      return `
        <article class="sop-card" data-id="${sop.id}">
          <div class="row" style="justify-content:space-between;gap:8px">
            <div>
              <strong>${escapeHtml(sop.title)}</strong>
              <div class="help">${escapeHtml(sop.plant || "All plants")}</div>
            </div>
            <div class="row" style="gap:6px">
              <button class="secondary" data-role="edit-sop" data-id="${sop.id}">Edit</button>
              <button class="secondary" data-role="delete-sop" data-id="${sop.id}" style="color:#b91c1c;border-color:#b91c1c">Delete</button>
            </div>
          </div>
          ${state.sopChecklist ? stepsMarkup : `<ol>${stepsMarkup}</ol>`}
        </article>
      `;
    })
    .join("");
}

function populateSopForm(sop) {
  state.activeSopId = sop?.id || null;
  const titleInput = qs("#sopTitle");
  const stepsInput = qs("#sopSteps");
  if (titleInput) titleInput.value = sop?.title || "";
  if (stepsInput) stepsInput.value = Array.isArray(sop?.steps) ? sop.steps.join("\n") : "";
}

async function handleSaveSop() {
  const titleInput = qs("#sopTitle");
  const stepsInput = qs("#sopSteps");
  if (!titleInput || !stepsInput) return;
  const title = titleInput.value.trim();
  const steps = stepsInput.value.trim();
  if (!title) {
    toast("Add a title before saving the SOP.");
    return;
  }
  if (!steps) {
    toast("Add at least one step.");
    return;
  }

  const payload = {
    title,
    steps,
    plant: state.selectedPlant,
  };
  const isEdit = Boolean(state.activeSopId);
  const path = isEdit ? `${API.endpoints.sop}/${state.activeSopId}` : API.endpoints.sop;

  try {
    await api(path, {
      method: isEdit ? "PUT" : "POST",
      body: payload,
    });
    await loadSops();
    populateSopForm(null);
    toast("SOP saved.");
  } catch (err) {
    toast(err.message || "Failed to save SOP");
  }
}

async function handleDeleteSop(id) {
  if (!id) return;
  const confirmed = window.confirm("Delete this SOP?");
  if (!confirmed) return;
  try {
    await api(`${API.endpoints.sop}/${id}`, { method: "DELETE" });
    if (state.activeSopId === id) populateSopForm(null);
    await loadSops();
  } catch (err) {
    toast(err.message || "Failed to delete SOP");
  }
}

function handleSopList(event) {
  const button = event.target.closest("[data-role]");
  if (!button) return;
  const id = button.dataset.id;
  if (button.dataset.role === "edit-sop") {
    const sop = state.sops.find((entry) => entry.id === id);
    populateSopForm(sop || null);
    return;
  }
  if (button.dataset.role === "delete-sop") {
    handleDeleteSop(id);
  }
}

function handleClearSop() {
  populateSopForm(null);
}

function setTab(tab) {
  state.activeTab = tab;
  qsa(".panel").forEach((panel) => {
    panel.hidden = panel.id !== `panel-${tab}`;
  });
  qsa(".tab").forEach((button) => {
    button.setAttribute("aria-selected", button.dataset.tab === tab);
  });
}

function selectPlant(id) {
  state.selectedPlant = id;
  localStorage.setItem("selectedPlant", id || "");
  renderPlants();
  hydrateApp();
}

function renderPlants() {
  state.plants = Array.isArray(state.plants) ? state.plants : [];
  const picker = qs("#plantPicker");
  if (picker) {
    const options = state.plants.map((plant) => `<option value="${plant.id}">${escapeHtml(plant.name)}</option>`);
    picker.innerHTML = '<option value="">All Plants</option>' + options.join("");
    picker.value = state.selectedPlant || "";
  }
  const plantLabel = qs("#dsPlantLabel");
  if (plantLabel) {
    const selected = state.plants.find((plant) => plant.id === state.selectedPlant);
    plantLabel.textContent = selected?.name || "All";
  }
  const typeLabel = qs("#dsTypeLabel");
  if (typeLabel) typeLabel.textContent = qs("#plantType")?.value || "WTP";
}

function handleAddPlant() {
  const name = window.prompt("Plant name?");
  if (!name) return;
  const id = `plant-${Date.now()}`;
  state.plants.push({ id, name });
  persistPlants();
  selectPlant(id);
}

function handleDeletePlant() {
  if (!state.selectedPlant) {
    toast("Select a plant first.");
    return;
  }
  const confirmed = window.confirm("Delete this plant and its saved filters?");
  if (!confirmed) return;
  state.plants = state.plants.filter((plant) => plant.id !== state.selectedPlant);
  persistPlants();
  selectPlant("");
}

function handleResetPlant() {
  selectPlant("");
}

function renderUser() {
  const badge = qs("#userBadge");
  const label = state.user?.name || state.user?.username || "Operator";
  if (badge) badge.textContent = label;
  const operatorInput = qs("#operator");
  if (operatorInput && !operatorInput.value) operatorInput.value = label;
}

function startClock() {
  const el = qs("#clock");
  if (!el) return;
  const tick = () => {
    el.textContent = new Date().toLocaleTimeString();
  };
  tick();
  setInterval(tick, 1000);
}

function exportTable(headers, rows, filename) {
  const htmlRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell ?? "")}</td>`).join("")}</tr>`)
    .join("");
  const table = `
    <table>
      <thead><tr>${headers.map((head) => `<th>${escapeHtml(head)}</th>`).join("")}</tr></thead>
      <tbody>${htmlRows}</tbody>
    </table>
  `;
  tableDLxls(table, filename);
}

function exportLogsXLS() {
  if (!state.logs.length) {
    toast("No logs to export.");
    return;
  }
  exportTable(
    ["Plant", "Operator", "Parameter", "Value", "Unit", "Status", "Timestamp"],
    state.logs.map((log) => [
      log.plant || "",
      log.operator || "",
      log.parameter || log.notes || "",
      log.value ?? "",
      log.unit || "",
      log.status || "",
      formatDateTime(log.timestamp),
    ]),
    "logs.xls"
  );
}

function exportIncidentsXLS() {
  if (!state.incidents.length) {
    toast("No incidents to export.");
    return;
  }
  exportTable(
    ["Title", "Severity", "Status", "Description", "Action", "Timestamp"],
    state.incidents.map((inc) => [
      inc.title || "",
      inc.severity || "",
      inc.status || "",
      inc.description || "",
      inc.action || "",
      formatDateTime(inc.timestamp),
    ]),
    "incidents.xls"
  );
}

function exportAllXLS() {
  exportTable(
    ["Section", "Title", "Details", "Timestamp"],
    [
      ...state.logs.map((log) => [
        "Log",
        log.parameter || log.notes || "Entry",
        `${log.value ?? ""} ${log.unit || ""}`,
        formatDateTime(log.timestamp),
      ]),
      ...state.incidents.map((inc) => [
        "Incident",
        inc.title,
        `${inc.severity} - ${inc.status}`,
        formatDateTime(inc.timestamp),
      ]),
    ],
    "h2ops-export.xls"
  );
}

function exportSopsXLS() {
  if (!state.sops.length) {
    toast("No SOPs to export.");
    return;
  }
  exportTable(
    ["Title", "Plant", "Steps"],
    state.sops.map((sop) => [sop.title, sop.plant || "All", (sop.steps || []).join(" | ")]),
    "sops.xls"
  );
}

function tableDLxls(tableMarkup, filename) {
  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <style>
          table{border-collapse:collapse;font-family:Inter,Arial;font-size:12px}
          td,th{border:1px solid #d1d5db;padding:4px 6px}
        </style>
      </head>
      <body>${tableMarkup}</body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function togglePasswordVisibility(event) {
  event.preventDefault();
  const input = qs("#loginPass");
  if (!input) return;
  const nextType = input.type === "password" ? "text" : "password";
  input.type = nextType;
  event.currentTarget.textContent = nextType === "password" ? "Show" : "Hide";
}

function setupEventListeners() {
  qs("#loginForm")?.addEventListener("submit", handleLogin);
  qs("#registerForm")?.addEventListener("submit", handleRegister);
  qs("#btnLogout")?.addEventListener("click", logout);
  qs("#togglePw")?.addEventListener("click", togglePasswordVisibility);
  qs("#goRegister")?.addEventListener("click", () => {
    clearAuthMessages();
    toggleAuthView("register");
  });
  qs("#backToLogin")?.addEventListener("click", () => {
    clearAuthMessages();
    toggleAuthView("login");
  });
  qsa(".tab").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
  qs("#btnAddLog")?.addEventListener("click", handleAddLog);
  qs("#btnAddIncident")?.addEventListener("click", handleAddIncident);
  qs("#btnDSSave")?.addEventListener("click", handleSaveDatasheet);
  qs("#btnDSNew")?.addEventListener("click", () => {
    clearDatasheetForm();
    toast("Datasheet form cleared.");
  });
  qs("#dsRecords")?.addEventListener("click", handleDatasheetList);
  qs("#btnAddPlant")?.addEventListener("click", handleAddPlant);
  qs("#btnDeletePlant")?.addEventListener("click", handleDeletePlant);
  qs("#btnResetPlant")?.addEventListener("click", handleResetPlant);
  qs("#plantPicker")?.addEventListener("change", (event) => selectPlant(event.target.value));
  qs("#plantType")?.addEventListener("change", renderPlants);
  qs("#btnSaveSOP")?.addEventListener("click", handleSaveSop);
  qs("#btnClearSOP")?.addEventListener("click", handleClearSop);
  qs("#btnExportSOPXLS")?.addEventListener("click", exportSopsXLS);
  qs("#btnExportLogsXLS")?.addEventListener("click", exportLogsXLS);
  qs("#btnExportIncXLS")?.addEventListener("click", exportIncidentsXLS);
  qs("#btnExportAllXLS")?.addEventListener("click", exportAllXLS);
  qs("#sopList")?.addEventListener("click", handleSopList);
  qs("#sopSearch")?.addEventListener("input", (event) => {
    state.sopSearch = event.target.value;
    renderSopList();
  });
  qs("#sopChecklistMode")?.addEventListener("change", (event) => {
    state.sopChecklist = event.target.checked;
    renderSopList();
  });
}

async function init() {
  setupEventListeners();
  startClock();
  if (state.accessToken) {
    showAppShell();
    try {
      await hydrateApp();
    } catch (err) {
      console.error("Failed to start app", err);
      toast("Session expired, please sign in again.");
      logout();
    }
  } else {
    showLoginShell("login");
  }
}

document.addEventListener("DOMContentLoaded", init);
