import pool from "../config/db.js";

// GET /api/serenos/disponibles
export const getSerenosDisponibles = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id AS id_usuario,
        u.nombres,
        u.apellidos,
        s.estado_disponibilidad,
        ST_Y(s.ubicacion_actual::geometry) AS lat,
        ST_X(s.ubicacion_actual::geometry) AS lng,
        s.ultima_actualizacion_gps
      FROM serenos s
      JOIN usuarios u ON s.id_usuario = u.id
      WHERE s.estado_disponibilidad = 'DISPONIBLE'
        AND u.activo = true
      ORDER BY u.nombres ASC
    `);

    const serenos = result.rows.map((row) => ({
      id_usuario: row.id_usuario,
      nombres: row.nombres,
      apellidos: row.apellidos,
      estado_disponibilidad: row.estado_disponibilidad,
      ubicacion_actual: {
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
      },
      ultima_actualizacion_gps: row.ultima_actualizacion_gps,
    }));

    return res.status(200).json(serenos);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Error interno del servidor",
      data: null,
    });
  }
};

export const getSerenosCercanos = async (req, res) => {
  try {
    const { lat, lng, limit = 5 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Los parámetros lat y lng son requeridos",
        data: null,
      });
    }

    const result = await pool.query(
      `
      SELECT 
        u.id AS id_usuario,
        u.nombres,
        u.apellidos,
        s.estado_disponibilidad,
        ST_Y(s.ubicacion_actual::geometry) AS lat_sereno,
        ST_X(s.ubicacion_actual::geometry) AS lng_sereno,
        ST_DistanceSphere(
          s.ubicacion_actual, 
          ST_SetSRID(ST_MakePoint($1, $2), 4326)
        ) AS distancia_mts
      FROM serenos s
      JOIN usuarios u ON s.id_usuario = u.id
      WHERE s.estado_disponibilidad = 'DISPONIBLE'
        AND u.activo = true
      ORDER BY distancia_mts ASC
      LIMIT $3
      `,
      [lng, lat, limit],
    );

    const serenos = result.rows.map((row) => ({
      id_usuario: row.id_usuario,
      nombres: row.nombres,
      apellidos: row.apellidos,
      estado_disponibilidad: row.estado_disponibilidad,
      ubicacion_actual: {
        lat: parseFloat(row.lat_sereno),
        lng: parseFloat(row.lng_sereno),
      },
      distancia_estimada_mts: Math.round(row.distancia_mts),
      tiempo_estimado_llegada_min: Math.max(
        1,
        Math.round(row.distancia_mts / 333),
      ),
    }));

    return res.status(200).json(serenos);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Error interno del servidor",
      data: null,
    });
  }
};

// PATCH /api/serenos/estado
export const cambiarEstadoSereno = async (req, res) => {
  try {
    const id_usuario = req.user?.id || 5; // Default for testing if no JWT
    const { estado } = req.body;

    const validStates = ['DISPONIBLE', 'OCUPADO', 'INACTIVO'];
    if (!validStates.includes(estado)) {
      return res.status(400).json({
        success: false,
        message: "Estado inválido.",
      });
    }

    await pool.query(
      `
      UPDATE serenos
      SET estado_disponibilidad = $1
      WHERE id_usuario = $2
      `,
      [estado, id_usuario]
    );

    return res.status(200).json({
      success: true,
      message: "Estado de disponibilidad actualizado",
      data: {
        nuevo_estado: estado,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error interno del servidor: ${error.message}`,
      data: null,
    });
  }
};

// POST /api/serenos/ubicacion
export const actualizarUbicacion = async (req, res) => {
  try {
    const id_usuario = req.user?.id || 5;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        message: "Latitud y longitud son requeridas.",
      });
    }

    await pool.query(
      `
      UPDATE serenos
      SET ubicacion_actual = ST_SetSRID(ST_MakePoint($1, $2), 4326),
          ultima_actualizacion_gps = NOW()
      WHERE id_usuario = $3
      `,
      [longitude, latitude, id_usuario]
    );

    return res.status(200).json({
      success: true,
      message: "Ubicación espacial persistida.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error interno del servidor: ${error.message}`,
      data: null,
    });
  }
};

