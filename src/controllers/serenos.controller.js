import pool from "../config/db.js";
import bcrypt from "bcrypt";

// Obtener serenos
export const getSerenos = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.nombres,
        u.apellidos,
        u.celular,
        u.correo,
        u.rol,
        u.activo,
        s.estado_disponibilidad,
        s.tipo_patrullaje,
        s.ultima_actualizacion_gps
      FROM serenos s
      INNER JOIN usuarios u
        ON s.id_usuario = u.id
    `);

    return res.status(200).json({
      success: true,
      message: "Serenos obtenidos correctamente",
      data: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};

// Crear sereno
export const createSereno = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { nombres, apellidos, celular, correo, tipo_patrullaje } = req.body;

    // Contraseña inicial = celular
    const passwordHash = await bcrypt.hash(celular, 10);

    // Crear usuario
    const userResult = await client.query(
      `
      INSERT INTO usuarios (
        nombres,
        apellidos,
        celular,
        correo,
        rol,
        password_hash
      )
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING id
      `,
      [nombres, apellidos, celular, correo, "SERENO", passwordHash],
    );

    const idUsuario = userResult.rows[0].id;

    // Crear sereno
    await client.query(
      `
      INSERT INTO serenos (
        id_usuario,
        estado_disponibilidad,
        tipo_patrullaje
      )
      VALUES ($1,$2,$3)
      `,
      [idUsuario, "INACTIVO", tipo_patrullaje ?? "INFANTERIA"],
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: "Sereno creado correctamente",
      data: null,
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

// Actualizar sereno
export const updateSereno = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id } = req.params;

    const {
      nombres,
      apellidos,
      celular,
      correo,
      estado_disponibilidad,
      tipo_patrullaje,
    } = req.body;

    await client.query(
      `
      UPDATE usuarios
      SET
        nombres = $1,
        apellidos = $2,
        celular = $3,
        correo = $4
      WHERE id = $5
      `,
      [nombres, apellidos, celular, correo, id],
    );

    await client.query(
      `
      UPDATE serenos
      SET
        estado_disponibilidad = $1,
        tipo_patrullaje = $2
      WHERE id_usuario = $3
      `,
      [estado_disponibilidad, tipo_patrullaje, id],
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Sereno actualizado correctamente",
      data: null,
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

// Eliminación lógica
export const deleteSereno = async (req, res) => {
  try {
    const { id } = req.params;

    await pool.query(
      `
      UPDATE usuarios
      SET activo = false
      WHERE id = $1
      `,
      [id],
    );

    return res.status(200).json({
      success: true,
      message: "Sereno desactivado correctamente",
      data: null,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};
