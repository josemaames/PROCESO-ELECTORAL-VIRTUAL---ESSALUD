require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool, neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');

neonConfig.webSocketConstructor = ws; // túnel WebSocket (wss/443) en vez de TCP/5432 directo

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // POST de formulario (SSO desde SOMOS)

// ──────────────────────────────────────────────
// Conexión a Neon (Postgres)
// ──────────────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const SOMOS_API_URL = process.env.SOMOS_API_URL || 'http://localhost/api';
const VOTACION_FRONTEND_URL = process.env.VOTACION_FRONTEND_URL || 'http://localhost:4400';
const ADMIN_DNIS = (process.env.VOTACION_ADMIN_DNIS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);
// TEMPORAL: permite votar varias veces con el mismo DNI para pruebas. Quitar/poner en false para producción.
const PERMITIR_VOTOS_REPETIDOS = process.env.PERMITIR_VOTOS_REPETIDOS === 'true';

// ──────────────────────────────────────────────
// Crear tablas + datos de ejemplo (idempotente)
// ──────────────────────────────────────────────
async function ensureSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS votacion_proceso (
      id_proceso       SERIAL PRIMARY KEY,
      titulo           VARCHAR(200) NOT NULL,
      descripcion      TEXT,
      condiciones_uso  TEXT,
      fecha_inicio     TIMESTAMP,
      fecha_fin        TIMESTAMP,
      estado           VARCHAR(20) NOT NULL DEFAULT 'abierto',
      created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS votacion_candidato (
      id_candidato SERIAL PRIMARY KEY,
      id_proceso   INTEGER NOT NULL REFERENCES votacion_proceso(id_proceso) ON DELETE CASCADE,
      numero       SMALLINT NOT NULL,
      nombre       VARCHAR(200) NOT NULL,
      cargo        VARCHAR(200),
      descripcion  TEXT,
      foto_url     VARCHAR(255),
      activo       BOOLEAN NOT NULL DEFAULT true,
      CONSTRAINT uq_cand_numero UNIQUE (id_proceso, numero)
    );
    CREATE TABLE IF NOT EXISTS votacion_padron (
      id_padron          SERIAL PRIMARY KEY,
      id_proceso         INTEGER NOT NULL REFERENCES votacion_proceso(id_proceso) ON DELETE CASCADE,
      dni_votante        VARCHAR(20) NOT NULL,
      nombre_votante     VARCHAR(200),
      red_votante        VARCHAR(150),
      acepto_condiciones BOOLEAN NOT NULL DEFAULT false,
      fecha_voto         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_padron_votante UNIQUE (id_proceso, dni_votante)
    );
    CREATE TABLE IF NOT EXISTS votacion_voto (
      id_voto      SERIAL PRIMARY KEY,
      id_proceso   INTEGER NOT NULL REFERENCES votacion_proceso(id_proceso) ON DELETE CASCADE,
      id_candidato INTEGER NOT NULL REFERENCES votacion_candidato(id_candidato) ON DELETE CASCADE,
      red_votante  VARCHAR(150),
      fecha        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS votacion_admin (
      id_admin   SERIAL PRIMARY KEY,
      dni        VARCHAR(20) NOT NULL UNIQUE,
      nombre     VARCHAR(200),
      activo     BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_cand_proceso   ON votacion_candidato(id_proceso);
    CREATE INDEX IF NOT EXISTS idx_padron_proceso ON votacion_padron(id_proceso);
    CREATE INDEX IF NOT EXISTS idx_voto_proceso   ON votacion_voto(id_proceso);
    CREATE INDEX IF NOT EXISTS idx_voto_candidato ON votacion_voto(id_candidato);
    CREATE INDEX IF NOT EXISTS idx_voto_red       ON votacion_voto(id_proceso, red_votante);
    CREATE INDEX IF NOT EXISTS idx_padron_red     ON votacion_padron(id_proceso, red_votante);
  `);

  // Semilla: un proceso abierto + 2 candidatos si no hay nada (para pruebas)
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM votacion_proceso');
  if (rows[0].n === 0) {
    const proc = await pool.query(
      `INSERT INTO votacion_proceso (titulo, descripcion, condiciones_uso, estado)
       VALUES ($1,$2,$3,'abierto') RETURNING id_proceso`,
      [
        'Elección de Representante de los Servidores — Comité de Planificación de la Capacitación',
        'Proceso electoral virtual no presencial de EsSalud (Anexo N° 01).',
        'Al continuar declaro que:\n\n1. Emitiré mi voto de forma personal, libre y voluntaria.\n2. Solo puedo votar UNA vez; el voto es secreto e irreversible.\n3. Acepto las condiciones de uso de la plataforma electoral de EsSalud.',
      ],
    );
    const idProc = proc.rows[0].id_proceso;
    await pool.query(
      `INSERT INTO votacion_candidato (id_proceso, numero, nombre, cargo) VALUES
       ($1, 1, 'Candidato 1', 'Servidor de EsSalud'),
       ($1, 2, 'Candidato 2', 'Servidor de EsSalud')`,
      [idProc],
    );
    console.log('Semilla creada: proceso', idProc, '+ 2 candidatos');
  }
}

async function esAdmin(dni) {
  if (!dni) return false;
  if (ADMIN_DNIS.includes(String(dni))) return true;
  const { rows } = await pool.query(
    'SELECT 1 FROM votacion_admin WHERE dni=$1 AND activo=true',
    [String(dni)],
  );
  return rows.length > 0;
}

// ──────────────────────────────────────────────
// Proceso activo + candidatos
// ──────────────────────────────────────────────
app.get('/api/proceso', async (req, res) => {
  try {
    const { rows: procs } = await pool.query(
      `SELECT * FROM votacion_proceso WHERE estado='abierto' ORDER BY id_proceso DESC LIMIT 1`,
    );
    if (!procs.length) return res.json({ proceso: null, candidatos: [] });
    const proceso = procs[0];
    const { rows: cands } = await pool.query(
      `SELECT id_candidato, numero, nombre, cargo, descripcion, foto_url
       FROM votacion_candidato WHERE id_proceso=$1 AND activo=true ORDER BY numero`,
      [proceso.id_proceso],
    );
    res.json({ proceso, candidatos: cands });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ¿El DNI ya votó en este proceso?
app.get('/api/estado-voto', async (req, res) => {
  try {
    const { dni, proceso } = req.query;
    if (!dni || !proceso) return res.status(400).json({ error: 'dni y proceso requeridos' });
    if (PERMITIR_VOTOS_REPETIDOS) return res.json({ yaVoto: false });
    const { rows } = await pool.query(
      'SELECT 1 FROM votacion_padron WHERE id_proceso=$1 AND dni_votante=$2',
      [proceso, String(dni)],
    );
    res.json({ yaVoto: rows.length > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// Emitir voto (transacción: padrón + voto anónimo)
// ──────────────────────────────────────────────
app.post('/api/votar', async (req, res) => {
  const client = await pool.connect();
  try {
    const { dni, nombre, red, id_candidato, id_proceso, acepto } = req.body;
    if (!dni || !id_candidato || !id_proceso) {
      return res.status(400).json({ error: 'dni, id_candidato e id_proceso son requeridos' });
    }
    if (!acepto) {
      return res.status(400).json({ error: 'Debe aceptar las condiciones de uso.' });
    }

    // Validar que el candidato pertenezca al proceso
    const cand = await client.query(
      'SELECT 1 FROM votacion_candidato WHERE id_candidato=$1 AND id_proceso=$2',
      [id_candidato, id_proceso],
    );
    if (!cand.rows.length) return res.status(400).json({ error: 'Candidato inválido.' });

    await client.query('BEGIN');
    // 1) Registrar en el padrón (bloquea el doble voto por el UNIQUE)
    await client.query(
      `INSERT INTO votacion_padron (id_proceso, dni_votante, nombre_votante, red_votante, acepto_condiciones)
       VALUES ($1,$2,$3,$4,true)
       ${PERMITIR_VOTOS_REPETIDOS ? 'ON CONFLICT (id_proceso, dni_votante) DO NOTHING' : ''}`,
      [id_proceso, String(dni), nombre || null, red || null],
    );
    // 2) Registrar el voto ANÓNIMO (sin dni)
    await client.query(
      `INSERT INTO votacion_voto (id_proceso, id_candidato, red_votante) VALUES ($1,$2,$3)`,
      [id_proceso, id_candidato, red || null],
    );
    await client.query('COMMIT');
    res.status(201).json({ ok: true, mensaje: 'Voto registrado correctamente.' });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Ya has emitido tu voto en este proceso.' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ──────────────────────────────────────────────
// Estadísticas (solo maestro)
// ──────────────────────────────────────────────
app.get('/api/estadisticas', async (req, res) => {
  try {
    const { proceso, dni } = req.query;
    if (!proceso) return res.status(400).json({ error: 'proceso requerido' });
    if (!(await esAdmin(dni))) {
      return res.status(403).json({ error: 'No autorizado. Solo el maestro puede ver estadísticas.' });
    }

    const [total, porCandidato, porRed, participacion] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS n FROM votacion_voto WHERE id_proceso=$1', [proceso]),
      pool.query(
        `SELECT c.id_candidato, c.numero, c.nombre, COUNT(v.id_voto)::int AS votos
         FROM votacion_candidato c
         LEFT JOIN votacion_voto v ON v.id_candidato = c.id_candidato AND v.id_proceso = c.id_proceso
         WHERE c.id_proceso=$1
         GROUP BY c.id_candidato, c.numero, c.nombre
         ORDER BY c.numero`,
        [proceso],
      ),
      pool.query(
        `SELECT COALESCE(v.red_votante,'Sin Red') AS red, c.numero, c.nombre, COUNT(*)::int AS votos
         FROM votacion_voto v
         JOIN votacion_candidato c ON c.id_candidato = v.id_candidato
         WHERE v.id_proceso=$1
         GROUP BY COALESCE(v.red_votante,'Sin Red'), c.numero, c.nombre
         ORDER BY red, c.numero`,
        [proceso],
      ),
      pool.query('SELECT COUNT(*)::int AS n FROM votacion_padron WHERE id_proceso=$1', [proceso]),
    ]);

    res.json({
      totalVotos: total.rows[0].n,
      participacion: participacion.rows[0].n,
      porCandidato: porCandidato.rows,
      porRed: porRed.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──────────────────────────────────────────────
// SSO con SOMOS — ingreso sin re-login (igual que PDP)
// ──────────────────────────────────────────────
app.post('/api/sso/ingreso', async (req, res) => {
  try {
    const token = req.body.token;
    if (!token) return res.status(400).send('Falta el token de ingreso.');

    const resp = await fetch(
      `${SOMOS_API_URL}/personal/validar-token?token=${encodeURIComponent(token)}`,
      { method: 'POST' },
    );
    const datos = await resp.json();
    if (!datos || !datos.success) {
      return res.status(401).send(
        'No se pudo validar la sesión de SOMOS: ' + (datos && datos.mensaje ? datos.mensaje : 'token inválido'),
      );
    }

    const sesion = {
      dni: datos.dni,
      nombre: `${datos.nombres || ''} ${datos.apellidos || ''}`.trim(),
      correo: datos.correo,
      red: datos.dependencia || null, // Red Prestacional del votante
      esAdmin: await esAdmin(datos.dni),
    };

    const payload = Buffer.from(JSON.stringify(sesion), 'utf8').toString('base64');
    return res.redirect(`${VOTACION_FRONTEND_URL}/sso?u=${encodeURIComponent(payload)}`);
  } catch (err) {
    console.error('Error en SSO ingreso (votación):', err);
    return res.status(500).send('Error al procesar el ingreso SSO.');
  }
});

// ──────────────────────────────────────────────
// Iniciar
// ──────────────────────────────────────────────
const PORT = process.env.PORT || 3002;
ensureSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`Backend Votación en http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('No se pudo inicializar la base de datos:', err);
    process.exit(1);
  });
