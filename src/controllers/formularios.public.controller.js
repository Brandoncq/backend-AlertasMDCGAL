import pool from "../config/db.js";

// GET /api/formularios/config/:identificador
export const getFormularioConfig = async (req, res) => {
  try {
    const { identificador } = req.params;

    const result = await pool.query(
      `
      SELECT id as formulario_id, titulo, estructura_jsonb as estructura_preguntas
      FROM formularios_config
      WHERE identificador = $1 AND activo = true
      `,
      [identificador]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Formulario no encontrado",
      });
    }

    return res.status(200).json({
      success: true,
      ...result.rows[0],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: `Error interno del servidor: ${error.message}`,
    });
  }
};
