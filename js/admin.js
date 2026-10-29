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

let reservasCache = [];
let habitacionesUnicas = [];
const roomColors = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea', '#0891b2',
  '#be185d', '#65a30d', '#ea580c', '#7c3aed', '#059669', '#0284c7'
];
const roomColorMap = {};

let currentDate = new Date();
let currentView = 'month'; // month | week | day
let selectedReserva = null;

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = $('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const btnLogin = $('btnLogin');
  if (btnLogin) btnLogin.addEventListener('click', doLogin);

  const btnLogout = $('btnLogout');
  if (btnLogout) btnLogout.addEventListener('click', doLogout);

  const btnRecargar = $('btnRecargar');
  if (btnRecargar) btnRecargar.addEventListener('click', cargarReservas);

  const btnPrev = $('btnPrev');
  if (btnPrev) btnPrev.addEventListener('click', () => { navigate(-1); });
  const btnNext = $('btnNext');
  if (btnNext) btnNext.addEventListener('click', () => { navigate(1); });
  const btnHoy = $('btnHoy');
  if (btnHoy) btnHoy.addEventListener('click', () => { currentDate = new Date(); renderCalendar(); });

  document.querySelectorAll('.btn-view').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-view').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      renderCalendar();
    });
  });

  const filtro = $('filtroEstado');
  if (filtro) filtro.addEventListener('change', renderTabla);

  const modalClose = $('modalClose');
  if (modalClose) modalClose.addEventListener('click', closeModal);
  const modal = $('resModal');
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  $('mBtnConf')?.addEventListener('click', () => cambiarEstadoModal('CONFIRMADA'));
  $('mBtnTrans')?.addEventListener('click', () => toggleTransferidoModal());
  $('mBtnCanc')?.addEventListener('click', () => cambiarEstadoModal('CANCELADA'));
  $('mBtnLib')?.addEventListener('click', liberarModal);

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

async function cargarReservas() {
  showMsg('msgAdmin', 'Cargando...', 'info');
  try {
    const res = await fetch('/api/admin/reservas', { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) { showMsg('msgAdmin', data.error || 'Error', 'error'); if (res.status === 401) doLogout(); return; }
    reservasCache = (data || []).filter(r => r.estado !== 'CANCELADA' && r.estado !== 'LIBERADA');
    // build habitaciones
    const set = new Set();
    reservasCache.forEach(r => set.add(r.habitacion || r.idHabitacion));
    habitacionesUnicas = Array.from(set).sort((a,b) => String(a).localeCompare(String(b)));
    habitacionesUnicas.forEach((h, idx) => {
      if (!roomColorMap[h]) roomColorMap[h] = roomColors[idx % roomColors.length];
    });
    renderTabla();
    renderCalendar();
    renderLegend();
    showMsg('msgAdmin', `${reservasCache.length} reserva(s) activas`, 'success');
  } catch (e) {
    showMsg('msgAdmin', 'Error de conexión', 'error');
  }
}

function renderTabla() {
  const tbody = document.querySelector('#tablaReservas tbody');
  if (!tbody) return;
  const filtro = $('filtroEstado').value;
  const filtradas = filtro === 'TODOS' ? (reservasCacheAll()) : (reservasCacheAll()).filter(r => r.estado === filtro);
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
          <button class="btn btn-outline" style="font-size:.75rem;padding:.3rem .5rem" onclick="openModal('${r.id}')">Ver/Editar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function reservasCacheAll() {
  // need all including cancelled/liberated - reload from original? easier just use reservasCache which we filtered; better store all
  return reservasCacheAllFull();
}

let reservasCacheFull = [];
async function cargarReservas() {
  showMsg('msgAdmin', 'Cargando...', 'info');
  try {
    const res = await fetch('/api/admin/reservas', { headers: authHeaders() });
    const data = await res.json();
    if (!res.ok) { showMsg('msgAdmin', data.error || 'Error', 'error'); if (res.status === 401) doLogout(); return; }
    reservasCacheFull = data || [];
    reservasCache = reservasCacheFull.filter(r => r.estado !== 'CANCELADA' && r.estado !== 'LIBERADA');
    const set = new Set();
    reservasCacheFull.forEach(r => set.add(r.habitacion || r.idHabitacion));
    habitacionesUnicas = Array.from(set).sort((a,b) => String(a).localeCompare(String(b)));
    habitacionesUnicas.forEach((h, idx) => {
      if (!roomColorMap[h]) roomColorMap[h] = roomColors[idx % roomColors.length];
    });
    renderTabla();
    renderCalendar();
    renderLegend();
    showMsg('msgAdmin', `${reservasCacheFull.length} reserva(s) total`, 'success');
  } catch (e) {
    showMsg('msgAdmin', 'Error de conexión', 'error');
  }
}

function reservasCacheAllFull() { return reservasCacheFull; }

function renderLegend() {
  const cont = $('roomLegend');
  if (!cont) return;
  cont.innerHTML = habitacionesUnicas.map(h => `
    <div class="legend-item">
      <span class="legend-color" style="background:${roomColorMap[h]}"></span>
      <span>${h}</span>
    </div>
  `).join('');
}

function parseDate(s) {
  if (!s) return null;
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const da = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${da}`;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate()+n); return x; }
function startOfWeek(d) { const x = new Date(d); const day = x.getDay(); const diff = (day === 0 ? -6 : 1) - day; x.setDate(x.getDate()+diff); x.setHours(0,0,0,0); return x; }

function navigate(dir) {
  if (currentView === 'month') {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + dir, 1);
  } else if (currentView === 'week') {
    currentDate = addDays(currentDate, dir * 7);
  } else if (currentView === 'day') {
    currentDate = addDays(currentDate, dir);
  }
  renderCalendar();
}

function renderCalendar() {
  const cont = $('calendarMain');
  const title = $('calendarTitle');
  if (!cont) return;
  if (currentView === 'month') renderMonth(cont, title);
  else if (currentView === 'week') renderWeek(cont, title);
  else if (currentView === 'day') renderDay(cont, title);
}

function renderMonth(cont, title) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  title.textContent = currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startDay = first.getDay() === 0 ? 7 : first.getDay(); // Monday start
  const daysInMonth = last.getDate();
  let html = '<div class="month-grid">';
  html += '<div class="month-header">Lun</div><div class="month-header">Mar</div><div class="month-header">Mié</div><div class="month-header">Jue</div><div class="month-header">Vie</div><div class="month-header">Sáb</div><div class="month-header">Dom</div>';
  for (let i = 1; i < startDay; i++) {
    html += '<div class="month-cell empty"></div>';
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const ds = dateToStr(d);
    const isToday = dateToStr(new Date()) === ds;
    let bars = '';
    reservasCache.forEach(r => {
      const ing = parseDate(r.fechaIngreso);
      const sal = parseDate(r.fechaSalida);
      if (!ing || !sal) return;
      if (d >= ing && d < sal) { // mostrar hasta día antes de salida
        const hab = r.habitacion || r.idHabitacion;
        const color = roomColorMap[hab] || '#2563eb';
        bars += `<div class="cal-bar" style="background:${color}" onclick="openModal('${r.id}')" title="${hab} - ${r.nombre} (${r.fechaIngreso}→${r.fechaSalida})">${hab} · ${r.nombre.split(' ')[0]}</div>`;
      }
    });
    html += `<div class="month-cell${isToday ? ' today' : ''}"><div class="month-day">${day}</div><div class="month-bars">${bars}</div></div>`;
  }
  html += '</div>';
  cont.innerHTML = html;
}

function renderWeek(cont, title) {
  const start = startOfWeek(currentDate);
  title.textContent = `Semana ${start.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })} - ${addDays(start,6).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  let html = '<div class="week-grid">';
  html += '<div class="week-corner">Habitación</div>';
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const isToday = dateToStr(d) === dateToStr(new Date());
    html += `<div class="week-header${isToday ? ' today' : ''}">${d.toLocaleDateString('es-ES', { weekday: 'short' })}<br>${d.getDate()}/${d.getMonth()+1}</div>`;
  }
  habitacionesUnicas.forEach(hab => {
    html += `<div class="week-room"><span class="room-dot" style="background:${roomColorMap[hab]}"></span>${hab}</div>`;
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const ds = dateToStr(d);
      let cellBars = '';
      reservasCache.forEach(r => {
        const ing = parseDate(r.fechaIngreso);
        const sal = parseDate(r.fechaSalida);
        if (!ing || !sal) return;
        if ((r.habitacion || r.idHabitacion) === hab && d >= ing && d < sal) {
          const color = roomColorMap[hab] || '#2563eb';
          cellBars += `<div class="cal-bar-sm" style="background:${color}" onclick="openModal('${r.id}')" title="${r.nombre}">${r.nombre.split(' ')[0]}</div>`;
        }
      });
      html += `<div class="week-cell">${cellBars}</div>`;
    }
  });
  if (habitacionesUnicas.length === 0) html += '<div class="week-empty">No hay reservas activas</div>';
  html += '</div>';
  cont.innerHTML = html;
}

function renderDay(cont, title) {
  const d = new Date(currentDate);
  title.textContent = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const ds = dateToStr(d);
  let html = '<div class="day-grid">';
  html += '<div class="day-header">Habitación</div><div class="day-header">Reserva</div>';
  habitacionesUnicas.forEach(hab => {
    html += `<div class="day-room"><span class="room-dot" style="background:${roomColorMap[hab]}"></span>${hab}</div>`;
    let info = '<div class="day-empty">Libre</div>';
    reservasCache.forEach(r => {
      const ing = parseDate(r.fechaIngreso);
      const sal = parseDate(r.fechaSalida);
      if (!ing || !sal) return;
      if ((r.habitacion || r.idHabitacion) === hab && d >= ing && d < sal) {
        const color = roomColorMap[hab] || '#2563eb';
        info = `<div class="day-res" style="border-left:4px solid ${color}" onclick="openModal('${r.id}')">
          <div><strong>${r.nombre}</strong> · ${r.telefono}</div>
          <div class="muted">${r.fechaIngreso} → ${r.fechaSalida} · ${r.personas} pers. · <span class="badge badge-${r.estado}">${r.estado}</span> ${r.transferido ? '· TRANSFERIDO' : ''}</div>
          ${r.observacion ? '<div class="muted">Obs: ' + r.observacion + '</div>' : ''}
        </div>`;
      }
    });
    html += `<div class="day-cell">${info}</div>`;
  });
  if (habitacionesUnicas.length === 0) html += '<div class="day-empty-all">No hay reservas activas</div>';
  html += '</div>';
  cont.innerHTML = html;
}

window.openModal = function(id) {
  const r = reservasCacheFull.find(x => String(x.id) === String(id));
  if (!r) return;
  selectedReserva = r;
  $('mId').textContent = r.id;
  $('mHab').textContent = r.habitacion || r.idHabitacion;
  $('mIng').textContent = r.fechaIngreso;
  $('mSal').textContent = r.fechaSalida;
  $('mCli').textContent = r.nombre;
  $('mTel').textContent = r.telefono;
  $('mEmail').textContent = r.email || '-';
  $('mPer').textContent = r.personas || '-';
  $('mEst').textContent = r.estado;
  $('mTrans').textContent = r.transferido ? 'SI' : 'NO';
  $('mObs').textContent = r.observacion || '-';
  $('resModal').classList.add('show');
};

function closeModal() {
  $('resModal').classList.remove('show');
  selectedReserva = null;
}

async function cambiarEstadoModal(estado) {
  if (!selectedReserva) return;
  try {
    const res = await fetch(`/api/admin/reservas/${selectedReserva.id}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ estado })
    });
    const data = await res.json();
    if (!res.ok) { showMsg('msgAdmin', data.error || 'Error', 'error'); return; }
    closeModal();
    await cargarReservas();
  } catch (e) { showMsg('msgAdmin', 'Error de conexión', 'error'); }
}

async function toggleTransferidoModal() {
  if (!selectedReserva) return;
  try {
    const res = await fetch(`/api/admin/reservas/${selectedReserva.id}/transferido`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ transferido: !selectedReserva.transferido })
    });
    const data = await res.json();
    if (!res.ok) { showMsg('msgAdmin', data.error || 'Error', 'error'); return; }
    closeModal();
    await cargarReservas();
  } catch (e) { showMsg('msgAdmin', 'Error de conexión', 'error'); }
}

async function liberarModal() {
  if (!selectedReserva) return;
  if (!confirm('¿Liberar esta habitación?')) return;
  try {
    const res = await fetch(`/api/admin/reservas/${selectedReserva.id}/liberar`, {
      method: 'PUT',
      headers: authHeaders()
    });
    const data = await res.json();
    if (!res.ok) { showMsg('msgAdmin', data.error || 'Error', 'error'); return; }
    closeModal();
    await cargarReservas();
  } catch (e) { showMsg('msgAdmin', 'Error de conexión', 'error'); }
}

// keep old functions for compatibility
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