import pool from "../config/db.js";
import pusher from "../config/soketi.js";

// GET /api/alertas/activas
export const getAlertasActivas = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        ciudadano_id,
        estado_actual,
        ST_Y(ubicacion_incidencia::geometry) AS lat,
        ST_X(ubicacion_incidencia::geometry) AS lng,
        direccion_aproximada,
        descripcion,
        created_at,
        updated_at
      FROM alertas
      WHERE estado_actual IN ('PENDIENTE', 'ASIGNADO', 'DESPLIEGUE')
      ORDER BY created_at DESC
    `);

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
      message: error?.message || "Error interno del servidor",
      data: null,
    });
  }
};

// GET /api/alertas/:id/detalle-operador
export const getDetalleAlerta = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Datos de la alerta
    const alertaResult = await pool.query(
      `
      SELECT
        id,
        estado_actual,
        ST_Y(ubicacion_incidencia::geometry) AS lat,
        ST_X(ubicacion_incidencia::geometry) AS lng,
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

    // 2. Ciudadano
    const ciudadanoResult = await pool.query(
      `
      SELECT
        u.nombres,
        u.apellidos,
        u.celular
      FROM usuarios u
      WHERE u.id = $1
      AND u.rol = 'CIUDADANO'
      `,
      [alerta.ciudadano_id],
    );

    // 3. Contactos de referencia
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

    // 4. Formulario
    const formularioResult = await pool.query(
      `
      SELECT
        rf.formulario_id,
        fc.titulo,
        rf.respuestas_jsonb
      FROM respuestas_formulario rf
      INNER JOIN formularios_config fc
        ON rf.formulario_id = fc.id
      WHERE rf.alerta_id = $1
      `,
      [id],
    );

    const ciudadano = ciudadanoResult.rows[0];
    const formulario = formularioResult.rows[0];

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
          respuestas: formulario.respuestas_jsonb,
        }
        : null,
    };

    return res.status(200).json(response);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Error interno del servidor",
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
    const operador_id = req.user?.id || 1;

    await client.query("BEGIN");

    // Obtener alerta
    const alertaResult = await client.query(
      `
      SELECT ciudadano_id, estado_actual
      FROM alertas
      WHERE id = $1
      FOR UPDATE
      `,
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

    // Actualizar estado
    await client.query(
      `
      UPDATE alertas
      SET estado_actual = 'RECHAZADO',
          updated_at = NOW()
      WHERE id = $1
      `,
      [id],
    );

    // Registrar rechazo
    await client.query(
      `
      INSERT INTO rechazos_alerta
      (
        alerta_id,
        ciudadano_id,
        operador_id,
        categoria_rechazo,
        motivo_detalle
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [id, ciudadano_id, operador_id, categoria_rechazo, motivo_detalle],
    );

    // Historial
    await client.query(
      `
      INSERT INTO historial_alertas
      (
        alerta_id,
        estado,
        actor_id
      )
      VALUES ($1, 'RECHAZADO', $2)
      `,
      [id, operador_id],
    );

    // Incrementar rechazos
    const ciudadanoUpdate = await client.query(
      `
      UPDATE ciudadanos
      SET contador_rechazos = contador_rechazos + 1
      WHERE id_usuario = $1
      RETURNING contador_rechazos, bloqueado_hasta
      `,
      [ciudadano_id],
    );

    const contador_nuevo = ciudadanoUpdate.rows[0]?.contador_rechazos || 0;

    let bloqueado_hasta = null;

    // Bloqueo por 30 días
    if (contador_nuevo >= 3) {
      bloqueado_hasta = new Date();
      bloqueado_hasta.setDate(bloqueado_hasta.getDate() + 30);

      await client.query(
        `
        UPDATE ciudadanos
        SET bloqueado_hasta = $1
        WHERE id_usuario = $2
        `,
        [bloqueado_hasta, ciudadano_id],
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      nuevo_estado: "RECHAZADO",
      penalizacion_aplicada: {
        ciudadano_id,
        contador_rechazos_nuevo: contador_nuevo,
        bloqueado_hasta,
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
      message: error?.message || "Error interno del servidor",
      data: null,
    });
  } finally {
    client.release();
  }
};

// POST /api/alertas
export const crearAlerta = async (req, res) => {
  const client = await pool.connect();
  try {
    const ciudadano_id = req.user?.id || 14;
    const {
      latitude,
      longitude,
      descripcion,
      formulario_id,
      respuestas_formulario,
    } = req.body;

    await client.query("BEGIN");

    // 1. Crear alerta
    const alertaResult = await client.query(
      `
      INSERT INTO alertas (
        ciudadano_id,
        estado_actual,
        ubicacion_incidencia,
        descripcion
      )
      VALUES ($1, 'PENDIENTE', ST_SetSRID(ST_MakePoint($2, $3), 4326), $4)
      RETURNING id, estado_actual, created_at
      `,
      [ciudadano_id, longitude, latitude, descripcion]
    );

    const nuevaAlerta = alertaResult.rows[0];

    // 2. Guardar respuestas del formulario si existen
    if (formulario_id && respuestas_formulario) {
      await client.query(
        `
        INSERT INTO respuestas_formulario (
          alerta_id,
          formulario_id,
          respuestas_jsonb,
          respondido_por
        )
        VALUES ($1, $2, $3, $4)
        `,
        [nuevaAlerta.id, formulario_id, respuestas_formulario, ciudadano_id]
      );
    }

    // 3. Registrar en historial
    await client.query(
      `
      INSERT INTO historial_alertas (
        alerta_id,
        estado,
        actor_id
      )
      VALUES ($1, 'PENDIENTE', $2)
      `,
      [nuevaAlerta.id, ciudadano_id]
    );

    await client.query("COMMIT");

    // 4. Emitir evento Websocket para el Operador
    try {
      await pusher.trigger("dashboard-operador", "ALERTA_CREADA", {
        id: nuevaAlerta.id,
        ciudadano_id: ciudadano_id,
        estado_actual: nuevaAlerta.estado_actual,
        ubicacion_incidencia: {
          lat: parseFloat(latitude),
          lng: parseFloat(longitude),
        },
        direccion_aproximada: "Ubicación GPS",
        descripcion: descripcion || "Sin descripción",
        created_at: nuevaAlerta.created_at,
        updated_at: nuevaAlerta.created_at,
      });
    } catch (wsError) {
      console.error("Error emitiendo WebSocket ALERTA_CREADA:", wsError.message);
    }

    return res.status(201).json({
      success: true,
      message: "Alerta generada y enviada a la central de despacho",
      data: {
        alerta_id: nuevaAlerta.id,
        estado: nuevaAlerta.estado_actual,
        created_at: nuevaAlerta.created_at,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      success: false,
      message: `Error interno del servidor: ${error.message}`,
      data: null,
    });
  } finally {
    client.release();
  }
};

// GET /api/alertas/activa
export const getAlertaActiva = async (req, res) => {
  try {
    const ciudadano_id = req.user?.id || 14;

    const result = await pool.query(
      `
      SELECT
        id,
        estado_actual,
        descripcion,
        created_at
      FROM alertas
      WHERE ciudadano_id = $1
        AND estado_actual IN ('PENDIENTE', 'ASIGNADO', 'DESPLIEGUE', 'INTERVENCION')
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [ciudadano_id]
    );

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        data: null, // No active alert
      });
    }

    const alerta = result.rows[0];
    let asignacion_activa = null;

    // Si la alerta ya fue asignada y el sereno aceptó (DESPLIEGUE)
    if (['DESPLIEGUE', 'INTERVENCION'].includes(alerta.estado_actual)) {
      const asignacionResult = await pool.query(
        `
        SELECT
          a.tiempo_estimado_llegada_min,
          a.distancia_estimada_mts,
          u.id as id_usuario,
          u.nombres,
          u.apellidos,
          u.celular
        FROM asignaciones_sereno a
        INNER JOIN usuarios u ON a.sereno_id = u.id
        WHERE a.alerta_id = $1 AND a.estado = 'ACEPTADO'
        LIMIT 1
        `,
        [alerta.id]
      );

      if (asignacionResult.rows.length > 0) {
        const asig = asignacionResult.rows[0];
        asignacion_activa = {
          soketi_channel: `private-alerta-${alerta.id}`,
          tiempo_estimado_llegada_min: asig.tiempo_estimado_llegada_min,
          distancia_estimada_mts: asig.distancia_estimada_mts,
          sereno: {
            id_usuario: asig.id_usuario,
            nombres: asig.nombres,
            apellidos: asig.apellidos,
            celular: asig.celular,
          },
        };
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        alerta,
        asignacion_activa,
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

// POST /api/alertas/:id/calificar
export const calificarAlerta = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const ciudadano_id = req.user?.id || 14;
    const { formulario_id, calificacion_estrellas, respuestas } = req.body;

    await client.query("BEGIN");

    // 1. Actualizar alerta con la calificación
    await client.query(
      `
      UPDATE alertas
      SET calificacion = $1, updated_at = NOW()
      WHERE id = $2 AND ciudadano_id = $3
      `,
      [calificacion_estrellas, id, ciudadano_id]
    );

    // 2. Guardar el feedback como un registro en respuestas_formulario
    // Si ya existe un registro de formulario de calificación, lo actualiza (ON CONFLICT no disponible por defecto sin UNIQUE en alerta_id, formulario_id, usamos INSERT)
    // Asumimos que el ciudadano solo puede enviar un form de calificación (formulario_id = 2)

    // Verificamos si ya existe
    const existForm = await client.query(
      "SELECT 1 FROM respuestas_formulario WHERE alerta_id = $1 AND formulario_id = $2",
      [id, formulario_id]
    );

    if (existForm.rows.length > 0) {
      await client.query(
        `
        UPDATE respuestas_formulario
        SET respuestas_jsonb = $1
        WHERE alerta_id = $2 AND formulario_id = $3
        `,
        [respuestas, id, formulario_id]
      );
    } else {
      await client.query(
        `
        INSERT INTO respuestas_formulario (
          alerta_id,
          formulario_id,
          respuestas_jsonb,
          respondido_por
        )
        VALUES ($1, $2, $3, $4)
        `,
        [id, formulario_id, respuestas, ciudadano_id]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Calificación registrada con éxito.",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      success: false,
      message: `Error interno del servidor: ${error.message}`,
      data: null,
    });
  } finally {
    client.release();
  }
};

// PATCH /api/alertas/:id/estado
export const actualizarEstadoAlerta = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { nuevo_estado, formulario_id, respuestas_formulario } = req.body;
    const sereno_id = req.user?.id || 5;

    if (!['INTERVENCION', 'ATENDIDO'].includes(nuevo_estado)) {
      return res.status(400).json({
        success: false,
        message: "Estado inválido para esta transición",
      });
    }

    await client.query("BEGIN");

    // Actualizar alerta
    await client.query(
      `
      UPDATE alertas
      SET estado_actual = $1, updated_at = NOW()
      WHERE id = $2
      `,
      [nuevo_estado, id]
    );

    // Historial
    await client.query(
      `
      INSERT INTO historial_alertas (alerta_id, estado, actor_id)
      VALUES ($1, $2, $3)
      `,
      [id, nuevo_estado, sereno_id]
    );

    if (nuevo_estado === 'INTERVENCION') {
      await client.query("COMMIT");

      try {
        await pusher.trigger("dashboard-operador", "ALERTA_INTERVENCION", {
          alerta_id: parseInt(id),
          estado: "INTERVENCION"
        });
        await pusher.trigger(`private-alerta-${id}`, "ALERTA_ESTADO_CAMBIADO", {
          alerta_id: parseInt(id),
          nuevo_estado: "INTERVENCION"
        });
      } catch (wsError) {
        console.error("WS Error:", wsError);
      }

      return res.status(200).json({
        success: true,
        nuevo_estado: "INTERVENCION"
      });
    }

    if (nuevo_estado === 'ATENDIDO') {
      // Si es ATENDIDO, se guarda el form de cierre
      if (formulario_id && respuestas_formulario) {
        await client.query(
          `
          INSERT INTO respuestas_formulario (
            alerta_id, formulario_id, respuestas_jsonb, respondido_por
          )
          VALUES ($1, $2, $3, $4)
          `,
          [id, formulario_id, respuestas_formulario, sereno_id]
        );
      }

      // Liberar al sereno
      await client.query(
        `
        UPDATE serenos
        SET estado_disponibilidad = 'DISPONIBLE'
        WHERE id_usuario = $1
        `,
        [sereno_id]
      );

      await client.query("COMMIT");

      try {
        await pusher.trigger("dashboard-operador", "ALERTA_ATENDIDA", {
          alerta_id: parseInt(id),
          estado: "ATENDIDO"
        });
        await pusher.trigger(`private-alerta-${id}`, "ALERTA_ESTADO_CAMBIADO", {
          alerta_id: parseInt(id),
          nuevo_estado: "ATENDIDO",
          requiere_calificacion: true,
          formulario_id: 2 // El form de calificacion en el frontend
        });
      } catch (wsError) {
        console.error("WS Error:", wsError);
      }

      return res.status(200).json({
        success: true,
        message: "El caso ha sido cerrado correctamente",
        data: {
          alerta_id: parseInt(id),
          estado_final: "ATENDIDO",
          sereno_estado_actual: "DISPONIBLE"
        }
      });
    }

  } catch (error) {
    await client.query("ROLLBACK");
    return res.status(500).json({
      success: false,
      message: `Error interno: ${error.message}`
    });
  } finally {
    client.release();
  }
};


