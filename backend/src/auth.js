const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'vocab-app-secret-key-change-in-production';

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    token = header.slice(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }
  if (!token) {
    return res.status(401).json({ error: '未登录' });
  }
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ error: '登录已过期' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: '没有权限' });
    }
    next();
  };
}

module.exports = { signToken, authMiddleware, requireRole };
