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
  date.setTime(date.getTime() + (minutes*60*1000));
  const exp = ";expires=" + date.toUTCString() + ";path=/";

  document.cookie = "firstName=" + encodeURIComponent(firstName) + exp;
  document.cookie = "lastName="  + encodeURIComponent(lastName)  + exp;
  document.cookie = "userId="    + encodeURIComponent(userId)    + exp;
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
  const onIndex = path.endsWith("/index.html") || path.endsWith("/");
  if ((isNaN(userId) || userId < 0) && !onIndex) {
    window.location.replace("index.html");
  }
}

function doLogout() {
  userId = 0; firstName = ""; lastName = "";
  const exp = "; expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  document.cookie = "firstName=" + exp;
  document.cookie = "lastName="  + exp;
  document.cookie = "userId="    + exp;
  window.location.href = "index.html";
}

/* -----------------------------
   AUTH
------------------------------*/
function doLogin()
{
  userId = 0;
  firstName = "";
  lastName = "";

  const login = document.getElementById("loginName").value;
  const password = document.getElementById("loginPassword").value;

  const loginResult = document.getElementById("loginResult");
  if (loginResult) loginResult.innerHTML = "";

  const payload = { login, password };
  const jsonPayload = JSON.stringify(payload);
  const url = `${urlBase}/Login.${extension}`;

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");

  xhr.onreadystatechange = function() {
    if (this.readyState !== 4) return;
    if (this.status !== 200) {
      if (loginResult) loginResult.innerHTML = "Login failed (" + this.status + ").";
      return;
    }
    let obj = {};
    try { obj = JSON.parse(xhr.responseText); } catch(_) {}

    const res = obj.results || obj;
    userId    = parseInt(res.id ?? res.userId ?? -1);
    firstName = res.firstName ?? "";
    lastName  = res.lastName ?? "";

    if (isNaN(userId) || userId < 1) {
      if (loginResult) loginResult.innerHTML = res.error || "User/Password combination incorrect";
      return;
    }
    saveCookie();
    window.location.href = "contacts.html";
  };
  xhr.send(jsonPayload);
}

function doRegister()
{
  const out = document.getElementById("registerResult");
  if (out) out.innerHTML = "";

  const f = document.getElementById("firstName").value.trim();
  const l = document.getElementById("lastName").value.trim();
  const u = document.getElementById("loginName").value.trim();
  const p = document.getElementById("loginPassword").value;

  // basic required-field checks
  if (!f || !l || !u || !p) {
    if (out) out.innerHTML = "Please fill out all fields.";
    return;
  }

  // treat login as email, validate simple pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(u)) {
    if (out) out.innerHTML = "Please enter a valid email.";
    return;
  }

  const payload = { firstName: f, lastName: l, login: u, password: p };
  const url = `${urlBase}/Register.${extension}`;

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");

  xhr.onreadystatechange = function() {
    if (this.readyState !== 4) return;
    if (this.status !== 200) {
      if (out) out.innerHTML = "Registration failed (" + this.status + ").";
      return;
    }
    let obj = {};
    try { obj = JSON.parse(xhr.responseText); } catch(_) {}

    if (obj.error && obj.error !== "") {
      if (out) out.innerHTML = "Error: " + obj.error;
      return;
    }

    const res = obj.results || obj;
    userId    = parseInt(res.userId ?? res.id ?? -1);
    firstName = res.firstName ?? f;
    lastName  = res.lastName ?? l;

    saveCookie();
    window.location.href = "management.html";
  };
  xhr.send(JSON.stringify(payload));
}

/* -----------------------------
   HELPERS
------------------------------*/
function escapeHtml(s){
  return String(s ?? "")
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#39;");
}

// Escape for embedding inside single-quoted attribute in template
function jsSafe(s){
  return String(s ?? "").replace(/\\/g,"\\\\").replace(/'/g,"\\'");
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
  const ln = c.LastName  ?? c.lastName  ?? "";
  const ph = c.Phone     ?? c.phone     ?? "";
  const em = c.Email     ?? c.email     ?? "";
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
    const name  = (card.querySelector(".contact-name")?.textContent || "").toLowerCase();
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
    try { obj = JSON.parse(xhr.responseText); } catch(_) {}
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
    const ln = c.LastName  ?? c.lastName  ?? "";
    const ph = c.Phone     ?? c.phone     ?? "";
    const em = c.Email     ?? c.email     ?? "";

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
          <button class="delete-btn" onclick="deleteContact(${id})">Delete</button>
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
function openEditModal(contactId, currFn="", currLn="", currPh="", currEm="") {
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

  function save() {
    const fn = document.getElementById("editFn").value.trim();
    const ln = document.getElementById("editLn").value.trim();
    const ph = document.getElementById("editPh").value.trim();
    const em = document.getElementById("editEm").value.trim();
    
    // validation: optional fields must be valid when provided
    if (em && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      alert("Please enter a valid email.");
      return;
    }
    if (ph && !(/^\d{10}$/.test(ph) || /^\d+$/.test(ph))) {
      alert("Phone must contain digits only (prefer 10 digits).");
      return;
    }
    
    updateContact(contactId, fn || currFn, ln || currLn, ph || currPh, em || currEm);
    closeEditModal();
  }
  function cancel() { closeEditModal(); }

  document.getElementById("editSave").onclick = save;
  document.getElementById("editCancel").onclick = cancel;
  overlay.addEventListener("click", e => { if (e.target === overlay) cancel(); });
  document.addEventListener("keydown", escClose);

  function escClose(e){ if (e.key === "Escape") cancel(); }
  function closeEditModal(){
    const el = document.getElementById("editOverlay");
    if (el) {
      el.remove();
      document.removeEventListener("keydown", escClose);
    }
  }
}
function promptUpdateContact(){ /* no-op: replaced by openEditModal */ }

/* -----------------------------
   UPDATE / DELETE / ADD
------------------------------*/
function updateContact(contactId, first, last, phone, email)
{
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
    try { obj = JSON.parse(xhr.responseText); } catch(_) {}

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

function deleteContact(contactId)
{
  const status = document.getElementById("contactSearchResult");
  const id = parseInt(contactId);
  if (!id || isNaN(id)) {
    if (status) status.innerHTML = "Missing contact id.";
    return;
  }

  // confirmation
  if (!confirm("Are you sure you want to delete this contact?")) {
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
    try { obj = JSON.parse(xhr.responseText); } catch(_) {}

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

function addContact()
{
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

  // required fields
  if (!f || !l || !ph || !em) {
    if (out) out.innerHTML = "Please fill out all fields.";
    return;
  }

  // email pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(em)) {
    if (out) out.innerHTML = "Please enter a valid email.";
    return;
  }

  // phone: either exactly 10 digits or all digits
  const tenDigits = /^\d{10}$/;
  const onlyDigits = /^\d+$/;
  if (!(tenDigits.test(ph) || onlyDigits.test(ph))) {
    if (out) out.innerHTML = "Phone must contain digits only (prefer 10 digits).";
    return;
  }

  const payload = { firstName: f, lastName: l, phone: ph, email: em, userId: userId };
  const url = `${urlBase}/AddContact.${extension}`;

  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-type", "application/json; charset=UTF-8");

  xhr.onreadystatechange = function() {
    if (this.readyState !== 4) return;
    if (this.status !== 200) {
      if (out) out.innerHTML = "Add failed (" + this.status + ").";
      return;
    }

    let obj = {};
    try { obj = JSON.parse(xhr.responseText); } catch(_) {}

    if (obj.error && obj.error !== "") {
      if (out) out.innerHTML = "Error: " + obj.error;
      return;
    }

    if (out) out.innerHTML = "Contact has been added";

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
  return function(...args) {
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

/* -----------------------------
   BOOTSTRAP
------------------------------*/
document.addEventListener("DOMContentLoaded", () => {
  readCookie();
  setupSearch();
  ensureShowMoreButton(); // wire up toggle & initial label
  fetchContacts("", true); // initial load (also resets to collapsed)
});
