const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'leados-dev-secret-change-in-prod';
const COOKIE_NAME = 'leados_token';

function verifyToken(req) {
  const token = req.cookies && req.cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const payload = verifyToken(req);
  if (!payload) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.user = {
    id:       payload.id,
    username: payload.username,
    role:     payload.role,
    teamId:   payload.teamId,
    memberId: payload.memberId,
  };
  next();
}

function optionalAuth(req, res, next) {
  const payload = verifyToken(req);
  req.user = payload ? {
    id:       payload.id,
    username: payload.username,
    role:     payload.role,
    teamId:   payload.teamId,
    memberId: payload.memberId,
  } : null;
  next();
}

module.exports = { requireAuth, optionalAuth, JWT_SECRET, COOKIE_NAME };
