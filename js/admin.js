document.getElementById('year').textContent = new Date().getFullYear();

const loginSection = document.getElementById('loginSection');
const adminSection = document.getElementById('adminSection');
const btnLogin = document.getElementById('btnLogin');
const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');
const msgLogin = document.getElementById('msgLogin');
const btnLogout = document.getElementById('btnLogout');
const btnRecargar = document.getElementById('btnRecargar');
const filtroEstado = document.getElementById('filtroEstado');
const tablaBody = document.querySelector('#tablaReservas tbody');
const msgAdmin = document.getElementById('msgAdmin');
const calendarioVista = document.getElementById('calendarioVista');

let token = localStorage.getItem('hm_token');
let reservasData = [];

function mostrarLogin() {
  loginSection.style.display = 'block';
  adminSection.style.display = 'none';
  btnLogout.style.display = 'none';
}

function mostrarAdmin() {
  loginSection.style.display = 'none';
  adminSection.style.display = 'block';
  btnLogout.style.display = 'inline-block';
  cargarReservas();
  cargarCalendario();
}

if (token) {
  mostrarAdmin();
}

btnLogin.addEventListener('click', async () => {
  msgLogin.textContent = '';
  msgLogin.className = 'msg';
  const usuario = loginUser.value.trim();
  const password = loginPass.value;
  if (!usuario || !password) {
    msgLogin.textContent = 'Ingrese usuario y contraseña';
    msgLogin.className = 'msg error';
    return;
  }
  btnLogin.disabled = true;
  btnLogin.textContent = 'Ingresando...';
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usuario, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    if (data.rol !== 'admin') throw new Error('Acceso solo para administradores');
    token = data.token;
    localStorage.setItem('hm_token', token);
    mostrarAdmin();
  } catch (e) {
    msgLogin.textContent = e.message;
    msgLogin.className = 'msg error';
  } finally {
    btnLogin.disabled = false;
    btnLogin.textContent = 'Ingresar';
  }
});

btnLogout.addEventListener('click', () => {
  localStorage.removeItem('hm_token');
  token = null;
  mostrarLogin();
});

btnRecargar.addEventListener('click', () => {
  cargarReservas();
  cargarCalendario();
});

filtroEstado.addEventListener('change', renderTabla);

async function cargarReservas() {
  msgAdmin.textContent = '';
  msgAdmin.className = 'msg';
  try {
    const res = await fetch('/api/admin/reservas', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (res.status === 401) {
      localStorage.removeItem('hm_token');
      token = null;
      mostrarLogin();
      return;
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    reservasData = data.sort((a,b) => a.fechaIngreso.localeCompare(b.fechaIngreso));
    renderTabla();
  } catch (e) {
    msgAdmin.textContent = e.message;
    msgAdmin.className = 'msg error';
  }
}

function renderTabla() {
  const filtro = filtroEstado.value;
  tablaBody.innerHTML = '';
  let lista = reservasData;
  if (filtro !== 'TODOS') {
    lista = reservasData.filter(r => r.estado === filtro || (filtro === 'TRANSFERIDO' && r.transferido && r.estado !== 'CANCELADA'));
  }
  
  if (lista.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td colspan="11" style="text-align:center;color:var(--text-light)">Sin reservas</td>';
    tablaBody.appendChild(tr);
    return;
  }
  
  lista.forEach(r => {
    const tr = document.createElement('tr');
    const estadoClass = r.estado.toLowerCase().replace('transferido','transferido');
    tr.innerHTML = `
      <td>#${r.id}</td>
      <td>${r.habitacion}</td>
      <td>${r.fechaIngreso}</td>
      <td>${r.fechaSalida}</td>
      <td>${escapeHtml(r.nombre)}</td>
      <td>${escapeHtml(r.telefono)}</td>
      <td>${r.personas || '-'}</td>
      <td><span class="estado ${r.estado.toLowerCase()}">${r.estado}</span></td>
      <td>${r.transferido ? '<span class="badge badge-ok">SI</span>' : '<span class="badge">NO</span>'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(r.observacion || '')}</td>
      <td>
        <div class="actions">
          ${r.estado !== 'CONFIRMADA' ? `<button class="btn btn-sm btn-success" onclick="cambiarEstado('${r.id}','CONFIRMADA')">Confirmar</button>` : ''}
          ${!r.transferido && r.estado !== 'CANCELADA' ? `<button class="btn btn-sm btn-warn" onclick="marcarTransferido('${r.id}',true)">Transferido</button>` : ''}
          ${r.transferido ? `<button class="btn btn-sm btn-outline" onclick="marcarTransferido('${r.id}',false)">Quitar Transferido</button>` : ''}
          ${r.estado !== 'CANCELADA' ? `<button class="btn btn-sm btn-danger" onclick="cambiarEstado('${r.id}','CANCELADA')">Cancelar</button>` : ''}
          ${r.estado !== 'LIBERADA' ? `<button class="btn btn-sm btn-gray" onclick="liberar('${r.id}')">Liberar</button>` : ''}
        </div>
      </td>
    `;
    tablaBody.appendChild(tr);
  });
}

window.cambiarEstado = async (id, estado) => {
  if (!confirm(`¿Cambiar estado a ${estado}?`)) return;
  try {
    const res = await fetch(`/api/admin/reservas/${id}/estado`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ estado })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    cargarReservas();
    cargarCalendario();
  } catch (e) {
    alert(e.message);
  }
};

window.marcarTransferido = async (id, val) => {
  try {
    const res = await fetch(`/api/admin/reservas/${id}/transferido`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ transferido: val })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    cargarReservas();
    cargarCalendario();
  } catch (e) {
    alert(e.message);
  }
};

window.liberar = async (id) => {
  if (!confirm('¿Liberar esta habitación? Esto marcará la reserva como LIBERADA.')) return;
  try {
    const res = await fetch(`/api/admin/reservas/${id}/liberar`, {
      method: 'PUT',
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    cargarReservas();
    cargarCalendario();
  } catch (e) {
    alert(e.message);
  }
};

async function cargarCalendario() {
  try {
    const res = await fetch('/api/calendario');
    const data = await res.json();
    if (!res.ok) return;
    renderCalendario(data.habitaciones, data.reservas);
  } catch (e) {
    // ignore
  }
}

function renderCalendario(habs, reservas) {
  calendarioVista.innerHTML = '';
  if (!habs || habs.length === 0) {
    calendarioVista.innerHTML = '<p class="muted">Sin habitaciones configuradas</p>';
    return;
  }
  habs.forEach(hab => {
    const div = document.createElement('div');
    div.className = 'cal-hab';
    const resHab = reservas.filter(r => String(r.habitacionId) === String(hab.id));
    div.innerHTML = `
      <div class="cal-hab-header">${hab.nombre} ${hab.tipo ? '(' + hab.tipo + ')' : ''}</div>
      <div class="cal-hab-body">
        ${resHab.length === 0 ? '<span class="muted">Sin reservas</span>' : resHab.map(r => `
          <div class="cal-reserva ${r.estado.toLowerCase()}">
            <strong>${r.inicio} → ${r.fin}</strong><br>
            ${escapeHtml(r.nombre)} ${r.telefono ? '· ' + escapeHtml(r.telefono) : ''} 
            ${r.transferido ? '<span style="font-weight:600">[TRANSFERIDO]</span>' : ''}
          </div>
        `).join('')}
      </div>
    `;
    calendarioVista.appendChild(div);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
