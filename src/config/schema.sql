-- 1. Habilitar extensión espacial para coordenadas e índices geométricos
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. ENUMS para optimizar búsquedas y asegurar integridad de datos
CREATE TYPE rol_usuario AS ENUM ('CIUDADANO', 'OPERADOR', 'SERENO', 'ADMINISTRADOR');
CREATE TYPE estado_alerta AS ENUM ('PENDIENTE', 'ASIGNADO', 'DESPLIEGUE', 'INTERVENCION', 'ATENDIDO', 'RECHAZADO');
CREATE TYPE estado_sereno AS ENUM ('DISPONIBLE', 'OCUPADO', 'INACTIVO');
CREATE TYPE tipo_patrullaje AS ENUM ('MOTO', 'AUTO', 'INFANTERIA');

-- 3. Tabla Core de Usuarios (Maneja la autenticación y JWT)
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    celular VARCHAR(15) UNIQUE NOT NULL,
    correo VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol rol_usuario NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Extensión Ciudadanos y Penalizaciones
CREATE TABLE IF NOT EXISTS ciudadanos (
    id_usuario INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    dni VARCHAR(8) UNIQUE NOT NULL,
    fecha_vencimiento_dni DATE NOT NULL,
    direccion VARCHAR(255),
    ubigeo VARCHAR(6),
    contador_rechazos INTEGER DEFAULT 0, -- Sube a 3 y el usuario se bloquea
    bloqueado_hasta TIMESTAMP DEFAULT NULL
);

-- 5. Tabla Mock para validar DNI sin consumir API externas
CREATE TABLE IF NOT EXISTS mock_reniec (
    dni VARCHAR(8) PRIMARY KEY,
    nombres VARCHAR(100),
    apellidos VARCHAR(100),
    fecha_vencimiento DATE
);

-- 6. Contactos de Referencia (Familiares del ciudadano)
CREATE TABLE IF NOT EXISTS contactos_referencia (
    id SERIAL PRIMARY KEY,
    ciudadano_id INTEGER REFERENCES ciudadanos(id_usuario) ON DELETE CASCADE,
    nombre_referencia VARCHAR(100) NOT NULL,
    celular VARCHAR(15) NOT NULL,
    tipo_relacion VARCHAR(50) NOT NULL
);

-- 7. Extensión Serenos y Tracking Espacial
CREATE TABLE IF NOT EXISTS serenos (
    id_usuario INTEGER PRIMARY KEY REFERENCES usuarios(id) ON DELETE CASCADE,
    estado_disponibilidad estado_sereno DEFAULT 'INACTIVO',
    ubicacion_actual GEOMETRY(Point, 4326), -- Formato estándar GPS (Longitud/Latitud)
    ultima_actualizacion_gps TIMESTAMP,
    tipo tipo_patrullaje NOT NULL DEFAULT 'INFANTERIA'
);

-- 8. Entidad Principal: Alertas y sus coordenadas geográficas
CREATE TABLE IF NOT EXISTS alertas (
    id SERIAL PRIMARY KEY,
    ciudadano_id INTEGER REFERENCES ciudadanos(id_usuario),
    estado_actual estado_alerta DEFAULT 'PENDIENTE',
    ubicacion_incidencia GEOMETRY(Point, 4326) NOT NULL,
    direccion_aproximada VARCHAR(255),
    calificacion INTEGER CHECK (calificacion >= 1 AND calificacion <= 5),
    comentarios_cierre TEXT,
    descripcion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Sistema de Asignaciones y Worker de Timeout (Manejo de los 60 segundos)
CREATE TABLE IF NOT EXISTS asignaciones_sereno (
    id SERIAL PRIMARY KEY,
    alerta_id INTEGER REFERENCES alertas(id) ON DELETE CASCADE,
    sereno_id INTEGER REFERENCES serenos(id_usuario),
    operador_id INTEGER REFERENCES usuarios(id),
    estado VARCHAR(20) DEFAULT 'PENDIENTE_CONFIRMACION', -- PENDIENTE_CONFIRMACION, ACEPTADO, TIMEOUT, RECHAZADO_MANUAL
    tiempo_estimado_llegada_min INTEGER, -- Data inyectada desde OSRM
    distancia_estimada_mts INTEGER,      -- Data inyectada desde OSRM
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_respuesta TIMESTAMP NULL
);

-- =========================================================================
-- NUEVO MÓDULO DE FORMULARIOS DESNORMALIZADO CON JSONB
-- =========================================================================

-- 10. Plantillas de Formularios (Esquema de preguntas fijas)
CREATE TABLE IF NOT EXISTS formularios_config (
    id SERIAL PRIMARY KEY,
    identificador VARCHAR(50) UNIQUE NOT NULL, -- Ej: 'cierre_sereno', 'calificacion_ciudadano'
    titulo VARCHAR(100) NOT NULL,
    estructura_jsonb JSONB NOT NULL, -- Contiene el array de preguntas, tipos y opciones fijas
    activo BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Respuestas de Formularios vinculadas a las Alertas
CREATE TABLE IF NOT EXISTS respuestas_formulario (
    alerta_id INTEGER PRIMARY KEY REFERENCES alertas(id) ON DELETE CASCADE,
    formulario_id INTEGER REFERENCES formularios_config(id),
    respuestas_jsonb JSONB NOT NULL, -- Contiene el par llave-valor de las respuestas fijas
    respondido_por INTEGER REFERENCES usuarios(id), -- ID del sereno o ciudadano que llenó el form
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================================

-- 12. Auditoría: Historial de Tiempos y Trazabilidad de Estados
CREATE TABLE IF NOT EXISTS historial_alertas (
    id SERIAL PRIMARY KEY,
    alerta_id INTEGER REFERENCES alertas(id) ON DELETE CASCADE,
    estado estado_alerta NOT NULL,
    actor_id INTEGER REFERENCES usuarios(id),
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 13. Trazabilidad de Rechazos y Falsas Alarmas
CREATE TABLE IF NOT EXISTS rechazos_alerta (
    id SERIAL PRIMARY KEY,
    alerta_id INTEGER REFERENCES alertas(id) ON DELETE CASCADE,
    ciudadano_id INTEGER REFERENCES ciudadanos(id_usuario),
    operador_id INTEGER REFERENCES usuarios(id),
    categoria_rechazo VARCHAR(100) NOT NULL,
    motivo_detalle TEXT,
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 14. Índices de Rendimiento Críticos
-- Índice para que el Worker de Timeout encuentre rápido las asignaciones caducadas
CREATE INDEX IF NOT EXISTS idx_asignaciones_pendientes ON asignaciones_sereno(estado, created_at) WHERE estado = 'PENDIENTE_CONFIRMACION';

-- Índice para los filtrados del dashboard web de alertas operativas
CREATE INDEX IF NOT EXISTS idx_alertas_estado ON alertas(estado_actual);

-- Índice GIST fundamental para hacer búsquedas por ST_Distance súper rápidas con PostGIS
CREATE INDEX IF NOT EXISTS idx_serenos_ubicacion ON serenos USING GIST(ubicacion_actual);

-- Índice GIN para búsquedas dentro de los datos JSONB si en el futuro necesitas métricas
CREATE INDEX IF NOT EXISTS idx_respuestas_jsonb ON respuestas_formulario USING GIN(respuestas_jsonb);
