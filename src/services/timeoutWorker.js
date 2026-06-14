import pool from "../config/db.js";
import pusher from "../config/soketi.js";

export const startTimeoutWorker = () => {
  console.log("Iniciando Worker de Timeout (60s) para asignaciones...");

  setInterval(async () => {
    try {
      const { rows } = await pool.query(
        `
        SELECT id, alerta_id, sereno_id 
        FROM asignaciones_sereno 
        WHERE estado = 'PENDIENTE_CONFIRMACION' 
          AND created_at < NOW() - INTERVAL '1 minute'
        `
      );

      if (rows.length > 0) {
        for (const asignacion of rows) {
          const client = await pool.connect();
          try {
            await client.query("BEGIN");

            // 1. Marcar asignacion como TIMEOUT
            await client.query(
              `
              UPDATE asignaciones_sereno 
              SET estado = 'TIMEOUT' 
              WHERE id = $1
              `,
              [asignacion.id]
            );

            // 2. Regresar alerta a PENDIENTE
            await client.query(
              `
              UPDATE alertas 
              SET estado_actual = 'PENDIENTE', updated_at = NOW() 
              WHERE id = $1
              `,
              [asignacion.alerta_id]
            );

            // 3. Liberar al sereno (DISPONIBLE)
            await client.query(
              `
              UPDATE serenos 
              SET estado_disponibilidad = 'DISPONIBLE' 
              WHERE id_usuario = $1
              `,
              [asignacion.sereno_id]
            );

            // Obtener todos los datos de la alerta para el front
            const alertaData = await client.query(
              `
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
              WHERE id = $1
              `,
              [asignacion.alerta_id]
            );

            await client.query("COMMIT");

            console.log(`[Worker] Asignación ${asignacion.id} marcada como TIMEOUT.`);

            const alerta = alertaData.rows[0];

            // 4. Notificar al dashboard
            await pusher.trigger("private-operador-global", "SERENO_TIMEOUT", {
              asignacion_id: asignacion.id,
              alerta_id: asignacion.alerta_id,
              sereno_id: asignacion.sereno_id,
              // Enviamos toda la data de la alerta para que el front no se rompa
              alerta: {
                id: alerta.id,
                ciudadano_id: alerta.ciudadano_id,
                estado_actual: alerta.estado_actual,
                ubicacion_incidencia: {
                  lat: parseFloat(alerta.lat),
                  lng: parseFloat(alerta.lng),
                },
                direccion_aproximada: alerta.direccion_aproximada,
                descripcion: alerta.descripcion,
                created_at: alerta.created_at,
                updated_at: alerta.updated_at,
              }
            });

          } catch (err) {
            await client.query("ROLLBACK");
            console.error(`[Worker] Error procesando asignación ${asignacion.id}:`, err);
          } finally {
            client.release();
          }
        }
      }
    } catch (error) {
      console.error("[Worker] Error en consulta general:", error);
    }
  }, 5000); // 5 segundos
};