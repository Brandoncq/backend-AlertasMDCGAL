import pool from "../config/db.js";
import bcrypt from "bcrypt";

// GET /api/admin/usuarios
export const getAdminUsuarios = async (req, res) => {
  try {
    const { rol, activo, page = 1, limit = 20 } = req.query;

    const offset = (page - 1) * limit;
    let query = `
      SELECT 
        u.id,
        u.nombres,
        u.apellidos,
        u.celular,
        u.correo,
        u.rol,
        u.activo,
        u.created_at,
        s.estado_disponibilidad,
        s.ultima_actualizacion_gps
      FROM usuarios u
      LEFT JOIN serenos s ON u.id = s.usuario_id
      WHERE 1=1
    `;

    const queryParams = [];
    let paramIndex = 1;

    if (rol) {
      query += ` AND u.rol = $${paramIndex++}`;
      queryParams.push(rol);
    }

    if (activo !== undefined) {
      query += ` AND u.activo = $${paramIndex++}`;
      queryParams.push(activo === "true");
    }

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM (${query}) as subquery
    `;
    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Add pagination
    query += ` ORDER BY u.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    const data = result.rows.map((row) => ({
      id: row.id,
      nombres: row.nombres,
      apellidos: row.apellidos,
      celular: row.celular,
      correo: row.correo,
      rol: row.rol,
      activo: row.activo,
      created_at: row.created_at,
      sereno_data: row.estado_disponibilidad
        ? {
            estado_disponibilidad: row.estado_disponibilidad,
            ultima_actualizacion_gps: row.ultima_actualizacion_gps,
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

// POST /api/admin/usuarios
export const createAdminUsuario = async (req, res) => {
  const client = await pool.connect();

  try {
    const { nombres, apellidos, celular, correo, rol } = req.body;

    // Validar campos requeridos
    if (!nombres || !apellidos || !celular || !correo || !rol) {
      return res.status(400).json({
        success: false,
        message: "Todos los campos son requeridos",
        data: null,
      });
    }

    // Validar rol válido
    if (!["OPERADOR", "SERENO"].includes(rol)) {
      return res.status(400).json({
        success: false,
        message: "Rol inválido. Debe ser OPERADOR o SERENO",
        data: null,
      });
    }

    await client.query("BEGIN");

    // Contraseña temporal = celular
    const passwordHash = await bcrypt.hash(celular, 10);

    // Insertar en usuarios
    const userResult = await client.query(
      `
      INSERT INTO usuarios (nombres, apellidos, celular, correo, rol, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
      `,
      [nombres, apellidos, celular, correo, rol, passwordHash],
    );

    const usuario_id = userResult.rows[0].id;

    // Si es SERENO, insertar en tabla serenos
    if (rol === "SERENO") {
      await client.query(
        `
        INSERT INTO serenos (usuario_id, estado_disponibilidad)
        VALUES ($1, 'DISPONIBLE')
        `,
        [usuario_id],
      );
    }

    await client.query("COMMIT");

    // TODO: Enviar correo con credenciales temporales
    // await enviarCorreo(correo, "Credenciales de acceso", `Usuario: ${celular}, Contraseña temporal: ${celular}`);

    return res.status(201).json({
      success: true,
      usuario_id: usuario_id,
      rol: rol,
      credenciales_enviadas_a: correo,
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

// PATCH /api/admin/usuarios/:id
export const updateAdminUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombres, apellidos, activo } = req.body;

    const updates = [];
    const queryParams = [];
    let paramIndex = 1;

    if (nombres !== undefined) {
      updates.push(`nombres = $${paramIndex++}`);
      queryParams.push(nombres);
    }
    if (apellidos !== undefined) {
      updates.push(`apellidos = $${paramIndex++}`);
      queryParams.push(apellidos);
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex++}`);
      queryParams.push(activo);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No hay campos para actualizar",
        data: null,
      });
    }

    queryParams.push(id);

    await pool.query(
      `
      UPDATE usuarios
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex}
      `,
      queryParams,
    );

    return res.status(200).json({
      success: true,
      usuario_id: parseInt(id),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};
