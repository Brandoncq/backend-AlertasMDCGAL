import pusher from "../config/soketi.js";

// POST /api/broadcasting/auth
export const authenticateSocket = (req, res) => {
  try {
    const socketId = req.body.socket_id;
    const channelName = req.body.channel_name;

    // Aquí ya pasamos por authMiddleware, así que sabemos quién es el usuario
    const user = req.user;

    // TODO: Puedes añadir validación de negocio aquí.
    // Ej: si channelName es private-alerta-452, verificar que el user.id sea
    // el ciudadano dueño o el sereno asignado.
    // Por simplicidad en la demo, permitimos si está autenticado.

    const auth = pusher.authenticate(socketId, channelName);
    return res.send(auth);
  } catch (error) {
    return res.status(403).json({ message: "No autorizado para este canal." });
  }
};
