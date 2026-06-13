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
        a.estado_actual as estado_final,
        u.nombres as ciudadano_nombres,
        u.apellidos as ciudadano_apellidos,
        u.celular as ciudadano_celular,
        s.usuario_id as sereno_id,
        u2.nombres as sereno_nombres,
        u2.apellidos as sereno_apellidos
      FROM alertas a
      JOIN usuarios u ON a.ciudadano_id = u.id
      LEFT JOIN asignaciones_sereno asig ON a.id = asig.alerta_id
      LEFT JOIN serenos s ON asig.sereno_id = s.usuario_id
      LEFT JOIN usuarios u2 ON s.usuario_id = u2.id
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
      query += ` AND s.usuario_id = $${paramIndex++}`;
      queryParams.push(sereno_id);
    }

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (${query}) as subquery
    `;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Add pagination
    query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    const data = result.rows.map((row) => ({
      id: row.id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      estado_final: row.estado_final,
      ciudadano: {
        nombre_completo:
          `${row.ciudadano_nombres || ""} ${row.ciudadano_apellidos || ""}`.trim(),
        celular: row.ciudadano_celular,
      },
      sereno_interviniente: row.sereno_id
        ? {
            id_usuario: row.sereno_id,
            nombre_completo:
              `${row.sereno_nombres || ""} ${row.sereno_apellidos || ""}`.trim(),
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
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};

// GET /api/historial/:id/caso
export const getDetalleCaso = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Obtener datos básicos de la alerta
    const alertaResult = await pool.query(
      `
      SELECT 
        id,
        estado_actual as estado_final,
        created_at
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

    // 2. Obtener trazabilidad del historial
    const historialResult = await pool.query(
      `
      SELECT 
        ha.estado,
        ha.fecha_hora,
        ha.actor,
        CASE 
          WHEN ha.actor = 'CIUDADANO' THEN u_ciu.nombres || ' ' || u_ciu.apellidos
          WHEN ha.actor = 'OPERADOR' THEN u_op.nombres || ' ' || u_op.apellidos
          WHEN ha.actor = 'SERENO' THEN u_ser.nombres || ' ' || u_ser.apellidos
          ELSE ha.actor
        END as actor_nombre
      FROM historial_alertas ha
      LEFT JOIN usuarios u_ciu ON ha.actor = 'CIUDADANO' AND u_ciu.id = ha.actor_id
      LEFT JOIN usuarios u_op ON ha.actor = 'OPERADOR' AND u_op.id = ha.actor_id
      LEFT JOIN usuarios u_ser ON ha.actor = 'SERENO' AND u_ser.id = ha.actor_id
      WHERE ha.alerta_id = $1
      ORDER BY ha.fecha_hora ASC
      `,
      [id],
    );

    const trazabilidad = historialResult.rows.map((row) => ({
      estado: row.estado,
      actor: row.actor_nombre || row.actor,
      fecha_hora: row.fecha_hora,
    }));

    // 3. Obtener formulario de cierre (si existe)
    const formularioResult = await pool.query(
      `
      SELECT 
        rf.formulario_id,
        fc.titulo,
        rf.respuestas
      FROM respuestas_formulario rf
      JOIN formularios_config fc ON rf.formulario_id = fc.id
      WHERE rf.alerta_id = $1
        AND fc.identificador = 'cierre_sereno'
      `,
      [id],
    );

    // 4. Obtener datos de rechazo (si existe)
    const rechazoResult = await pool.query(
      `
      SELECT 
        categoria,
        motivo_detalle,
        rechazado_en
      FROM rechazos_alerta
      WHERE alerta_id = $1
      `,
      [id],
    );

    const response = {
      id: parseInt(id),
      estado_final: alerta.estado_final,
      trazabilidad,
      formulario_cierre_sereno: formularioResult.rows[0]
        ? {
            formulario_id: formularioResult.rows[0].formulario_id,
            titulo: formularioResult.rows[0].titulo,
            respuestas: formularioResult.rows[0].respuestas,
          }
        : null,
      rechazo_data: rechazoResult.rows[0] || null,
    };

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};
