import pool from "../config/db.js";

// GET /api/historial
export const getHistorial = async (req, res) => {
  try {
    const {
      estado,
      fecha_inicio,
      fecha_fin,
      sereno_id,
      page = 1,
      limit = 20,
    } = req.query;

    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        a.id,
        a.created_at,
        a.updated_at,
        a.estado_actual AS estado_final,

        u.nombres AS ciudadano_nombres,
        u.apellidos AS ciudadano_apellidos,
        u.celular AS ciudadano_celular,

        s.id_usuario AS sereno_id,
        u2.nombres AS sereno_nombres,
        u2.apellidos AS sereno_apellidos

      FROM alertas a
      JOIN usuarios u ON a.ciudadano_id = u.id

      LEFT JOIN asignaciones_sereno asig 
        ON a.id = asig.alerta_id

      LEFT JOIN serenos s 
        ON asig.sereno_id = s.id_usuario

      LEFT JOIN usuarios u2 
        ON s.id_usuario = u2.id

      WHERE a.estado_actual IN ('ATENDIDO', 'RECHAZADO')
    `;

    const queryParams = [];
    let paramIndex = 1;

    if (estado) {
      query += ` AND a.estado_actual = $${paramIndex++}`;
      queryParams.push(estado);
    }

    if (fecha_inicio) {
      query += ` AND a.created_at >= $${paramIndex++}`;
      queryParams.push(fecha_inicio);
    }

    if (fecha_fin) {
      query += ` AND a.created_at <= $${paramIndex++}`;
      queryParams.push(fecha_fin);
    }

    if (sereno_id) {
      query += ` AND s.id_usuario = $${paramIndex++}`;
      queryParams.push(sereno_id);
    }

    const countQuery = `
      SELECT COUNT(*) as total
      FROM (${query}) sub
    `;

    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    query += `
      ORDER BY a.created_at DESC
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex++}
    `;

    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    const data = result.rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      estado_final: row.estado_final,

      ciudadano: {
        nombre_completo: `${row.ciudadano_nombres} ${row.ciudadano_apellidos}`,
        celular: row.ciudadano_celular,
      },

      sereno_interviniente: row.sereno_id
        ? {
            id_usuario: row.sereno_id,
            nombre_completo: `${row.sereno_nombres} ${row.sereno_apellidos}`,
          }
        : null,
    }));

    return res.status(200).json({
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Error interno del servidor",
      data: null,
    });
  }
};

export const getDetalleCaso = async (req, res) => {
  try {
    const { id } = req.params;

    const alertaResult = await pool.query(
      `
      SELECT id, estado_actual, created_at
      FROM alertas
      WHERE id = $1
      `,
      [id],
    );

    if (alertaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Caso no encontrado",
        data: null,
      });
    }

    const alerta = alertaResult.rows[0];

    // historial correcto
    const historialResult = await pool.query(
      `
      SELECT 
        estado,
        fecha_hora,
        actor_id
      FROM historial_alertas
      WHERE alerta_id = $1
      ORDER BY fecha_hora ASC
      `,
      [id],
    );

    const trazabilidad = historialResult.rows;

    // formulario
    const formularioResult = await pool.query(
      `
      SELECT 
        rf.formulario_id,
        fc.titulo,
        rf.respuestas_jsonb
      FROM respuestas_formulario rf
      JOIN formularios_config fc ON rf.formulario_id = fc.id
      WHERE rf.alerta_id = $1
      AND fc.identificador = 'cierre_sereno'
      `,
      [id],
    );

    // rechazo
    const rechazoResult = await pool.query(
      `
      SELECT 
        categoria_rechazo,
        motivo_detalle,
        fecha_hora
      FROM rechazos_alerta
      WHERE alerta_id = $1
      `,
      [id],
    );

    return res.status(200).json({
      id: parseInt(id),
      estado_final: alerta.estado_actual,
      trazabilidad,
      formulario_cierre_sereno: formularioResult.rows[0] || null,
      rechazo_data: rechazoResult.rows[0] || null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Error interno del servidor",
      data: null,
    });
  }
};
