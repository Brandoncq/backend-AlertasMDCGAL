import pool from "../config/db.js";

// POST /api/asignaciones
export const crearAsignacion = async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      alerta_id,
      sereno_id,
      distancia_estimada_mts,
      tiempo_estimado_llegada_min,
    } = req.body;
    const operador_id = req.user?.id || 1; // Temporal, viene del JWT

    if (!alerta_id || !sereno_id) {
      return res.status(400).json({
        success: false,
        message: "alerta_id y sereno_id son requeridos",
        data: null,
      });
    }

    await client.query("BEGIN");

    // 1. Insertar asignacion_sereno
    const asignacionResult = await client.query(
      `
      INSERT INTO asignaciones_sereno (
        alerta_id, sereno_id, asignado_por, estado_asignacion,
        distancia_estimada_mts, tiempo_estimado_llegada_min
      )
      VALUES ($1, $2, $3, 'PENDIENTE_CONFIRMACION', $4, $5)
      RETURNING id
      `,
      [
        alerta_id,
        sereno_id,
        operador_id,
        distancia_estimada_mts,
        tiempo_estimado_llegada_min,
      ],
    );

    const asignacion_id = asignacionResult.rows[0].id;

    // 2. Cambiar estado de alerta a ASIGNADO
    await client.query(
      `
      UPDATE alertas
      SET estado_actual = 'ASIGNADO', updated_at = NOW()
      WHERE id = $1
      `,
      [alerta_id],
    );

    // 3. Cambiar estado del sereno a OCUPADO
    await client.query(
      `
      UPDATE serenos
      SET estado_disponibilidad = 'OCUPADO', updated_at = NOW()
      WHERE usuario_id = $1
      `,
      [sereno_id],
    );

    // 4. Insertar en historial_alertas
    await client.query(
      `
      INSERT INTO historial_alertas (alerta_id, estado, actor, actor_id)
      VALUES ($1, 'ASIGNADO', 'OPERADOR', $2)
      `,
      [alerta_id, operador_id],
    );

    await client.query("COMMIT");

    // TODO: Emitir WebSocket SERENO_ASIGNADO
    // io.emit('SERENO_ASIGNADO', { asignacion_id, alerta_id, sereno_id });

    return res.status(201).json({
      success: true,
      asignacion_id: asignacion_id,
      estado_asignacion: "PENDIENTE_CONFIRMACION",
      estado_alerta: "ASIGNADO",
      segundos_para_timeout: 60,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  } finally {
    client.release();
  }
};
