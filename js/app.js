// ====== CHANGE THIS when the API is live ======
const API_BASE = "http://poosd24.live"; // or http:// if SSL isn't set yet
// CORS proxies for frontend-only testing (no backend changes needed). Leave first as "" to try direct first.
const CORS_PROXIES = [
    "",
    "https://corsproxy.io/?",
    "https://thingproxy.freeboard.io/fetch/"
];

// tiny helpers
const $ = (id) => document.getElementById(id);
let user = null;     // { id, firstName, lastName }
let editingId = null;

// unified POST helper
async function post(path, body) {
    const payload = JSON.stringify(body);
    let lastError = null;
    for (const proxy of CORS_PROXIES) {
        try {
            const isDirect = proxy === "";
            const url = proxy ? (proxy + API_BASE + path) : (API_BASE + path);
            const res = await fetch(url, {
                method: "POST",
                headers: isDirect ? { "Content-Type": "application/json" } : undefined,
                body: payload
            });
            // Some proxies return 2xx for upstream failures; still try to parse
            return await res.json();
        } catch (err) {
            lastError = err;
            continue;
        }
    }
    throw lastError || new Error("All proxies failed");
}

// Login function (Swagger-aligned)
// If backend hashes server-side, remove md5() in login/register. If backend expects MD5, keep md5().
async function login(){
    const login = document.querySelector('#loginName').value.trim();
    const pw    = document.querySelector('#loginPassword').value;
    const body  = { login, password: md5 ? md5(pw) : pw };
    const res   = await post('/Login.php', body);
    if (res.error) { document.querySelector('#loginError').textContent = res.error; return; }
    const user = { id: res.userId, firstName: res.firstName, lastName: res.lastName };
    localStorage.setItem('user', JSON.stringify(user));
    location.href = 'contacts.html';
}

// Register function (Swagger-aligned)
async function registerUser(){
    const body = {
        firstName: document.querySelector('#regFirst').value.trim(),
        lastName:  document.querySelector('#regLast').value.trim(),
        login:     document.querySelector('#regLogin').value.trim(),
        password:  md5 ? md5(document.querySelector('#regPassword').value) : document.querySelector('#regPassword').value
    };
    const res = await post('/Register.php', body);
    if (res.error) { document.querySelector('#regError').textContent = res.error; return; }
    const r = res.results || {};
    localStorage.setItem('user', JSON.stringify({ id: r.userId, firstName: r.firstName, lastName: r.lastName }));
    location.href = 'contacts.html';
}

// Page boot and event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Contacts page boot
    if (location.pathname.endsWith('contacts.html')) {
        const saved = localStorage.getItem('user');
        if (!saved) { location.href = 'index.html'; return; }
        user = JSON.parse(saved);
        const who = document.querySelector('#who');
        if (who) who.textContent = `Logged in as ${user.firstName} ${user.lastName}`;
        doSearch();
        const s = document.querySelector('#searchInput');
        if (s) s.addEventListener('input', debounce(doSearch, 300));
        return;
    }
    
    // Index page form listeners
    const loginForm = $('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            login();
        });
    }
    
    const registerForm = $('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', function(e) {
            e.preventDefault();
            registerUser();
        });
    }
});

// Search contacts (Swagger-aligned)
async function doSearch(){
    const term = (document.querySelector('#searchInput')?.value || '').trim();
    const res  = await post('/SearchContacts.php', { userId: user.id, search: term });
    renderRows(Array.isArray(res?.results) ? res.results : []);
}

// Render rows using Swagger result keys
function renderRows(list){
    const tbody = document.querySelector('#rows');
    if (!tbody) return;
    tbody.innerHTML = list.map(c => `
    <tr>
      <td>${escapeHtml(c.FirstName||'')}</td>
      <td>${escapeHtml(c.LastName||'')}</td>
      <td>${escapeHtml(c.Email||'')}</td>
      <td>${escapeHtml(c.Phone||'')}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary me-2" onclick='openEdit(${JSON.stringify(c)})'>Edit</button>
        <button class="btn btn-sm btn-outline-danger" onclick="deleteContact(${c.ID})">Delete</button>
      </td>
    </tr>`).join('');
}

function escapeHtml(s=''){ return s.replace(/[&<>"']/g,m=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }

// Open add contact modal
function openAdd(){
  editingId = null;
  setModal('Add Contact', { first:'', last:'', email:'', phone:'' });
  new bootstrap.Modal(document.getElementById('contactModal')).show();
}

// Open edit contact modal
function openEdit(c){
  editingId = c.ID; // note: capital ID from Search results
  setModal('Edit Contact', { first:c.FirstName, last:c.LastName, email:c.Email, phone:c.Phone });
  new bootstrap.Modal(document.getElementById('contactModal')).show();
}

// Set modal fields and title
function setModal(title, c){
  document.querySelector('#modalTitle').textContent = title;
  document.querySelector('#cFirst').value = c.first;
  document.querySelector('#cLast').value  = c.last;
  document.querySelector('#cEmail').value = c.email;
  document.querySelector('#cPhone').value = c.phone;
  document.querySelector('#formError').textContent = '';
}

// Save contact (add or update)
async function saveContact(){
  const payload = {
    userId: user.id,
    firstName: document.querySelector('#cFirst').value.trim(),
    lastName:  document.querySelector('#cLast').value.trim(),
    email:     document.querySelector('#cEmail').value.trim(),
    phone:     document.querySelector('#cPhone').value.trim()
  };
  let path = '/AddContact.php';
  if (editingId != null){ path = '/UpdateContact.php'; payload.contactId = editingId; }
  const res = await post(path, payload);
  if (res.error){ document.querySelector('#formError').textContent = res.error; return; }
  bootstrap.Modal.getInstance(document.getElementById('contactModal')).hide();
  doSearch();
}

// Delete contact
async function deleteContact(id){
  if (!confirm('Delete this contact?')) return;
  const res = await post('/DeleteContact.php', { userId: user.id, contactId: id });
  doSearch();
}

// Logout function
function logout(){ localStorage.removeItem('user'); location.href = 'index.html'; }

// debounce helper
function debounce(fn,ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; }