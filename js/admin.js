const TOKEN_KEY = 'hm_admin_token';
let token = localStorage.getItem(TOKEN_KEY) || '';

function $(id) { return document.getElementById(id); }
function showMsg(id, text, type = 'info') {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg show ' + type;
  if (!text) el.className = 'msg';
}

function authHeaders() {
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = $('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const btnLogin = $('btnLogin');
  if (btnLogin) btnLogin.addEventListener('click', doLogin);

  const btnLogout = $('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', doLogout);

  const btnRecargar = $('btnRecargar');
  if (btnRecargar) btnRecargar.addEventListener('click', cargarReservas);

  const filtro = $('filtroEstado');
  if (filtro) filtro.addEventListener('change', renderTabla);

  if (token) {
    mostrarAdmin();
  }
});

async function doLogin() {
  const u = $('loginUser').value.trim();
  const p = $('loginPass').value;
  if (!u || !p) { showMsg('msgLogin', 'Ingrese usuario y contraseña', 'error'); return; }
  showMsg('msgLogin', 'Ingresando...', 'info');
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario: u, password: p })
    });
    const data = await res.json();
    if (!res.ok) { showMsg('msgLogin', data.error || 'Error', 'error'); return; }
    if (data.rol !== 'admin') { showMsg('msgLogin', 'No tiene permisos de administrador', 'error'); return; }
    token = data.token;
    localStorage.setItem(TOKEN_KEY, token);
    mostrarAdmin();
    showMsg('msgLogin', '', '');
  } catch (e) {
    showMsg('msgLogin', 'Error de conexión', 'error');
  }
}

function doLogout() {
  token = '';
  localStorage.removeItem(TOKEN_KEY);
  $('loginSection').style.display = 'block';
  $('adminSection').style.display = 'none';
  $('btnLogout').style.display = 'none';
}

function mostrarAdmin() {
  $('loginSection').style.display = 'none';
  $('adminSection').style.display = 'block';
  $('btnLogout').style.display = 'inline-block';
  cargarReservas();
}

let reservasCache = [];

async function cargarReservas() {
  showMsg('msgAdmin', 'Cargando...', 'info');
  try {
    const res = await fetch('/api/admin/reservas', { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) { showMsg('msgAdmin', data.error || 'Error', 'error'); if (res.status === 401) doLogout(); return; }
    reservasCache = data || [];
    renderTabla();
    renderCalendario();
    showMsg('msgAdmin', `${reservasCache.length} reserva(s)`, 'success');
  } catch (e) {
    showMsg('msgAdmin', 'Error de conexión', 'error');
  }
}

function renderTabla() {
  const tbody = document.querySelector('#tablaReservas tbody');
  if (!tbody) return;
  const filtro = $('filtroEstado').value;
  const filtradas = filtro === 'TODOS' ? reservasCache : reservasCache.filter(r => r.estado === filtro);
  tbody.innerHTML = filtradas.map(r => `
    <tr>
      <td>${r.id}</td>
      <td>${r.habitacion || r.idHabitacion}</td>
      <td>${r.fechaIngreso}</td>
      <td>${r.fechaSalida}</td>
      <td>${r.nombre}</td>
      <td>${r.telefono}</td>
      <td>${r.personas}</td>
      <td><span class="badge badge-${r.estado}">${r.estado}</span></td>
      <td>${r.transferido ? 'SI' : 'NO'}</td>
      <td>${r.observacion || ''}</td>
      <td>
        <div style="display:flex;gap:.3rem;flex-wrap:wrap">
          <button class="btn btn-outline" style="font-size:.75rem;padding:.3rem .5rem" onclick="cambiarEstado('${r.id}','TRANSFERIDO')">Transferido</button>
          <button class="btn btn-danger" style="font-size:.75rem;padding:.3rem .5rem" onclick="cambiarEstado('${r.id}','CANCELADA')">Cancelar</button>
          <button class="btn btn-warning" style="font-size:.75rem;padding:.3rem .5rem" onclick="liberar('${r.id}')">Liberar</button>
          <button class="btn btn-outline" style="font-size:.75rem;padding:.3rem .5rem" onclick="toggleTransferido('${r.id}', ${!r.transferido})">${r.transferido ? 'No transferido' : 'Transferido'}</button>
        </div>
      </td>
    </tr>
  `).join('');
}

window.cambiarEstado = async function(id, estado) {
  try {
    const res = await fetch(`/api/admin/reservas/${id}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ estado })
    });
    const data = await res.json();
    if (!res.ok) { showMsg('msgAdmin', data.error || 'Error', 'error'); return; }
    await cargarReservas();
  } catch (e) { showMsg('msgAdmin', 'Error de conexión', 'error'); }
};

window.toggleTransferido = async function(id, val) {
  try {
    const res = await fetch(`/api/admin/reservas/${id}/transferido`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ transferido: val })
    });
    const data = await res.json();
    if (!res.ok) { showMsg('msgAdmin', data.error || 'Error', 'error'); return; }
    await cargarReservas();
  } catch (e) { showMsg('msgAdmin', 'Error de conexión', 'error'); }
};

window.liberar = async function(id) {
  if (!confirm('¿Liberar esta habitación?')) return;
  try {
    const res = await fetch(`/api/admin/reservas/${id}/liberar`, {
      method: 'PUT',
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) { showMsg('msgAdmin', data.error || 'Error', 'error'); return; }
    await cargarReservas();
  } catch (e) { showMsg('msgAdmin', 'Error de conexión', 'error'); }
};

function renderCalendario() {
  const cont = $('calendarioVista');
  if (!cont) return;
  // group by habitacion
  const porHab = {};
  reservasCache.filter(r => r.estado !== 'CANCELADA').forEach(r => {
    const key = r.habitacion || r.idHabitacion;
    if (!porHab[key]) porHab[key] = [];
    porHab[key].push(r);
  });
  cont.innerHTML = Object.keys(porHab).map(hab => `
    <div class="cal-col">
      <h4>${hab}</h4>
      ${porHab[hab].map(r => `
        <div class="cal-event">
          <div><strong>${r.nombre}</strong></div>
          <div class="fechas">${r.fechaIngreso} → ${r.fechaSalida}</div>
          <div><span class="badge badge-${r.estado}">${r.estado}</span></div>
        </div>
      `).join('') || '<p class="muted" style="font-size:.8rem">Sin reservas</p>'}
    </div>
  `).join('') || '<p class="muted">Sin datos</p>';
}