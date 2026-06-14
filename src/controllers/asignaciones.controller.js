import pool from "../config/db.js";
import pusher from "../config/soketi.js";

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
    const operador_id = req.user.id;

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
        alerta_id, sereno_id, operador_id, estado,
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
      SET estado_disponibilidad = 'OCUPADO', ultima_actualizacion_gps = NOW()
      WHERE usuario_id = $1
      `,
      [sereno_id],
    );

    // 4. Insertar en historial_alertas
    await client.query(
      `
      INSERT INTO historial_alertas (alerta_id, estado, actor_id)
      VALUES ($1, 'ASIGNADO', $2)
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

// POST /api/asignaciones/:id/responder
export const responderAsignacion = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { accion } = req.body; // "ACEPTAR" o "RECHAZAR_MANUAL"
    const sereno_id = req.user.id;

    await client.query("BEGIN");

    // 1. Obtener la asignación y verificar estado
    const asigResult = await client.query(
      `
      SELECT alerta_id, estado
      FROM asignaciones_sereno
      WHERE id = $1 AND sereno_id = $2
      FOR UPDATE
      `,
      [id, sereno_id]
    );

    if (asigResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Asignación no encontrada",
      });
    }

    const asignacion = asigResult.rows[0];

    if (asignacion.estado === 'TIMEOUT') {
      await client.query("ROLLBACK");
      return res.status(410).json({
        success: false,
        code: "ASSIGNMENT_TIMEOUT",
        message: "El tiempo de confirmación de 60 segundos ha expirado.",
      });
    }

    if (asignacion.estado !== 'PENDIENTE_CONFIRMACION') {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `La asignación ya fue procesada: ${asignacion.estado}`,
      });
    }

    if (accion === 'ACEPTAR') {
      // Actualizar asignacion
      await client.query(
        `
        UPDATE asignaciones_sereno
        SET estado = 'ACEPTADO', fecha_respuesta = NOW()
        WHERE id = $1
        `,
        [id]
      );

      // Actualizar alerta
      await client.query(
        `
        UPDATE alertas
        SET estado_actual = 'DESPLIEGUE', updated_at = NOW()
        WHERE id = $1
        `,
        [asignacion.alerta_id]
      );

      // Actualizar historial
      await client.query(
        `
        INSERT INTO historial_alertas (alerta_id, estado, actor_id)
        VALUES ($1, 'DESPLIEGUE', $2)
        `,
        [asignacion.alerta_id, sereno_id]
      );

      await client.query("COMMIT");

      // Emitir eventos WebSocket
      try {
        await pusher.trigger("dashboard-operador", "SERENO_ACEPTO", {
          asignacion_id: parseInt(id),
          alerta_id: asignacion.alerta_id,
          sereno_id,
          estado: "DESPLIEGUE"
        });

        await pusher.trigger(`private-alerta-${asignacion.alerta_id}`, "ALERTA_ESTADO_CAMBIADO", {
          alerta_id: asignacion.alerta_id,
          nuevo_estado: "DESPLIEGUE"
        });
      } catch (wsError) {
        console.error("WS Error:", wsError);
      }

      return res.status(200).json({
        success: true,
        message: "Asignación aceptada. Inicie desplazamiento.",
        data: {
          alerta_id: asignacion.alerta_id,
          estado_alerta: "DESPLIEGUE",
        },
      });
    } else if (accion === 'RECHAZAR_MANUAL') {
      // Actualizar asignacion
      await client.query(
        `
        UPDATE asignaciones_sereno
        SET estado = 'RECHAZADO_MANUAL', fecha_respuesta = NOW()
        WHERE id = $1
        `,
        [id]
      );

      // Regresar alerta a pendiente
      await client.query(
        `
        UPDATE alertas
        SET estado_actual = 'PENDIENTE', updated_at = NOW()
        WHERE id = $1
        `,
        [asignacion.alerta_id]
      );

      // Sereno vuelve a disponible
      await client.query(
        `
        UPDATE serenos
        SET estado_disponibilidad = 'DISPONIBLE'
        WHERE id_usuario = $1
        `,
        [sereno_id]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Asignación rechazada.",
      });
    } else {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Acción no válida.",
      });
    }
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      success: false,
      message: `Error interno: ${error.message}`,
    });
  } finally {
    client.release();
  }
};
