/*******************************
 * Contact Manager – code.js (fixed)
 * - Prevents duplicate/infinite tiles while scrolling
 * - Auto-refreshes tile grid after Add / Update / Delete
 * - Uses IntersectionObserver for robust infinite scroll
 * - Dedupes by contact id (and fallback hash) to avoid repeats if API ignores offset
 * - Shows 6 tiles by default; shows button when total >= 7
 * - "Show More" expands to all; "Show Less" collapses back to 6
 * - Search: partial client-side filter (name/phone/email)
 * - Edit: nice modal dialog instead of prompt()
 *******************************/

const urlBase = 'http://poosd24.live/API';
const extension = 'php';

/* -----------------------------
   SESSION (fixed)
------------------------------*/
let userId = 0;
let firstName = "";
let lastName = "";

// Save each cookie separately
function saveCookie() {
  const minutes = 20;
  const date = new Date();
  date.setTime(date.getTime() + (minutes * 60 * 1000));
  const exp = ";expires=" + date.toUTCString() + ";path=/";

  document.cookie = "firstName=" + encodeURIComponent(firstName) + exp;
  document.cookie = "lastName=" + encodeURIComponent(lastName) + exp;
  document.cookie = "userId=" + encodeURIComponent(userId) + exp;
}

function readCookie() {
  userId = -1;
  firstName = "";
  lastName = "";

  const raw = document.cookie || "";
  const parts = raw.split(";");
  for (let i = 0; i < parts.length; i++) {
    const kv = parts[i].trim().split("=");
    const k = kv[0];
    const v = decodeURIComponent(kv.slice(1).join("=") || "");
    if (k === "firstName") firstName = v;
    else if (k === "lastName") lastName = v;
    else if (k === "userId") {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) userId = n;
    }
  }

  // Only redirect if not logged in AND not already on index.html
  const path = (location.pathname || "").toLowerCase();
  const onIndex = path.endsWith("/index.html") || path.endsWith("/") || path.endsWith("/register.html");
  if ((isNaN(userId) || userId < 0) && !onIndex) {
    window.location.replace("index.html");
  }
}

function doLogout() {
  userId = 0; firstName = ""; lastName = "";
  const exp = "; expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  document.cookie = "firstName=" + exp;
  document.cookie = "lastName=" + exp;
  document.cookie = "userId=" + exp;
  window.location.href = "index.html";
}

/* -----------------------------
   AUTH
------------------------------*/

window.addEventListener("DOMContentLoaded", () => {
  const map = {
    loginName: "logincontainer",
    password: "pwordcontainer"
  };

  Object.entries(map).forEach(([inputId, warnKey]) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("input", () => hideWarning(warnKey));
  });
});
function doLogin() {
  userId = 0;
  firstName = "";
  lastName = "";

  const login = document.getElementById("loginName").value;
  const password = document.getElementById("password").value;

  const loginResult = document.getElementById("loginResult");
  if (loginResult) loginResult.innerHTML = "";

  hideWarning('logincontainer');
  hideWarning('pwordcontainer');

  if (login === "" || password === "") {
    if (loginResult) loginResult.innerHTML = "Please enter both username and password";

    if (login === "") {
      showWarning('logincontainer');
    }

    if (password === "") {
      showWarning('pwordcontainer');
    }

    return;
  }


  const payload = { login, password };
  const jsonPayload = JSON.stringify(payload);
  const url = `${urlBase}/Login.${extension}`;

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");

  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return;


    if (this.status !== 200) {
      if (loginResult) loginResult.innerHTML = "Login failed (" + this.status + ").";
      return;
    }


    let obj = {};
    try {
      obj = JSON.parse(xhr.responseText);
    } catch (e) {
      if (loginResult) loginResult.innerHTML = "Error parsing server response";
      return;
    }

    const res = obj.results || obj;

    if (res.error) {
      if (loginResult) loginResult.innerHTML = "Username or Password is incorrect";
      return;
    }

    userId = parseInt(res.id ?? res.userId ?? -1);
    firstName = res.firstName ?? "";
    lastName = res.lastName ?? "";

    if (isNaN(userId) || userId < 1) {
      if (loginResult) loginResult.innerHTML = res.error || "User/Password combination incorrect";
      return;
    }

    saveCookie();
    window.location.href = "contacts.html";
  };

  xhr.onerror = function () {
    if (loginResult) loginResult.innerHTML = "Network error occurred";
  };

  xhr.send(jsonPayload);
}

window.addEventListener("DOMContentLoaded", () => {
  const map = {
    firstName: "firstname",
    lastName: "lastname",
    loginName: "login",
    loginPassword: "password"
  };

  Object.entries(map).forEach(([inputId, warnKey]) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("input", () => hideWarning(warnKey));
  });
});

function doRegister() {
  const out = document.getElementById("registerResult");
  if (out) out.innerHTML = "";

  const f = document.getElementById("firstName").value.trim();
  const l = document.getElementById("lastName").value.trim();
  const u = document.getElementById("loginName").value.trim();
  const p = document.getElementById("loginPassword").value;

  hideWarning('firstname');
  hideWarning('lastname');
  hideWarning('login');
  hideWarning('password');


  if (!f || !l || !u || !p) {
    if (out) out.innerHTML = "Please fill out all fields.";

    if (f === "") {
      showWarning('firstname');
    }

    if (l === "") {
      showWarning('lastname');
    }

    if (u === "") {
      showWarning('login');
    }

    if (p === "") {
      showWarning('password');
    }

    return;
  }


  //password requirement checker
  if (p.length < 8) {
    if (out) out.innerHTML = "Password must be 8 characters long";
    return;
  }

  // Check for at least one capital letter
  if (!/[A-Z]/.test(p)) {
    if (out) out.innerHTML = "Password must contain one capital letter";
    return;
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(p)) {
    if (out) out.innerHTML = "Password must contain one lowecase letter";
    return;
  }

  // Check for at least one number
  if (!/[0-9]/.test(p)) {
    if (out) out.innerHTML = "Password must contain one number";
    return;
  }

  // Check for at least one special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p)) {
    if (out) out.innerHTML = "Password must contain one special character";
    return;
  }


  const payload = { firstName: f, lastName: l, login: u, password: p };
  const url = `${urlBase}/Register.${extension}`;

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");

  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return;
    if (this.status == 500) {
      if (out) out.innerHTML = "Registration failed: Username taken.";
      return;
    }
    if (this.status !== 200) {
      if (out) out.innerHTML = "Registration failed (" + this.status + ").";
      return;
    }
    let obj = {};
    try { obj = JSON.parse(xhr.responseText); } catch (_) { }

    if (obj.error && obj.error !== "") {
      if (out) out.innerHTML = "Error: " + obj.error;
      return;
    }

    const res = obj.results || obj;
    userId = parseInt(res.userId ?? res.id ?? -1);
    firstName = res.firstName ?? f;
    lastName = res.lastName ?? l;

    saveCookie();
    window.location.href = "contacts.html";
  };
  xhr.send(JSON.stringify(payload));
}

/* -----------------------------
   HELPERS
------------------------------*/
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Escape for embedding inside single-quoted attribute in template
function jsSafe(s) {
  return String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// Very small stable hash for fallback dedupe when id is missing
function smallHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return String(h);
}

/* -----------------------------
   TILE GRID (Add / Search / Update / Delete)
------------------------------*/

// Pagination / state
let contactOffset = 0;
const pageSize = 20;
let isLoading = false;
let hasMore = true;
let lastQuery = "";
const renderedKeys = new Set(); // dedupe across pages

let io = null; // IntersectionObserver
let sentinelEl = null;

const VISIBLE_STEP = 6;
let visibleCount = VISIBLE_STEP;
let isExpanded = false;

let currentFilter = ""; // <-- partial search filter (client-side)

function gridEl() { return document.querySelector(".contact-grid"); }

function computeKey(c) {
  const id = c.ID ?? c.Id ?? c.id ?? c.contactId;
  if (id !== undefined && id !== null) return `id:${id}`;
  // fallback: hash of essential fields (prevents dupes if backend omits id)
  const fn = c.FirstName ?? c.firstName ?? "";
  const ln = c.LastName ?? c.lastName ?? "";
  const ph = c.Phone ?? c.phone ?? "";
  const em = c.Email ?? c.email ?? "";
  return `h:${smallHash(`${fn}|${ln}|${ph}|${em}`)}`;
}

function ensureSentinel() {
  let grid = gridEl();
  if (!grid) return;
  if (!sentinelEl) {
    sentinelEl = document.createElement("div");
    sentinelEl.className = "scroll-sentinel";
    sentinelEl.style.height = "1px";
    sentinelEl.style.width = "100%";
    grid.appendChild(sentinelEl);
  } else if (!grid.contains(sentinelEl)) {
    grid.appendChild(sentinelEl);
  }
}

function attachObserver() {
  detachObserver();
  ensureSentinel();
  if (!sentinelEl) return;

  io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        // load next page only if we actually have more to fetch
        if (!isLoading && hasMore) {
          fetchContacts(lastQuery, false);
        }
      }
    }
  }, { root: null, rootMargin: "200px", threshold: 0.01 });

  io.observe(sentinelEl);
}

function detachObserver() {
  if (io) {
    io.disconnect();
    io = null;
  }
}

function resetGrid() {
  const grid = gridEl();
  if (grid) grid.innerHTML = "";
  contactOffset = 0;
  isLoading = false;
  hasMore = true;
  renderedKeys.clear();
  sentinelEl = null;
}

/**
 * Show/hide cards based on currentFilter and visibleCount
 */
function applyFilterAndLimit() {
  const grid = gridEl();
  if (!grid) return;
  const q = currentFilter.toLowerCase();
  const cards = [...grid.querySelectorAll(".contact-card")];

  let shown = 0;
  for (const card of cards) {
    const name = (card.querySelector(".contact-name")?.textContent || "").toLowerCase();
    const phone = (card.querySelector(".contact-phone")?.textContent || "").toLowerCase();
    const email = (card.querySelector(".contact-email")?.textContent || "").toLowerCase();
    const match = !q || (name.includes(q) || phone.includes(q) || email.includes(q));

    if (match && shown < visibleCount) {
      card.style.display = "";
      shown++;
    } else if (match) {
      card.style.display = "none"; // hidden due to visible limit
    } else {
      card.style.display = "none"; // hidden due to filter not matching
    }
  }

  // Update Show More visibility/label based on total matching cards
  checkShowMore();
  updateShowMoreLabel();
}

/**
 * Fetch a page of contacts into the tile grid.
 * @param {string} query
 * @param {boolean} reset
 */
function fetchContacts(query = "", reset = false) {
  if (isLoading) return;
  if (reset) {
    lastQuery = query;
    resetGrid();
    // Reset toggle state
    isExpanded = false;
    visibleCount = VISIBLE_STEP;
    updateShowMoreLabel();
  }
  if (!hasMore) {
    applyFilterAndLimit();
    return;
  }

  isLoading = true;
  const payload = { search: lastQuery, userId: userId, offset: contactOffset, limit: pageSize };
  const url = `${urlBase}/SearchContacts.${extension}`;
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");

  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return;
    isLoading = false;
    if (this.status !== 200) { hasMore = false; checkShowMore(); return; }

    let obj = {};
    try { obj = JSON.parse(xhr.responseText); } catch (_) { }
    const results = Array.isArray(obj.results) ? obj.results : [];

    const added = renderContacts(results);

    if (results.length < pageSize || added === 0) { hasMore = false; }
    else { contactOffset += results.length; }

    attachObserver();
    checkShowMore(); // update button visibility
  };
  xhr.send(JSON.stringify(payload));
}

function renderContacts(results) {
  const grid = gridEl();
  if (!grid) return 0;

  let added = 0;
  for (const c of results) {
    const key = computeKey(c);
    if (renderedKeys.has(key)) continue; // skip duplicates
    renderedKeys.add(key);

    const id = c.ID ?? c.Id ?? c.id ?? c.contactId ?? null;
    const fn = c.FirstName ?? c.firstName ?? "";
    const ln = c.LastName ?? c.lastName ?? "";
    const ph = c.Phone ?? c.phone ?? "";
    const em = c.Email ?? c.email ?? "";

    const card = document.createElement("div");
    card.className = "contact-card";
    card.dataset.key = key;
    card.innerHTML = `
      <div class="contact-name">${escapeHtml(fn)} ${escapeHtml(ln)}</div>
      <div class="contact-phone">${escapeHtml(ph)}</div>
      <div class="contact-email">${escapeHtml(em)}</div>
      <div class="contact-actions">
        ${id !== null ? `
          <button class="update-btn" onclick="openEditModal(${id}, '${jsSafe(fn)}','${jsSafe(ln)}','${jsSafe(ph)}','${jsSafe(em)}')">Edit</button>
          <button class="delete-btn" onclick="openDeleteModal(${id})">Delete</button>
        ` : `<span class="contact-meta">No id</span>`}
      </div>
    `;
    // Insert before sentinel if present
    if (grid.lastElementChild && grid.lastElementChild.classList.contains("scroll-sentinel")) {
      grid.insertBefore(card, grid.lastElementChild);
    } else {
      grid.appendChild(card);
    }
    added++;
  }

  // Ensure sentinel exists at the end
  ensureSentinel();

  // Enforce current visibility and filter, update controls
  applyFilterAndLimit();

  return added;
}

/* -----------------------------
   EDIT MODAL (nicer than prompt)
------------------------------*/
function openEditModal(contactId, currFn = "", currLn = "", currPh = "", currEm = "") {
  closeEditModal(); // ensure single instance

  const overlay = document.createElement("div");
  overlay.id = "editOverlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", background: "rgba(0,0,0,0.55)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: "9999", backdropFilter: "blur(2px)"
  });

  const modal = document.createElement("div");
  Object.assign(modal.style, {
    width: "min(520px, 92vw)",
    background: "rgba(24,24,24,0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
    padding: "20px"
  });

  modal.innerHTML = `
    <h2 style="margin:0 0 12px; color:#f7d877; font-weight:700;">Edit Contact</h2>
    <div style="display:grid; gap:10px;">
      <input id="editFn" placeholder="First name" value="${escapeHtml(currFn)}" class="edit-input">
      <input id="editLn" placeholder="Last name"  value="${escapeHtml(currLn)}" class="edit-input">
      <input id="editPh" placeholder="Phone"       value="${escapeHtml(currPh)}" class="edit-input">
      <input id="editEm" placeholder="Email"       value="${escapeHtml(currEm)}" class="edit-input">
    </div>
    <div style="display:flex; gap:10px; margin-top:16px; justify-content:flex-end;">
      <button id="editCancel" class="btn-secondary">Cancel</button>
      <button id="editSave"   class="btn-primary">Save</button>
    </div>
  `;

  // lightweight input/button styling to match your theme
  const style = document.createElement("style");
  style.textContent = `
    #editOverlay .edit-input{
      padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.12);
      background:rgba(255,255,255,0.06); color:#fff; outline:none;
    }
    #editOverlay .edit-input:focus{ border-color:#f7d877; box-shadow:0 0 0 2px rgba(247,216,119,0.15); }
    #editOverlay .btn-primary{
      padding:10px 16px; border-radius:999px; border:0; cursor:pointer;
      background:linear-gradient(180deg,#ffd86a,#e6b84e); color:#2b2100; font-weight:700;
    }
    #editOverlay .btn-secondary{
      padding:10px 16px; border-radius:999px; border:0; cursor:pointer;
      background:rgba(255,255,255,0.12); color:#fff; font-weight:600;
    }
    #editOverlay .btn-secondary:hover{ background:rgba(255,255,255,0.18); }
  `;
  overlay.appendChild(style);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  ['editFn', 'editLn', 'editPh', 'editEm'].forEach(id => {
    const input = modal.querySelector('#' + id);
    if (!input) return;
    const warn = document.createElement('div');
    warn.className = 'modal-input-warning';
    warn.style.cssText = 'color:#f7d877; font-size:12px; margin-top:6px; display:none;';
    input.insertAdjacentElement('afterend', warn);
  });

  // add modal-specific styles onto the same <style> element we created earlier
  style.textContent += `
    #editOverlay .modal-input-warning{ color:#f7d877; font-size:12px; margin-top:6px; display:none; }
    #editOverlay .input-warn{ box-shadow:0 0 0 2px rgba(247,216,119,0.12); border-color:#f7d877 !important; }
  `;

  // --- helper functions scoped to this modal ---
  const modalFieldMap = { firstname: 'editFn', lastname: 'editLn', ph: 'editPh', email: 'editEm' };

  function showModalWarningKey(key, message) {
    const id = modalFieldMap[key] || key;
    const input = modal.querySelector('#' + id);
    if (!input) return;
    const warn = input.nextElementSibling;
    if (warn && warn.classList.contains('modal-input-warning')) {
      warn.textContent = message || 'Please complete this field.';
      warn.style.display = 'block';
      input.classList.add('input-warn');
    }
  }
  function hideModalWarningKey(key) {
    const id = modalFieldMap[key] || key;
    const input = modal.querySelector('#' + id);
    if (!input) return;
    const warn = input.nextElementSibling;
    if (warn && warn.classList.contains('modal-input-warning')) {
      warn.style.display = 'none';
      warn.textContent = '';
      input.classList.remove('input-warn');
    }
  }
  modal.querySelectorAll("#editFn, #editLn, #editPh, #editEm").forEach(input => {
    input.addEventListener("focus", () => {
      // Map the input id back to its warning key
      switch (input.id) {
        case "editFn": hideModalWarningKey("firstname"); break;
        case "editLn": hideModalWarningKey("lastname"); break;
        case "editPh": hideModalWarningKey("ph"); break;
        case "editEm": hideModalWarningKey("email"); break;
      }
    });
  });

  function save() {
    const fn = modal.querySelector("#editFn").value.trim();
    const ln = modal.querySelector("#editLn").value.trim();
    const ph = modal.querySelector("#editPh").value.trim();
    const em = modal.querySelector("#editEm").value.trim();

    // hide any previous modal warnings
    Object.keys(modalFieldMap).forEach(hideModalWarningKey);

    // required check (match addContact/doRegister logic if needed)
    if (!fn || !ln || !ph || !em) {
      if (!fn) showModalWarningKey('firstname', 'Please enter a first name.');
      if (!ln) showModalWarningKey('lastname', 'Please enter a last name.');
      if (!ph) showModalWarningKey('ph', 'Please enter a phone number.');
      if (!em) showModalWarningKey('email', 'Please enter an email.');
      return;
    }

    // email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      showModalWarningKey('email', 'Please enter a valid email.');
      return;
    }

    // phone validation
    const isValidFormat = /^\d{3}-\d{3}-\d{4}$/.test(ph) || /^\d{10}$/.test(ph);
    if (!isValidFormat) {
      showModalWarningKey('ph', 'Invalid phone number format (use 123-456-7890 or 1234567890).');
      return;
    }

    // all good — call update and close
    updateContact(contactId, fn, ln, ph, em);
    closeEditModal();
  }

  function cancel() { closeEditModal(); }

  document.getElementById("editSave").onclick = save;
  document.getElementById("editCancel").onclick = cancel;
  overlay.addEventListener("click", e => { if (e.target === overlay) cancel(); });
  document.addEventListener("keydown", escClose);

  function escClose(e) { if (e.key === "Escape") cancel(); }
  function closeEditModal() {
    const el = document.getElementById("editOverlay");
    if (el) {
      el.remove();
      document.removeEventListener("keydown", escClose);
    }
  }
}
function promptUpdateContact() { /* no-op: replaced by openEditModal */ }

/* -----------------------------
   Delete MODAL (nicer than prompt)
------------------------------*/
function openDeleteModal(contactId) {
  closeDeleteModal(); // ensure single instance

  const overlay = document.createElement("div");
  overlay.id = "deleteOverlay";
  Object.assign(overlay.style, {
    position: "fixed", inset: "0", background: "rgba(0,0,0,0.55)", display: "flex",
    alignItems: "center", justifyContent: "center", zIndex: "9999", backdropFilter: "blur(2px)"
  });

  const modal = document.createElement("div");
  Object.assign(modal.style, {
    width: "min(520px, 92vw)",
    background: "rgba(24,24,24,0.92)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "16px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
    padding: "20px"
  });

  modal.innerHTML = `
    <h2 style="margin:0 0 12px; color:#f7d877; font-weight:700;">Confirm Deletion</h2>
    <div style="display:grid; gap:10px;">
    </div>
    <div style="display:flex; gap:10px; margin-top:16px; justify-content:flex-end;">
      <button id="editConfirm"   class="btn-primary">Confirm</button>
      <button id="editCancel" class="btn-secondary">Cancel</button>
    </div>
  `;

  // lightweight input/button styling to match your theme
  const style = document.createElement("style");
  style.textContent = `
    #deleteOverlay .edit-input{
      padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.12);
      background:rgba(255,255,255,0.06); color:#fff; outline:none;
    }
    #deleteOverlay .edit-input:focus{ border-color:#f7d877; box-shadow:0 0 0 2px rgba(247,216,119,0.15); }
    #deleteOverlay .btn-primary{
      padding:10px 16px; border-radius:999px; border:0; cursor:pointer;
      background:linear-gradient(180deg,#ffd86a,#e6b84e); color:#2b2100; font-weight:700;
    }
    #deleteOverlay .btn-secondary{
      padding:10px 16px; border-radius:999px; border:0; cursor:pointer;
      background:rgba(255,255,255,0.12); color:#fff; font-weight:600;
    }
    #deleteOverlay .btn-secondary:hover{ background:rgba(255,255,255,0.18); }
  `;
  overlay.appendChild(style);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function cancel() { closeDeleteModal(); }

  document.getElementById("editConfirm").onclick = () => {
    deleteContact(contactId);
    closeDeleteModal();
  };
  document.getElementById("editCancel").onclick = cancel;
  overlay.addEventListener("click", e => { if (e.target === overlay) cancel(); });
  document.addEventListener("keydown", escClose);

  function escClose(e) { if (e.key === "Escape") cancel(); }
  function closeDeleteModal() {
    const el = document.getElementById("deleteOverlay");
    if (el) {
      el.remove();
      document.removeEventListener("keydown", escClose);
    }
  }
}

/* -----------------------------
   UPDATE / DELETE / ADD
------------------------------*/
function updateContact(contactId, first, last, phone, email) {
  const status = document.getElementById("contactSearchResult");
  if (!contactId) {
    if (status) status.innerHTML = "Missing contact id.";
    return;
  }

  const payload = {
    id: contactId,
    contactId: contactId,
    firstName: first,
    lastName: last,
    phone: phone,
    email: email,
    userId: userId
  };

  const url = `${urlBase}/UpdateContact.${extension}`;
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");

  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return;
    if (this.status !== 200) {
      if (status) status.innerHTML = "Update failed (" + this.status + ").";
      return;
    }
    let obj = {};
    try { obj = JSON.parse(xhr.responseText); } catch (_) { }

    if (obj.error && obj.error !== "") {
      if (status) status.innerHTML = "Error: " + obj.error;
      return;
    }

    if (status) status.innerHTML = "Contact updated.";
    // Refresh grid to reflect changes
    fetchContacts(lastQuery, true);
  };
  xhr.send(JSON.stringify(payload));
}

function deleteContact(contactId) {
  const status = document.getElementById("contactSearchResult");
  const id = parseInt(contactId);
  if (!id || isNaN(id)) {
    if (status) status.innerHTML = "Missing contact id.";
    return;
  }

  const payload = { id: id, contactId: id, userId: userId };
  const url = `${urlBase}/DeleteContact.${extension}`;

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");

  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return;
    if (this.status !== 200) {
      if (status) status.innerHTML = "Delete failed (" + this.status + ").";
      return;
    }
    let obj = {};
    try { obj = JSON.parse(xhr.responseText); } catch (_) { }

    if (obj.error && obj.error !== "") {
      if (status) status.innerHTML = "Error: " + obj.error;
      return;
    }

    if (status) status.innerHTML = "Contact deleted.";
    // Refresh grid and pull from page 0 again to keep it clean
    fetchContacts(lastQuery, true);
  };
  xhr.send(JSON.stringify(payload));
}

window.addEventListener("DOMContentLoaded", () => {
  const map = {
    firstNameText: "firstname",
    lastNameText: "lastname",
    phoneText: "ph",
    emailText: "email"
  };

  Object.entries(map).forEach(([inputId, warnKey]) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener("input", () => hideWarning(warnKey));
  });
});
function addContact() {
  const fEl = document.getElementById("firstNameText");
  const lEl = document.getElementById("lastNameText");
  const phEl = document.getElementById("phoneText");
  const emEl = document.getElementById("emailText");
  const out = document.getElementById("contactAddResult");

  const f = fEl?.value.trim() || "";
  const l = lEl?.value.trim() || "";
  const ph = phEl?.value.trim() || "";
  const em = emEl?.value.trim() || "";
  if (out) out.innerHTML = "";

  hideWarning('firstname');
  hideWarning('lastname');
  hideWarning('ph');
  hideWarning('email');


  if (!f || !l || !ph || !em) {
    if (out) out.innerHTML = "Please fill out all fields.";

    if (f === "") {
      showWarning('firstname');
    }

    if (l === "") {
      showWarning('lastname');
    }

    if (ph === "") {
      showWarning('ph');
    }

    if (em === "") {
      showWarning('email');
    }

    return;
  }

  // phone: either exactly 10 digits or all digits
  const isValidFormat = /^\d{3}-\d{3}-\d{4}$/.test(ph) || /^\d{10}$/.test(ph);
  if (!isValidFormat) {
    if (out) out.innerHTML = "Please enter a valid phone number.";
    showWarning('ph');
    return;
  }

  // email pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(em)) {
    if (out) out.innerHTML = "Please enter a valid email.";
    showWarning('email');
    return;
  }



  const payload = { firstName: f, lastName: l, phone: ph, email: em, userId: userId };
  const url = `${urlBase}/AddContact.${extension}`;

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");

  xhr.onreadystatechange = function () {
    if (this.readyState !== 4) return;
    if (this.status !== 200) {
      if (out) out.innerHTML = "Add failed (" + this.status + ").";
      return;
    }

    let obj = {};
    try { obj = JSON.parse(xhr.responseText); } catch (_) { }

    if (obj.error && obj.error !== "") {
      if (out) out.innerHTML = "Error: " + obj.error;
      return;
    }

    if (out) out.innerHTML = '<span style="color: #4CAF50;">Contact has been added</span>';

    // Clear form
    if (fEl) fEl.value = ""; if (lEl) lEl.value = "";
    if (phEl) phEl.value = ""; if (emEl) emEl.value = "";

    // Auto-refresh the tile grid from page 0 so the new contact appears without reloading
    fetchContacts(lastQuery, true);
  };
  xhr.send(JSON.stringify(payload));
}

/* -----------------------------
   SEARCH (client autofill + filter)
------------------------------*/

// Debounce helper
function debounce(fn, delay) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  }
}

function setupSearch() {
  const input = document.getElementById("searchText");
  const list = document.querySelector(".autofill-list");
  if (!input || !list) return;

  // Typing = live filter + (optional) backend search to refresh results
  input.addEventListener("input", debounce(function () {
    const q = this.value.trim();
    currentFilter = q;           // update client filter
    applyFilterAndLimit();       // instant partial filter

    if (!q) {
      list.innerHTML = "";
      // Reset grid to all contacts when clearing search
      fetchContacts("", true);
      return;
    }

    // Small server query (best effort) to surface top suggestions
    const payload = { search: q, userId: userId, limit: 5 };
    const url = `${urlBase}/SearchContacts.${extension}`;

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");


  }, 150));
}

/* -----------------------------
   SHOW MORE BUTTON (toggle)
------------------------------*/
function ensureShowMoreButton() {
  const btn = document.getElementById("showMoreBtn");
  if (!btn) return null;
  if (!btn.getAttribute("type")) btn.setAttribute("type", "button");
  btn.onclick = onShowMore;
  updateShowMoreLabel();
  return btn;
}

function onShowMore() {
  const grid = gridEl();
  const allCards = grid ? [...grid.querySelectorAll(".contact-card")] : [];
  // Count how many match the current filter
  const q = currentFilter.toLowerCase();
  const matches = allCards.filter(card => {
    const t = (card.textContent || "").toLowerCase();
    return !q || t.includes(q);
  });

  if (!isExpanded) {
    // Expand to show all matching
    visibleCount = matches.length;
    isExpanded = true;
  } else {
    // Collapse back to 6 of the matching
    visibleCount = VISIBLE_STEP;
    isExpanded = false;
  }

  applyFilterAndLimit();
  updateShowMoreLabel();
  checkShowMore();
}

function updateShowMoreLabel() {
  const btn = document.getElementById("showMoreBtn");
  if (!btn) return;
  btn.textContent = isExpanded ? "Show Less" : "Show More";
}

/**
 * Show the button whenever total MATCHING cards >= 7 (even if collapsed),
 * hide when fewer than 7 matching.
 */
function checkShowMore() {
  const grid = gridEl();
  const btn = document.getElementById("showMoreBtn");
  if (!grid || !btn) return;

  const q = currentFilter.toLowerCase();
  const matches = [...grid.querySelectorAll(".contact-card")].filter(card => {
    const t = (card.textContent || "").toLowerCase();
    return !q || t.includes(q);
  });

  btn.style.display = matches.length >= 7 ? "block" : "none";
}

function hideShowMore() {
  const btn = document.getElementById("showMoreBtn");
  if (btn) btn.style.display = "none";
}

document.addEventListener('DOMContentLoaded', function () {
  const togglePassword = document.getElementById('togglePassword');

  // Select the input field properly
  let passwordInput = document.getElementById('loginPassword'); // register page
  if (!passwordInput) {
    passwordInput = document.getElementById('password'); // login page input
  }

  if (!passwordInput || !togglePassword) return;

  // Initially hide the eye icon
  togglePassword.style.display = 'none';

  function handleEyeIcon() {
    if (passwordInput === document.activeElement || passwordInput.value !== '') {
      togglePassword.style.display = 'block';
    } else {
      togglePassword.style.display = 'none';
    }
  }

  passwordInput.addEventListener('focus', handleEyeIcon);
  passwordInput.addEventListener('blur', handleEyeIcon);
  passwordInput.addEventListener('input', handleEyeIcon);

  togglePassword.addEventListener('click', function () {
    const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
    passwordInput.setAttribute('type', type);
    togglePassword.classList.toggle('show-password');
  });
});


function showWarning(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const input = container.querySelector("input");
  container.classList.add("show-warning");
  input.classList.add("error");

  // Add SVG warning icon if not already present
  if (!container.querySelector(".warning-icon")) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("width", "20");
    svg.setAttribute("height", "20");
    svg.classList.add("warning-icon");

    // classic warning triangle with exclamation mark
    svg.innerHTML = `
      <svg id="Layer_1" data-name="Layer 1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 122.89 111.55"><defs><style>.cls-1{fill:#b71616;}.cls-2{fill:#e21b1b;fill-rule:evenodd;}.cls-3{fill:#fff;}</style></defs><title>red-alert</title><path class="cls-1" d="M2.35,84.43,45.29,10.2l.17-.27h0a22.92,22.92,0,0,1,7-7.23A17,17,0,0,1,61.58,0a16.78,16.78,0,0,1,9.11,2.69,22.79,22.79,0,0,1,7,7.26c.13.21.25.42.36.64l42.24,73.34.23.44h0a22.22,22.22,0,0,1,2.37,10.19,17.59,17.59,0,0,1-2.16,8.35,16,16,0,0,1-6.94,6.61l-.58.26a21.34,21.34,0,0,1-9.11,1.74v0H17.62c-.23,0-.44,0-.66,0a18.07,18.07,0,0,1-6.2-1.15A16.46,16.46,0,0,1,3,104.26a17.59,17.59,0,0,1-3-9.58,23,23,0,0,1,1.57-8.74,8.24,8.24,0,0,1,.77-1.51Z"/><path class="cls-2" d="M9,88.76l43.15-74.6c5.23-8.25,13.53-8.46,18.87,0l42.44,73.7c3.38,6.81,1.7,16-9.34,15.77H17.62c-7.27.18-12-6.19-8.64-14.87Z"/><path class="cls-3" d="M57.57,82.7a5.51,5.51,0,0,1,3.48-1.58,5.75,5.75,0,0,1,2.4.35,5.82,5.82,0,0,1,2,1.31,5.53,5.53,0,0,1,1.62,3.55,6.05,6.05,0,0,1-.08,1.4,5.54,5.54,0,0,1-5.64,4.6,5.67,5.67,0,0,1-2.27-.52,5.56,5.56,0,0,1-2.82-2.94,5.65,5.65,0,0,1-.35-1.27,5.83,5.83,0,0,1-.06-1.31h0a6.19,6.19,0,0,1,.57-2,4.57,4.57,0,0,1,1.13-1.56Zm8.16-10.24c-.2,4.79-8.31,4.8-8.5,0-.82-8.21-2.92-29.39-2.85-37.1.07-2.38,2-3.79,4.56-4.33a12.83,12.83,0,0,1,5,0c2.61.56,4.65,2,4.65,4.44v.24L65.73,72.46Z"/></svg>
    `;

    container.appendChild(svg);
  }
}

function hideWarning(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const input = container.querySelector("input");
  container.classList.remove("show-warning");
  input.classList.remove("error");

  // Remove the icon if you don’t want it lingering
  const icon = container.querySelector(".warning-icon");
  if (icon) icon.remove();
}

/* -----------------------------
   BOOTSTRAP
------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
  readCookie();
  setupSearch();
  ensureShowMoreButton(); // wire up toggle & initial label
  fetchContacts("", true); // initial load (also resets to collapsed)
});

