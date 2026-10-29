const API = '';
let habitacionesDisponibles = [];

function $(id) { return document.getElementById(id); }
function showMsg(id, text, type = 'info') {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.className = 'msg show ' + type;
  if (!text) el.className = 'msg';
}
function hideMsg(id) { showMsg(id, '', ''); }

function fmtDate(d) { return d || ''; }

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = $('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const btnBuscar = $('btnBuscar');
  if (btnBuscar) btnBuscar.addEventListener('click', buscarDisponibilidad);

  const btnReservar = $('btnReservar');
  if (btnReservar) btnReservar.addEventListener('click', confirmarReserva);
});

async function buscarDisponibilidad() {
  const fi = $('fechaIngreso').value;
  const fs = $('fechaSalida').value;
  if (!fi || !fs) { showMsg('msgBuscar', 'Seleccione ambas fechas', 'error'); return; }
  if (fi >= fs) { showMsg('msgBuscar', 'La fecha de salida debe ser posterior', 'error'); return; }
  showMsg('msgBuscar', 'Buscando...', 'info');
  try {
    const res = await fetch(`/api/disponibilidad?fechaIngreso=${fi}&fechaSalida=${fs}`);
    const data = await res.json();
    if (!res.ok) { showMsg('msgBuscar', data.error || 'Error', 'error'); return; }
    habitacionesDisponibles = data.disponibles || [];
    renderHabitaciones();
    showMsg('msgBuscar', `${habitacionesDisponibles.length} habitación(es) disponible(s)`, 'success');
  } catch (e) {
    showMsg('msgBuscar', 'Error de conexión', 'error');
  }
}

function renderHabitaciones() {
  const cont = $('habitacionesList');
  if (!cont) return;
  if (!habitacionesDisponibles.length) {
    cont.innerHTML = '<p class="muted">No hay habitaciones disponibles.</p>';
    return;
  }
  cont.innerHTML = habitacionesDisponibles.map(h => `
    <div class="hab-item">
      <div>
        <div class="info">${h.nombre}</div>
        <div class="tipo">${h.tipo || ''}</div>
      </div>
      <button class="btn btn-primary" onclick="seleccionarHabitacion('${h.id}','${h.nombre.replace(/'/g,"\\'")}')">Seleccionar</button>
    </div>
  `).join('');
}

window.seleccionarHabitacion = function(id, nombre) {
  $('habSeleccionada').value = id;
  $('habNombre').textContent = nombre;
  $('cardReserva').style.display = 'block';
  $('cardReserva').scrollIntoView({ behavior: 'smooth' });
};

async function confirmarReserva() {
  const idHab = $('habSeleccionada').value;
  const fi = $('fechaIngreso').value;
  const fs = $('fechaSalida').value;
  const horaIngreso = $('horaIngreso')?.value || '';
  const horaSalida = $('horaSalida')?.value || '';
  const nombre = $('resNombre').value.trim();
  const tel = $('resTelefono').value.trim();
  const email = $('resEmail').value.trim();
  const personas = $('resPersonas').value;
  const obs = $('resObs').value.trim();
  if (!idHab) { showMsg('msgReserva', 'Seleccione una habitación', 'error'); return; }
  if (!nombre || !tel) { showMsg('msgReserva', 'Nombre y teléfono son obligatorios', 'error'); return; }
  showMsg('msgReserva', 'Guardando reserva...', 'info');
  try {
    const res = await fetch('/api/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idHabitacion: idHab,
        fechaIngreso: fi,
        fechaSalida: fs,
        horaIngreso,
        horaSalida,
        nombre, telefono: tel, email, personas, observacion: obs
      })
    });
    const data = await res.json();
    if (!res.ok) { showMsg('msgReserva', data.error || 'Error', 'error'); return; }
    showMsg('msgReserva', 'Reserva creada correctamente. ID: ' + data.id, 'success');
    $('cardReserva').style.display = 'none';
    $('resNombre').value = ''; $('resTelefono').value = ''; $('resEmail').value = ''; $('resObs').value = '';
  } catch (e) {
    showMsg('msgReserva', 'Error de conexión', 'error');
  }
}