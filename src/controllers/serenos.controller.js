import pool from "../config/db.js";

// GET /api/serenos/disponibles
export const getSerenosDisponibles = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        u.id as id_usuario,
        u.nombres,
        u.apellidos,
        s.estado_disponibilidad,
        ST_Y(s.ubicacion_actual::geometry) as lat,
        ST_X(s.ubicacion_actual::geometry) as lng,
        s.ultima_actualizacion_gps
      FROM serenos s
      JOIN usuarios u ON s.usuario_id = u.id
      WHERE s.estado_disponibilidad = 'DISPONIBLE'
        AND u.activo = true
      ORDER BY u.nombres ASC
      `,
    );

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
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};

// GET /api/serenos/cercanos
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

    // Consulta con PostGIS para distancia geográfica (en metros)
    // NOTA: Para OSRM real, esto debería llamar a un servicio externo
    const result = await pool.query(
      `
      SELECT 
        u.id as id_usuario,
        u.nombres,
        u.apellidos,
        s.estado_disponibilidad,
        ST_Y(s.ubicacion_actual::geometry) as lat_sereno,
        ST_X(s.ubicacion_actual::geometry) as lng_sereno,
        ST_DistanceSphere(
          s.ubicacion_actual, 
          ST_SetSRID(ST_MakePoint($1, $2), 4326)
        ) as distancia_mts
      FROM serenos s
      JOIN usuarios u ON s.usuario_id = u.id
      WHERE s.estado_disponibilidad = 'DISPONIBLE'
        AND u.activo = true
      ORDER BY distancia_mts ASC
      LIMIT $3
      `,
      [lng, lat, limit],
    );

    // Calcular tiempo estimado (asumiendo velocidad promedio 20 km/h = 333 m/min)
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
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};
