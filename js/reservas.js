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

function roomImage(tipo, nombre) {
  const t = String(tipo || '').toLowerCase();
  const n = String(nombre || '').toLowerCase();
  const all = t + ' ' + n;
  if (all.includes('cu') && (all.includes('druple') || all.includes('druple'))) return '/images/rooms/quad.jpg';
  if (all.includes('triple') && all.includes('matrimonial')) return '/images/rooms/triplemat.jpg';
  if (all.includes('triple')) return '/images/rooms/triple.jpg';
  if (all.includes('twin') || all.includes('doble')) return '/images/rooms/twin.jpg';
  if (all.includes('single') || all.includes('matrimonial')) return '/images/rooms/mat.jpg';
  return '/images/rooms/twin.jpg';
}

document.addEventListener('DOMContentLoaded', () => {
  const yearEl = $('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const btnBuscar = $('btnBuscar');
  if (btnBuscar) btnBuscar.addEventListener('click', buscarDisponibilidad);

  const btnReservar = $('btnReservar');
  if (btnReservar) btnReservar.addEventListener('click', confirmarReserva);

  // default dates: today and tomorrow
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const iso = d => d.toISOString().slice(0,10);
  if ($('fechaIngreso') && !$('fechaIngreso').value) $('fechaIngreso').value = iso(today);
  if ($('fechaSalida') && !$('fechaSalida').value) $('fechaSalida').value = iso(tomorrow);
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
    cont.innerHTML = '<p class="muted">No hay habitaciones disponibles para esas fechas.</p>';
    return;
  }
  cont.innerHTML = habitacionesDisponibles.map(h => `
    <div class="hab-card">
      <img class="hab-img" src="${roomImage(h.tipo, h.nombre)}" alt="${h.nombre}" loading="lazy">
      <div class="hab-body">
        <div class="hab-name">${h.nombre}</div>
        <div class="hab-type">${h.tipo || ''}</div>
        <button class="btn btn-primary" onclick="seleccionarHabitacion('${h.id}','${h.nombre.replace(/'/g,"\\'")}','${(h.tipo||'').replace(/'/g,"\\'")}')">Seleccionar</button>
      </div>
    </div>
  `).join('');
}

window.seleccionarHabitacion = function(id, nombre, tipo) {
  $('habSeleccionada').value = id;
  $('habNombre').textContent = nombre;
  const img = $('habImagen');
  if (img) {
    img.src = roomImage(tipo, nombre);
    img.alt = nombre;
  }
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