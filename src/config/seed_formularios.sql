-- Insertar Formularios por defecto para que la app no quede en blanco
INSERT INTO formularios_config (id, identificador, titulo, estructura_jsonb)
VALUES
(
  1,
  'cierre_sereno',
  'Informe de Cierre de Caso',
  '[
    {
      "id_pregunta": "tipo_incidente",
      "tipo_control": "select",
      "label": "Tipo de incidente confirmado",
      "opciones": ["Alteración del orden", "Robo", "Accidente", "Falsa alarma"]
    },
    {
      "id_pregunta": "intervenidos_count",
      "tipo_control": "number",
      "label": "Cantidad de intervenidos"
    },
    {
      "id_pregunta": "apoyo_policial",
      "tipo_control": "radio",
      "label": "¿Requirió apoyo policial?",
      "opciones": ["Sí", "No"]
    },
    {
      "id_pregunta": "observaciones_campo",
      "tipo_control": "text",
      "label": "Observaciones en campo",
      "required": true
    }
  ]'::jsonb
) ON CONFLICT (identificador) DO NOTHING;

INSERT INTO formularios_config (id, identificador, titulo, estructura_jsonb)
VALUES
(
  2,
  'calificacion_ciudadano',
  'Calificación de Servicio',
  '[
    {
      "id_pregunta": "calificacion_estrellas",
      "tipo_control": "rating",
      "label": "¿Cómo califica la atención del sereno?"
    },
    {
      "id_pregunta": "observaciones",
      "tipo_control": "text",
      "label": "Comentarios adicionales",
      "required": false
    }
  ]'::jsonb
) ON CONFLICT (identificador) DO NOTHING;

INSERT INTO formularios_config (id, identificador, titulo, estructura_jsonb)
VALUES
(
  3,
  'alertas_ciudadano',
  'Reporte de Incidencia Inicial',
  '[
    {
      "id_pregunta": "tipo_incidencia",
      "tipo_control": "select",
      "label": "¿Qué está ocurriendo?",
      "opciones": ["Persona sospechosa", "Robo/Asalto", "Violencia familiar", "Accidente de tránsito"]
    },
    {
      "id_pregunta": "cantidad_personas_involucradas",
      "tipo_control": "number",
      "label": "Cantidad aproximada de involucrados",
      "required": true
    },
    {
      "id_pregunta": "hay_armas_visibles",
      "tipo_control": "radio",
      "label": "¿Visualiza algún tipo de arma?",
      "opciones": ["Sí", "No", "No estoy seguro"]
    }
  ]'::jsonb
) ON CONFLICT (identificador) DO NOTHING;

-- Opcional: arreglar la secuencia si insertamos IDs manuales
SELECT setval('formularios_config_id_seq', (SELECT MAX(id) FROM formularios_config));
