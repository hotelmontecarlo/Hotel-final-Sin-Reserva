const express = require('express');
const crypto = require('crypto');
const serverless = require('serverless-http');
const { google } = require('googleapis');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const PIN = process.env.ACCESS_PIN || '';
const SECRET = process.env.AUTH_SECRET || PIN || 'hotel-montecarlo-secret';
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '';

const HABITACIONES_TAB = 'Habitaciones';
const RESERVAS_TAB = 'Reservas';
const USUARIOS_TAB = 'Usuarios';

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

function signToken(payload) {
  const b = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
  return b + '.' + sig;
}

function verifyToken(token) {
  try {
    const parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    const [b, sig] = parts;
    if (!b) return null;
    const expected = crypto.createHmac('sha256', SECRET).update(b).digest('base64url');
    const a = Buffer.from(sig);
    const e = Buffer.from(expected);
    if (a.length !== e.length || !crypto.timingSafeEqual(a, e)) return null;
    const payload = JSON.parse(Buffer.from(b, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (err) {
    return null;
  }
}

function requireToken(req) {
  const auth = String(req.headers['authorization'] || '');
  return verifyToken(auth.replace(/^Bearer\s+/i, ''));
}

function requireAdmin(req) {
  const p = requireToken(req);
  if (!p) return null;
  return String(p.rol).toLowerCase() === 'admin' ? p : null;
}

const SA_JSON = process.env.GOOGLE_CREDENTIALS_JSON || '';
const SA_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || '';
const SA_KEY = process.env.GOOGLE_PRIVATE_KEY || '';

function serviceAccount() {
  if (SA_JSON) {
    const candidates = [SA_JSON];
    try { candidates.push(JSON.parse(SA_JSON)); } catch (e) {}
    for (const c of candidates) {
      try {
        const obj = typeof c === 'string' ? JSON.parse(c) : c;
        if (obj && obj.client_email && obj.private_key) return obj;
      } catch (e) {}
    }
  }
  if (SA_EMAIL && SA_KEY) return { client_email: SA_EMAIL, private_key: SA_KEY };
  return null;
}

async function getSheets() {
  const sa = serviceAccount();
  if (!sa || !sa.client_email || !sa.private_key) {
    throw new Error('Falta configurar las credenciales de Google');
  }
  const client = new google.auth.JWT(
    sa.client_email,
    null,
    sa.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth: client });
}

function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(salt + ':' + password).digest('hex');
}

async function ensureUsuarios() {
  const sheets = await getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: USUARIOS_TAB
    });
    const rows = res.data.values || [];
    if (rows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: USUARIOS_TAB + '!A1:G1',
        valueInputOption: 'RAW',
        resource: { values: [['id_usuario', 'usuario', 'contraseña', 'correo', 'rol', 'salt', 'creado']] }
      });
    }
  } catch (err) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties' });
    const titles = (meta.data.sheets || []).map((s) => (s.properties || {}).title);
    if (!titles.includes(USUARIOS_TAB)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: USUARIOS_TAB } } }] }
      });
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: USUARIOS_TAB + '!A1:G1',
      valueInputOption: 'RAW',
      resource: { values: [['id_usuario', 'usuario', 'contraseña', 'correo', 'rol', 'salt', 'creado']] }
    });
  }
}

async function readUsuarios() {
  await ensureUsuarios();
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: USUARIOS_TAB
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];
  const head = rows[0];
  const col = (name) => head.findIndex((h) => String(h).toLowerCase() === name.toLowerCase());
  const ci = col('id_usuario'), ui = col('usuario'), pi = col('contraseña'), mi = col('correo'), ri = col('rol'), si = col('salt'), ti = col('creado');
  const get = (r, i) => (i >= 0 && r[i] !== undefined && r[i] !== null) ? String(r[i]) : '';
  return rows.slice(1).filter((r) => get(r, ui).trim() !== '').map((r) => ({
    id: get(r, ci), usuario: get(r, ui), hash: get(r, pi), correo: get(r, mi), rol: get(r, ri) || 'usuario', salt: get(r, si), creado: get(r, ti)
  }));
}

async function ensureHabitaciones() {
  const sheets = await getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: HABITACIONES_TAB
    });
    const rows = res.data.values || [];
    if (rows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: HABITACIONES_TAB + '!A1:D1',
        valueInputOption: 'RAW',
        resource: { values: [['id_habitacion', 'nombre', 'tipo', 'activa']] }
      });
      // Default rooms
      await sheets.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: HABITACIONES_TAB + '!A1:D1',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [
          ['1', 'Habitación 1', 'Doble', 'SI'],
          ['2', 'Habitación 2', 'Doble', 'SI'],
          ['3', 'Habitación 3', 'Doble', 'SI'],
          ['4', 'Habitación 4', 'Doble', 'SI'],
          ['5', 'Habitación 5', 'Triple', 'SI'],
          ['6', 'Habitación 6', 'Triple', 'SI']
        ] }
      });
    }
  } catch (err) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties' });
    const titles = (meta.data.sheets || []).map((s) => (s.properties || {}).title);
    if (!titles.includes(HABITACIONES_TAB)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: HABITACIONES_TAB } } }] }
      });
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: HABITACIONES_TAB + '!A1:D1',
      valueInputOption: 'RAW',
      resource: { values: [['id_habitacion', 'nombre', 'tipo', 'activa']] }
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: HABITACIONES_TAB + '!A1:D1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [
        ['1', 'Habitación 1', 'Doble', 'SI'],
        ['2', 'Habitación 2', 'Doble', 'SI'],
        ['3', 'Habitación 3', 'Doble', 'SI'],
        ['4', 'Habitación 4', 'Doble', 'SI'],
        ['5', 'Habitación 5', 'Triple', 'SI'],
        ['6', 'Habitación 6', 'Triple', 'SI']
      ] }
    });
  }
}

async function readHabitaciones() {
  await ensureHabitaciones();
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: HABITACIONES_TAB
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];
  const head = rows[0];
  const col = (name) => head.findIndex((h) => String(h).toLowerCase() === name.toLowerCase());
  const ii = col('id_habitacion'), ni = col('nombre'), ti = col('tipo'), ai = col('activa');
  const get = (r, i) => (i >= 0 && r[i] !== undefined && r[i] !== null) ? String(r[i]) : '';
  return rows.slice(1).map((r) => ({
    id: get(r, ii), nombre: get(r, ni), tipo: get(r, ti), activa: get(r, ai).toUpperCase() !== 'NO'
  })).filter(h => h.nombre.trim() !== '');
}

async function ensureReservas() {
  const sheets = await getSheets();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: RESERVAS_TAB
    });
    const rows = res.data.values || [];
    if (rows.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: RESERVAS_TAB + '!A1:N1',
        valueInputOption: 'RAW',
        resource: { values: [['id_reserva', 'id_habitacion', 'habitacion', 'fecha_ingreso', 'fecha_salida', 'hora_ingreso', 'hora_salida', 'nombre', 'telefono', 'email', 'personas', 'estado', 'transferido', 'observacion', 'creado', 'actualizado']] }
      });
    }
  } catch (err) {
    const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID, fields: 'sheets.properties' });
    const titles = (meta.data.sheets || []).map((s) => (s.properties || {}).title);
    if (!titles.includes(RESERVAS_TAB)) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID,
        requestBody: { requests: [{ addSheet: { properties: { title: RESERVAS_TAB } } }] }
      });
    }
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: RESERVAS_TAB + '!A1:N1',
      valueInputOption: 'RAW',
      resource: { values: [['id_reserva', 'id_habitacion', 'habitacion', 'fecha_ingreso', 'fecha_salida', 'nombre', 'telefono', 'email', 'personas', 'estado', 'transferido', 'observacion', 'creado', 'actualizado']] }
    });
  }
}

async function readReservas() {
  await ensureReservas();
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: RESERVAS_TAB
  });
  const rows = res.data.values || [];
  if (rows.length < 2) return [];
  const head = rows[0];
  const col = (name) => head.findIndex((h) => String(h).toLowerCase() === name.toLowerCase());
  const ci = col('id_reserva'), hi = col('id_habitacion'), hn = col('habitacion'), fi = col('fecha_ingreso'), fo = col('fecha_salida'), hi2 = col('hora_ingreso'), hs = col('hora_salida'), no = col('nombre'), te = col('telefono'), em = col('email'), pe = col('personas'), es = col('estado'), tr = col('transferido'), ob = col('observacion'), cr = col('creado'), ac = col('actualizado');
  const get = (r, i) => (i >= 0 && r[i] !== undefined && r[i] !== null) ? String(r[i]) : '';
  return rows.slice(1).filter((r) => get(r, fi).trim() !== '').map((r) => ({
    id: get(r, ci),
    idHabitacion: get(r, hi),
    habitacion: get(r, hn),
    fechaIngreso: get(r, fi),
    fechaSalida: get(r, fo),
    horaIngreso: get(r, hi2),
    horaSalida: get(r, hs),
    nombre: get(r, no),
    telefono: get(r, te),
    email: get(r, em),
    personas: get(r, pe),
    estado: (get(r, es) || 'RESERVADA').toUpperCase(),
    transferido: get(r, tr).toUpperCase() === 'SI',
    observacion: get(r, ob),
    creado: get(r, cr),
    actualizado: get(r, ac)
  }));
}

function parseDate(d) {
  if (!d) return null;
  // expect YYYY-MM-DD
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const dt = new Date(Date.UTC(Number(m[1]), Number(m[2])-1, Number(m[3])));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? null : dt;
}

function toDateOnly(d) {
  const dt = parseDate(d);
  if (!dt) return null;
  return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
}

function overlap(aIn, aOut, bIn, bOut) {
  const x1 = toDateOnly(aIn), x2 = toDateOnly(aOut);
  const y1 = toDateOnly(bIn), y2 = toDateOnly(bOut);
  if (!x1 || !x2 || !y1 || !y2) return false;
  // reserva ocupa desde ingreso inclusive? salida exclusive or inclusive depending; treat as night stay - if same day not usual, but overlap if ranges intersect
  // standard: [x1, x2) overlaps with [y1, y2)
  return x1 < y2 && y1 < x2;
}

// Auth
app.post('/api/login', async (req, res) => {
  const { usuario, password } = req.body || {};
  if (!usuario || !password) return res.status(400).json({ error: 'Faltan datos' });
  try {
    const users = await readUsuarios();
    const q = String(usuario).trim().toLowerCase();
    const u = users.find((x) => x.usuario.toLowerCase() === q || (x.correo && x.correo.toLowerCase() === q));
    if (!u) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    if (u.hash !== hashPassword(String(password), u.salt)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    const exp = Date.now() + TOKEN_TTL_MS;
    const rol = String(u.rol || 'usuario').toLowerCase() === 'admin' ? 'admin' : 'usuario';
    return res.json({ token: signToken({ exp, sub: u.usuario, rol }), usuario: u.usuario, rol, exp });
  } catch (err) {
    return res.status(500).json({ error: 'Error: ' + err.message });
  }
});

// Public
app.get('/api/habitaciones', async (req, res) => {
  try {
    const habs = await readHabitaciones();
    return res.json(habs.filter(h => h.activa));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/disponibilidad', async (req, res) => {
  const { fechaIngreso, fechaSalida } = req.query || {};
  if (!fechaIngreso || !fechaSalida) return res.status(400).json({ error: 'Faltan fechas' });
  try {
    const [habs, reservas] = await Promise.all([readHabitaciones(), readReservas()]);
    const activas = habs.filter(h => h.activa);
    const ocupadas = new Set();
    reservas.forEach(r => {
      if (r.estado === 'CANCELADA') return;
      if (overlap(fechaIngreso, fechaSalida, r.fechaIngreso, r.fechaSalida)) {
        ocupadas.add(String(r.idHabitacion));
      }
    });
    const disponibles = activas.filter(h => !ocupadas.has(String(h.id)));
    return res.json({ disponibles, ocupadas: Array.from(ocupadas) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/calendario', async (req, res) => {
  const { mes, anio } = req.query || {};
  try {
    const [habs, reservas] = await Promise.all([readHabitaciones(), readReservas()]);
    const activas = habs.filter(h => h.activa);
    // build events by date range
    const events = reservas
      .filter(r => r.estado !== 'CANCELADA')
      .map(r => ({
        id: r.id,
        habitacionId: r.idHabitacion,
        habitacion: r.habitacion,
        inicio: r.fechaIngreso,
        fin: r.fechaSalida,
        nombre: r.nombre,
        telefono: r.telefono,
        estado: r.estado,
        transferido: r.transferido
      }));
    return res.json({ habitaciones: activas, reservas: events });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/reservas', async (req, res) => {
  const body = req.body || {};
  const { idHabitacion, fechaIngreso, fechaSalida, horaIngreso, horaSalida, nombre, telefono, email, personas, observacion } = body;
  if (!idHabitacion || !fechaIngreso || !fechaSalida || !nombre || !telefono) {
    return res.status(400).json({ error: 'Faltan datos obligatorios' });
  }
  try {
    const [habs, reservas] = await Promise.all([readHabitaciones(), readReservas()]);
    const hab = habs.find(h => String(h.id) === String(idHabitacion));
    if (!hab || !hab.activa) return res.status(400).json({ error: 'Habitación no válida' });
    // check overlap
    const ocupado = reservas.some(r => r.estado !== 'CANCELADA' && String(r.idHabitacion) === String(idHabitacion) && overlap(fechaIngreso, fechaSalida, r.fechaIngreso, r.fechaSalida));
    if (ocupado) return res.status(409).json({ error: 'Habitación no disponible en esas fechas' });
    const sheets = await getSheets();
    await ensureReservas();
    // get next id
    const rowsRes = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RESERVAS_TAB });
    const rows = rowsRes.data.values || [];
    let nextId = 1;
    if (rows.length > 1) {
      rows.slice(1).forEach(r => {
        const n = parseInt(r[0], 10);
        if (!isNaN(n) && n >= nextId) nextId = n + 1;
      });
    }
    const now = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: RESERVAS_TAB + '!A1:P1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [[String(nextId), String(hab.id), hab.nombre, fechaIngreso, fechaSalida, horaIngreso || '', horaSalida || '', nombre, telefono, email || '', personas || '', 'RESERVADA', 'NO', observacion || '', now, now]] }
    });
    return res.json({ ok: true, id: nextId });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin
app.get('/api/admin/reservas', async (req, res) => {
  if (!requireAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  try {
    const reservas = await readReservas();
    return res.json(reservas);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/reservas/:id/estado', async (req, res) => {
  if (!requireAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  const { id } = req.params;
  const { estado } = req.body || {};
  const estadosValidos = ['RESERVADA', 'CONFIRMADA', 'TRANSFERIDO', 'CANCELADA', 'LIBERADA'];
  if (!estadosValidos.includes(String(estado).toUpperCase())) {
    return res.status(400).json({ error: 'Estado no válido' });
  }
  try {
    const sheets = await getSheets();
    const resRows = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RESERVAS_TAB });
    const rows = resRows.data.values || [];
    const head = rows[0] || [];
    const ii = head.findIndex(h => String(h).toLowerCase() === 'id_reserva');
    const ei = head.findIndex(h => String(h).toLowerCase() === 'estado');
    if (ii < 0 || ei < 0) throw new Error('Estructura inválida');
    const rowIndex = rows.findIndex((r, idx) => idx > 0 && String(r[ii] || '').trim() === String(id).trim());
    if (rowIndex <= 0) return res.status(404).json({ error: 'Reserva no encontrada' });
    const rn = rowIndex + 1;
    const col = String.fromCharCode(65 + ei);
    const now = new Date().toISOString();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${RESERVAS_TAB}!${col}${rn}`,
      valueInputOption: 'RAW',
      resource: { values: [[String(estado).toUpperCase()]] }
    });
    // update actualizado
    const ai = head.findIndex(h => String(h).toLowerCase() === 'actualizado');
    if (ai >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${RESERVAS_TAB}!${String.fromCharCode(65 + ai)}${rn}`,
        valueInputOption: 'RAW',
        resource: { values: [[now]] }
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/reservas/:id/transferido', async (req, res) => {
  if (!requireAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  const { id } = req.params;
  const { transferido } = req.body || {};
  try {
    const sheets = await getSheets();
    const resRows = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RESERVAS_TAB });
    const rows = resRows.data.values || [];
    const head = rows[0] || [];
    const ii = head.findIndex(h => String(h).toLowerCase() === 'id_reserva');
    const ti = head.findIndex(h => String(h).toLowerCase() === 'transferido');
    if (ii < 0 || ti < 0) throw new Error('Estructura inválida');
    const rowIndex = rows.findIndex((r, idx) => idx > 0 && String(r[ii] || '').trim() === String(id).trim());
    if (rowIndex <= 0) return res.status(404).json({ error: 'Reserva no encontrada' });
    const rn = rowIndex + 1;
    const col = String.fromCharCode(65 + ti);
    const now = new Date().toISOString();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${RESERVAS_TAB}!${col}${rn}`,
      valueInputOption: 'RAW',
      resource: { values: [[transferido ? 'SI' : 'NO']] }
    });
    const ai = head.findIndex(h => String(h).toLowerCase() === 'actualizado');
    if (ai >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${RESERVAS_TAB}!${String.fromCharCode(65 + ai)}${rn}`,
        valueInputOption: 'RAW',
        resource: { values: [[now]] }
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/reservas/:id/liberar', async (req, res) => {
  if (!requireAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  const { id } = req.params;
  try {
    const sheets = await getSheets();
    const resRows = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: RESERVAS_TAB });
    const rows = resRows.data.values || [];
    const head = rows[0] || [];
    const ii = head.findIndex(h => String(h).toLowerCase() === 'id_reserva');
    const ei = head.findIndex(h => String(h).toLowerCase() === 'estado');
    if (ii < 0 || ei < 0) throw new Error('Estructura inválida');
    const rowIndex = rows.findIndex((r, idx) => idx > 0 && String(r[ii] || '').trim() === String(id).trim());
    if (rowIndex <= 0) return res.status(404).json({ error: 'Reserva no encontrada' });
    const rn = rowIndex + 1;
    const col = String.fromCharCode(65 + ei);
    const now = new Date().toISOString();
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${RESERVAS_TAB}!${col}${rn}`,
      valueInputOption: 'RAW',
      resource: { values: [['LIBERADA']] }
    });
    const ti = head.findIndex(h => String(h).toLowerCase() === 'transferido');
    if (ti >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${RESERVAS_TAB}!${String.fromCharCode(65 + ti)}${rn}`,
        valueInputOption: 'RAW',
        resource: { values: [['NO']] }
      });
    }
    const ai = head.findIndex(h => String(h).toLowerCase() === 'actualizado');
    if (ai >= 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${RESERVAS_TAB}!${String.fromCharCode(65 + ai)}${rn}`,
        valueInputOption: 'RAW',
        resource: { values: [[now]] }
      });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});


// Setup: crear primer usuario admin (protegido por ACCESS_PIN)
app.post('/api/setup', async (req, res) => {
  const { pin, usuario, password, correo } = req.body || {};
  const setupPin = process.env.ACCESS_PIN || '';
  if (!setupPin || pin !== setupPin) {
    return res.status(401).json({ error: 'PIN de setup incorrecto' });
  }
  try {
    await ensureUsuarios();
    const users = await readUsuarios();
    if (users.length > 0) {
      return res.status(400).json({ error: 'Ya existen usuarios. Use el panel admin.' });
    }
    const sheets = await getSheets();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(String(password || 'admin123'), salt);
    const now = new Date().toISOString();
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: USUARIOS_TAB + '!A1:G1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [['1', String(usuario || 'admin').trim(), hash, correo || '', 'admin', salt, now]] }
    });
    return res.json({ ok: true, usuario: usuario || 'admin' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin: crear usuario
app.post('/api/admin/usuarios', async (req, res) => {
  if (!requireAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  const { usuario, password, correo, rol } = req.body || {};
  if (!usuario || !password) return res.status(400).json({ error: 'Faltan datos' });
  try {
    await ensureUsuarios();
    const users = await readUsuarios();
    const q = String(usuario).trim().toLowerCase();
    if (users.find(u => u.usuario.toLowerCase() === q)) {
      return res.status(400).json({ error: 'Usuario ya existe' });
    }
    const sheets = await getSheets();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(String(password), salt);
    const now = new Date().toISOString();
    let nextId = 1;
    users.forEach(u => { const n = parseInt(u.id, 10); if (!isNaN(n) && n >= nextId) nextId = n + 1; });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: USUARIOS_TAB + '!A1:G1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [[String(nextId), String(usuario).trim(), hash, correo || '', (rol || 'usuario'), salt, now]] }
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

module.exports = app;
module.exports.handler = serverless(app);
