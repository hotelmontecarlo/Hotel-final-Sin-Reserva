document.getElementById('year').textContent = new Date().getFullYear();

const fechaIngreso = document.getElementById('fechaIngreso');
const fechaSalida = document.getElementById('fechaSalida');
const btnBuscar = document.getElementById('btnBuscar');
const msgBuscar = document.getElementById('msgBuscar');
const habitacionesList = document.getElementById('habitacionesList');
const msgHab = document.getElementById('msgHab');
const cardReserva = document.getElementById('cardReserva');
const habSeleccionada = document.getElementById('habSeleccionada');
const habNombre = document.getElementById('habNombre');
const btnReservar = document.getElementById('btnReservar');
const msgReserva = document.getElementById('msgReserva');

// Set min dates
const hoy = new Date();
const hoyStr = hoy.toISOString().split('T')[0];
fechaIngreso.min = hoyStr;
fechaSalida.min = hoyStr;

fechaIngreso.addEventListener('change', () => {
  if (fechaIngreso.value) {
    const d = new Date(fechaIngreso.value + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    fechaSalida.min = d.toISOString().split('T')[0];
    if (fechaSalida.value && fechaSalida.value <= fechaIngreso.value) {
      fechaSalida.value = '';
    }
  }
});

btnBuscar.addEventListener('click', async () => {
  msgBuscar.textContent = '';
  msgBuscar.className = 'msg';
  habitacionesList.innerHTML = '';
  cardReserva.style.display = 'none';
  
  if (!fechaIngreso.value || !fechaSalida.value) {
    msgBuscar.textContent = 'Seleccione fecha de ingreso y salida';
    msgBuscar.className = 'msg error';
    return;
  }
  
  btnBuscar.disabled = true;
  btnBuscar.textContent = 'Buscando...';
  
  try {
    const res = await fetch(`/api/disponibilidad?fechaIngreso=${fechaIngreso.value}&fechaSalida=${fechaSalida.value}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error');
    
    if (!data.disponibles || data.disponibles.length === 0) {
      msgHab.textContent = 'No hay habitaciones disponibles para esas fechas';
      msgHab.className = 'msg error';
    } else {
      msgHab.textContent = `${data.disponibles.length} habitación(es) disponible(s)`;
      msgHab.className = 'msg success';
      data.disponibles.forEach(hab => {
        const div = document.createElement('div');
        div.className = 'hab-item disponible';
        div.innerHTML = `
          <div class="hab-info">
            <span class="hab-nombre">${hab.nombre}</span>
            <span class="hab-tipo">${hab.tipo || 'Habitación'}</span>
          </div>
          <span class="badge badge-ok">Disponible</span>
        `;
        div.addEventListener('click', () => {
          habSeleccionada.value = hab.id;
          habNombre.textContent = hab.nombre;
          cardReserva.style.display = 'block';
          cardReserva.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        habitacionesList.appendChild(div);
      });
    }
  } catch (e) {
    msgBuscar.textContent = e.message;
    msgBuscar.className = 'msg error';
  } finally {
    btnBuscar.disabled = false;
    btnBuscar.textContent = 'Buscar disponibilidad';
  }
});

btnReservar.addEventListener('click', async () => {
  msgReserva.textContent = '';
  msgReserva.className = 'msg';
  
  const nombre = document.getElementById('resNombre').value.trim();
  const telefono = document.getElementById('resTelefono').value.trim();
  const email = document.getElementById('resEmail').value.trim();
  const personas = document.getElementById('resPersonas').value;
  const observacion = document.getElementById('resObs').value.trim();
  
  if (!nombre || !telefono) {
    msgReserva.textContent = 'Nombre y teléfono son obligatorios';
    msgReserva.className = 'msg error';
    return;
  }
  
  btnReservar.disabled = true;
  btnReservar.textContent = 'Reservando...';
  
  try {
    const res = await fetch('/api/reservas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idHabitacion: habSeleccionada.value,
        fechaIngreso: fechaIngreso.value,
        fechaSalida: fechaSalida.value,
        nombre,
        telefono,
        email,
        personas,
        observacion
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al reservar');
    
    msgReserva.textContent = '¡Reserva creada exitosamente! Le contactaremos para confirmar.';
    msgReserva.className = 'msg success';
    document.getElementById('resNombre').value = '';
    document.getElementById('resTelefono').value = '';
    document.getElementById('resEmail').value = '';
    document.getElementById('resObs').value = '';
  } catch (e) {
    msgReserva.textContent = e.message;
    msgReserva.className = 'msg error';
  } finally {
    btnReservar.disabled = false;
    btnReservar.textContent = 'Confirmar Reserva';
  }
});
