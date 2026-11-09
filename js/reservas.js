/* =========================================================
   Hotel Montecarlo — Booking experience
   ========================================================= */

let habitacionesDisponibles = [];

function $(id) { return document.getElementById(id); }

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function localISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}

function showMsg(id, text, type = 'info') {
  const el = $(id);
  if (!el) return;
  el.textContent = text || '';
  el.className = text ? 'msg show ' + type : 'msg';
}

/* ---------- Información de cada tipo de habitación ---------- */
const ROOM_INFO = {
  matrimonial: {
    label: 'Matrimonial',
    cap: 2,
    desc: 'Una cama de 2 plazas, ideal para parejas que buscan descanso y privacidad.',
    img: '/images/rooms/mat.jpg'
  },
  triplemat: {
    label: 'Triple Matrimonial',
    cap: 3,
    desc: 'Una cama de 2 plazas y una de 1 plaza, perfecta para familias pequeñas.',
    img: '/images/rooms/triplemat.jpg'
  },
  twin: {
    label: 'Doble Twin',
    cap: 2,
    desc: 'Dos camas de 1 plaza, práctica y cómoda para amigos o colegas de viaje.',
    img: '/images/rooms/twin.jpg'
  },
  triple: {
    label: 'Triple',
    cap: 3,
    desc: 'Tres camas de 1 plaza, amplia y luminosa para grupos de amigos.',
    img: '/images/rooms/triple.jpg'
  },
  quad: {
    label: 'Cuádruple',
    cap: 4,
    desc: 'Una cama de 2 plazas y dos de 1 plaza, el espacio ideal para toda la familia.',
    img: '/images/rooms/quad.jpg'
  }
};

function roomInfo(tipo, nombre) {
  const all = (String(tipo || '') + ' ' + String(nombre || '')).toLowerCase();
  if (all.includes('cu') && all.includes('druple')) return ROOM_INFO.quad;
  if (all.includes('triple') && all.includes('matrimonial')) return ROOM_INFO.triplemat;
  if (all.includes('triple')) return ROOM_INFO.triple;
  if (all.includes('twin') || all.includes('doble')) return ROOM_INFO.twin;
  if (all.includes('single') || all.includes('matrimonial')) return ROOM_INFO.matrimonial;
  return ROOM_INFO.twin;
}

function roomImage(tipo, nombre) { return roomInfo(tipo, nombre).img; }

/* ---------- Iconos ---------- */
const ICON_USERS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
const ICON_CHECK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

/* ---------- Inicio ---------- */
document.addEventListener('DOMContentLoaded', () => {
  const yearEl = $('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86400000);
  const fi = $('fechaIngreso');
  const fs = $('fechaSalida');

  if (fi) { fi.min = localISO(today); if (!fi.value) fi.value = localISO(today); }
  if (fs) { fs.min = localISO(tomorrow); if (!fs.value) fs.value = localISO(tomorrow); }

  if (fi && fs) {
    fi.addEventListener('change', () => {
      if (fi.value) {
        const d = new Date(fi.value + 'T00:00:00');
        d.setDate(d.getDate() + 1);
        fs.min = localISO(d);
        if (fs.value && fs.value <= fi.value) fs.value = localISO(d);
      }
      syncSummary();
    });
    fs.addEventListener('change', syncSummary);
  }

  const personas = $('resPersonas');
  if (personas) personas.addEventListener('input', syncSummary);

  const btnBuscar = $('btnBuscar');
  if (btnBuscar) btnBuscar.addEventListener('click', buscarDisponibilidad);

  const btnReservar = $('btnReservar');
  if (btnReservar) btnReservar.addEventListener('click', confirmarReserva);

  const form = $('bkSearchForm');
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); buscarDisponibilidad(); });

  // Nav con sombra al hacer scroll
  const nav = $('bkNav');
  const onScroll = () => { if (nav) nav.classList.toggle('is-scrolled', window.scrollY > 20); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Menú móvil
  const menuBtn = $('bkMenuBtn');
  const links = $('bkLinks');
  if (menuBtn && links) {
    menuBtn.addEventListener('click', () => {
      const open = links.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    links.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
      links.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
    }));
  }

  syncSummary();
});

function syncSummary() {
  if ($('sumIngreso')) $('sumIngreso').textContent = formatDate($('fechaIngreso') ? $('fechaIngreso').value : '');
  if ($('sumSalida')) $('sumSalida').textContent = formatDate($('fechaSalida') ? $('fechaSalida').value : '');
  if ($('sumPersonas')) $('sumPersonas').textContent = ((($('resPersonas') && $('resPersonas').value) || '2')) + ' huésped(es)';
}

/* ---------- Búsqueda ---------- */
async function buscarDisponibilidad() {
  const fi = $('fechaIngreso') ? $('fechaIngreso').value : '';
  const fs = $('fechaSalida') ? $('fechaSalida').value : '';
  if (!fi || !fs) { showMsg('msgBuscar', 'Seleccione ambas fechas', 'error'); return; }
  if (fi >= fs) { showMsg('msgBuscar', 'La fecha de salida debe ser posterior al ingreso', 'error'); return; }

  if ($('searchPersonas') && $('resPersonas')) $('resPersonas').value = $('searchPersonas').value;

  showMsg('msgBuscar', 'Buscando disponibilidad…', 'info');
  const btn = $('btnBuscar');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`/api/disponibilidad?fechaIngreso=${encodeURIComponent(fi)}&fechaSalida=${encodeURIComponent(fs)}`);
    const data = await res.json();
    if (!res.ok) { showMsg('msgBuscar', data.error || 'No se pudo consultar la disponibilidad', 'error'); return; }

    habitacionesDisponibles = data.disponibles || [];
    renderHabitaciones();

    const n = habitacionesDisponibles.length;
    const sub = $('resultsSubtitle');
    if (sub) {
      const plural = n === 1 ? 'habitación' : 'habitaciones';
      sub.textContent = n
        ? `${n} ${plural} disponible${n === 1 ? '' : 's'} del ${formatDate(fi)} al ${formatDate(fs)}.`
        : `No encontramos habitaciones libres del ${formatDate(fi)} al ${formatDate(fs)}. Pruebe con otras fechas.`;
    }
    showMsg('msgBuscar', n ? (n === 1 ? '1 habitación disponible' : `${n} habitaciones disponibles`) : 'Sin disponibilidad para esas fechas', n ? 'success' : 'error');

    if (n) {
      setTimeout(() => {
        const sec = $('habitaciones');
        if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 350);
    }
  } catch (e) {
    showMsg('msgBuscar', 'Error de conexión. Intente nuevamente.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* ---------- Render de habitaciones ---------- */
function renderHabitaciones() {
  const cont = $('habitacionesList');
  if (!cont) return;

  if (!habitacionesDisponibles.length) {
    cont.innerHTML = `<div class="bk-placeholder">
      <div class="bk-placeholder-icon">✦</div>
      <p>No hay habitaciones disponibles para esas fechas. Intente con otro rango de fechas.</p>
    </div>`;
    return;
  }

  cont.innerHTML = habitacionesDisponibles.map((h, idx) => {
    const info = roomInfo(h.tipo, h.nombre);
    return `
      <article class="bk-room-card" style="animation-delay:${idx * 60}ms">
        <div class="bk-room-media">
          <img src="${info.img}" alt="${esc(h.nombre)}" loading="lazy">
          <span class="bk-room-badge">${esc(h.tipo || info.label)}</span>
          <span class="bk-room-status"><i></i>Disponible</span>
        </div>
        <div class="bk-room-body">
          <div class="bk-room-head">
            <h3>${esc(h.nombre)}</h3>
            <span class="bk-room-cap">${ICON_USERS}${info.cap} huéspedes</span>
          </div>
          <p class="bk-room-desc">${esc(info.desc)}</p>
          <ul class="bk-room-amenities">
            <li>${ICON_CHECK}TV Cable</li>
            <li>${ICON_CHECK}Wi-Fi</li>
            <li>${ICON_CHECK}Baño privado</li>
            <li>${ICON_CHECK}Desayuno</li>
          </ul>
          <div class="bk-room-foot">
            <div class="bk-room-price"><small>Tarifa</small><strong>A consultar</strong></div>
            <button type="button" class="bk-btn bk-btn-navy bk-select-btn"
              data-id="${esc(h.id)}" data-nombre="${esc(h.nombre)}" data-tipo="${esc(h.tipo || '')}">Seleccionar</button>
          </div>
        </div>
      </article>`;
  }).join('');

  cont.querySelectorAll('.bk-select-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      seleccionarHabitacion(btn.dataset.id, btn.dataset.nombre, btn.dataset.tipo);
    });
  });
}

/* ---------- Selección ---------- */
window.seleccionarHabitacion = function (id, nombre, tipo) {
  const info = roomInfo(tipo, nombre);

  if ($('habSeleccionada')) $('habSeleccionada').value = id;
  if ($('habNombre')) $('habNombre').textContent = nombre;

  const img = $('habImagen');
  if (img) { img.src = info.img; img.alt = nombre; }

  if ($('habTipoResumen')) $('habTipoResumen').textContent = tipo || info.label;
  syncSummary();

  document.querySelectorAll('.bk-room-card').forEach((c) => c.classList.remove('is-selected'));
  const btn = document.querySelector('.bk-select-btn[data-id="' + String(id).replace(/"/g, '') + '"]');
  if (btn) {
    const card = btn.closest('.bk-room-card');
    if (card) card.classList.add('is-selected');
  }

  const card = $('cardReserva');
  if (card) {
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
};

/* ---------- Confirmación ---------- */
async function confirmarReserva() {
  const idHab = $('habSeleccionada') ? $('habSeleccionada').value : '';
  const fi = $('fechaIngreso') ? $('fechaIngreso').value : '';
  const fs = $('fechaSalida') ? $('fechaSalida').value : '';
  const horaIngreso = $('horaIngreso') ? $('horaIngreso').value : '';
  const horaSalida = $('horaSalida') ? $('horaSalida').value : '';
  const nombre = $('resNombre') ? $('resNombre').value.trim() : '';
  const tel = $('resTelefono') ? $('resTelefono').value.trim() : '';
  const email = $('resEmail') ? $('resEmail').value.trim() : '';
  const personas = $('resPersonas') ? $('resPersonas').value : '';
  const obs = $('resObs') ? $('resObs').value.trim() : '';

  if (!idHab) { showMsg('msgReserva', 'Seleccione una habitación', 'error'); return; }
  if (!nombre || !tel) { showMsg('msgReserva', 'Nombre y teléfono son obligatorios', 'error'); return; }

  showMsg('msgReserva', 'Guardando su reserva…', 'info');
  const btn = $('btnReservar');
  if (btn) btn.disabled = true;

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
        nombre,
        telefono: tel,
        email,
        personas,
        observacion: obs
      })
    });
    const data = await res.json();
    if (!res.ok) { showMsg('msgReserva', data.error || 'No se pudo crear la reserva', 'error'); return; }

    showMsg('msgReserva', '¡Reserva confirmada! Su código es #' + data.id + '. Le contactaremos a la brevedad.', 'success');

    ['resNombre', 'resTelefono', 'resEmail', 'resObs'].forEach((id) => {
      if ($(id)) $(id).value = '';
    });

    const msg = $('msgReserva');
    if (msg) msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    showMsg('msgReserva', 'Error de conexión. Intente nuevamente.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}
