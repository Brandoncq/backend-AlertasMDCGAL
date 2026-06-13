import pool from "../config/db.js";

// GET /api/alertas/activas
export const getAlertasActivas = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        id, 
        ciudadano_id, 
        estado_actual,
        ST_Y(ubicacion_incidencia::geometry) as lat,
        ST_X(ubicacion_incidencia::geometry) as lng,
        direccion_aproximada,
        descripcion,
        created_at,
        updated_at
      FROM alertas
      WHERE estado_actual IN ('PENDIENTE', 'ASIGNADO', 'DESPLIEGUE')
      ORDER BY created_at DESC
      `,
    );

    // Formatear respuesta con objeto ubicacion
    const alertas = result.rows.map((row) => ({
      id: row.id,
      ciudadano_id: row.ciudadano_id,
      estado_actual: row.estado_actual,
      ubicacion_incidencia: {
        lat: parseFloat(row.lat),
        lng: parseFloat(row.lng),
      },
      direccion_aproximada: row.direccion_aproximada,
      descripcion: row.descripcion,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return res.status(200).json(alertas);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};

// GET /api/alertas/:id/detalle-operador
export const getDetalleAlerta = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Obtener datos de la alerta
    const alertaResult = await pool.query(
      `
      SELECT 
        id,
        estado_actual,
        ST_Y(ubicacion_incidencia::geometry) as lat,
        ST_X(ubicacion_incidencia::geometry) as lng,
        direccion_aproximada,
        descripcion,
        created_at,
        ciudadano_id
      FROM alertas
      WHERE id = $1
      `,
      [id],
    );

    if (alertaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Alerta no encontrada",
        data: null,
      });
    }

    const alerta = alertaResult.rows[0];

    // 2. Obtener datos del ciudadano y contactos de referencia
    const ciudadanoResult = await pool.query(
      `
      SELECT 
        u.nombres,
        u.apellidos,
        u.celular
      FROM usuarios u
      WHERE u.id = $1 AND u.rol = 'CIUDADANO'
      `,
      [alerta.ciudadano_id],
    );

    const contactosResult = await pool.query(
      `
      SELECT 
        nombre_referencia,
        celular,
        tipo_relacion
      FROM contactos_referencia
      WHERE ciudadano_id = $1
      `,
      [alerta.ciudadano_id],
    );

    // 3. Obtener formulario del ciudadano (EAV)
    const formularioResult = await pool.query(
      `
      SELECT 
        rf.formulario_id,
        fc.titulo,
        rf.respuestas
      FROM respuestas_formulario rf
      JOIN formularios_config fc ON rf.formulario_id = fc.id
      WHERE rf.alerta_id = $1
      `,
      [id],
    );

    const ciudadano = ciudadanoResult.rows[0];
    const formulario = formularioResult.rows[0];

    // 4. Construir respuesta
    const response = {
      id: parseInt(id),
      estado_actual: alerta.estado_actual,
      ubicacion_incidencia: {
        lat: parseFloat(alerta.lat),
        lng: parseFloat(alerta.lng),
      },
      direccion_aproximada: alerta.direccion_aproximada,
      descripcion: alerta.descripcion,
      created_at: alerta.created_at,
      ciudadano_contacto: {
        nombre_completo:
          `${ciudadano?.nombres || ""} ${ciudadano?.apellidos || ""}`.trim(),
        celular: ciudadano?.celular || "",
        contactos_referencia: contactosResult.rows.map((c) => ({
          nombre_referencia: c.nombre_referencia,
          celular: c.celular,
          tipo_relacion: c.tipo_relacion,
        })),
      },
      formulario_ciudadano: formulario
        ? {
            formulario_id: formulario.formulario_id,
            titulo: formulario.titulo,
            respuestas: formulario.respuestas,
          }
        : null,
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

// POST /api/alertas/:id/rechazar
export const rechazarAlerta = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { categoria_rechazo, motivo_detalle } = req.body;
    const operador_id = req.user?.id || 1; // Temporal, viene del JWT

    await client.query("BEGIN");

    // 1. Obtener ciudadano_id de la alerta
    const alertaResult = await client.query(
      `SELECT ciudadano_id, estado_actual FROM alertas WHERE id = $1 FOR UPDATE`,
      [id],
    );

    if (alertaResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        success: false,
        message: "Alerta no encontrada",
        data: null,
      });
    }

    const ciudadano_id = alertaResult.rows[0].ciudadano_id;

    // 2. Cambiar estado de alerta a RECHAZADO
    await client.query(
      `
      UPDATE alertas 
      SET estado_actual = 'RECHAZADO', updated_at = NOW()
      WHERE id = $1
      `,
      [id],
    );

    // 3. Insertar registro en rechazos_alerta
    await client.query(
      `
      INSERT INTO rechazos_alerta (alerta_id, rechazado_por, categoria, motivo_detalle)
      VALUES ($1, $2, $3, $4)
      `,
      [id, operador_id, categoria_rechazo, motivo_detalle],
    );

    // 4. Insertar en historial_alertas
    await client.query(
      `
      INSERT INTO historial_alertas (alerta_id, estado, actor, actor_id)
      VALUES ($1, 'RECHAZADO', 'OPERADOR', $2)
      `,
      [id, operador_id],
    );

    // 5. Incrementar contador_rechazos del ciudadano
    const ciudadanoUpdate = await client.query(
      `
      UPDATE ciudadanos
      SET contador_rechazos = contador_rechazos + 1,
          updated_at = NOW()
      WHERE id = $1
      RETURNING contador_rechazos, bloqueado_hasta
      `,
      [ciudadano_id],
    );

    const contador_nuevo = ciudadanoUpdate.rows[0]?.contador_rechazos || 0;
    let bloqueado_hasta = null;

    // 6. Si llega a 3, bloquear
    if (contador_nuevo >= 3) {
      bloqueado_hasta = new Date();
      bloqueado_hasta.setDate(bloqueado_hasta.getDate() + 30);

      await client.query(
        `
        UPDATE ciudadanos
        SET bloqueado_hasta = $1
        WHERE id = $2
        `,
        [bloqueado_hasta, ciudadano_id],
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      nuevo_estado: "RECHAZADO",
      penalizacion_aplicada: {
        ciudadano_id: ciudadano_id,
        contador_rechazos_nuevo: contador_nuevo,
        bloqueado_hasta: bloqueado_hasta,
        mensaje:
          contador_nuevo >= 3
            ? "Ciudadano bloqueado por 30 días"
            : "Advertencia enviada al ciudadano",
      },
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
