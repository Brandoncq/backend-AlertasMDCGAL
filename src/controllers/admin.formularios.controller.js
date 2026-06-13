import pool from "../config/db.js";

// GET /api/admin/formularios
export const getAdminFormularios = async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT 
        id,
        identificador,
        titulo,
        activo,
        updated_at,
        jsonb_array_length(estructura_jsonb) as cantidad_campos
      FROM formularios_config
      ORDER BY updated_at DESC
      `,
    );

    const formularios = result.rows.map((row) => ({
      id: row.id,
      identificador: row.identificador,
      titulo: row.titulo,
      activo: row.activo,
      updated_at: row.updated_at,
      cantidad_campos: parseInt(row.cantidad_campos),
    }));

    return res.status(200).json(formularios);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};

// GET /api/admin/formularios/:id
export const getAdminFormularioById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `
      SELECT 
        id,
        identificador,
        titulo,
        activo,
        estructura_jsonb,
        updated_at
      FROM formularios_config
      WHERE id = $1
      `,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Formulario no encontrado",
        data: null,
      });
    }

    const formulario = result.rows[0];

    return res.status(200).json({
      id: formulario.id,
      identificador: formulario.identificador,
      titulo: formulario.titulo,
      activo: formulario.activo,
      estructura_jsonb: formulario.estructura_jsonb,
      updated_at: formulario.updated_at,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error: ${error?.message || "Error interno del servidor"}`,
      data: null,
    });
  }
};
