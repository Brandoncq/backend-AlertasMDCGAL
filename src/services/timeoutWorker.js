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
          try {
            await pool.query("BEGIN");

            // 1. Marcar asignacion como TIMEOUT
            await pool.query(
              `
              UPDATE asignaciones_sereno 
              SET estado = 'TIMEOUT' 
              WHERE id = $1
              `,
              [asignacion.id]
            );

            // 2. Regresar alerta a PENDIENTE
            await pool.query(
              `
              UPDATE alertas 
              SET estado_actual = 'PENDIENTE', updated_at = NOW() 
              WHERE id = $1
              `,
              [asignacion.alerta_id]
            );

            // 3. Liberar al sereno (DISPONIBLE)
            await pool.query(
              `
              UPDATE serenos 
              SET estado_disponibilidad = 'DISPONIBLE' 
              WHERE id_usuario = $1
              `,
              [asignacion.sereno_id]
            );

            await pool.query("COMMIT");

            console.log(`[Worker] Asignación ${asignacion.id} marcada como TIMEOUT.`);

            // 4. Notificar al dashboard
            await pusher.trigger("dashboard-operador", "SERENO_TIMEOUT", {
              asignacion_id: asignacion.id,
              alerta_id: asignacion.alerta_id,
              sereno_id: asignacion.sereno_id,
            });

            // 5. Opcional: avisar a la alerta original por si en el futuro el ciudadano lo necesita ver,
            // pero el requerimiento solo dice "mostrar toast rojo al operador".

          } catch (err) {
            await pool.query("ROLLBACK");
            console.error(`[Worker] Error procesando asignación ${asignacion.id}:`, err);
          }
        }
      }
    } catch (error) {
      console.error("[Worker] Error en consulta general:", error);
    }
  }, 5000); // 5 segundos
};
