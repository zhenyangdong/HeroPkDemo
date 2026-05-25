// ========== 用户与会话 ==========
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

function loadUserConfig() {
  const CONFIG_FILE = path.join(__dirname, '..', 'config', 'users.json');
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (e) {
    console.error('加载用户配置失败，将使用默认账号:', e.message);
    return {
      users: [{ username: 'admin', password: 'admin123', displayName: '管理员', role: 'admin' }],
      sessionSecret: 'fallback-secret',
    };
  }
}

const userConfig = loadUserConfig();
const sessions = new Map(); // token -> { username, displayName, role, createdAt }
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;

function createSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, {
    username: user.username,
    displayName: user.displayName || user.username,
    role: user.role || 'user',
    createdAt: Date.now(),
  });
  return token;
}

function getSession(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL) {
    sessions.delete(token);
    return null;
  }
  return s;
}

function requireAuth(req, res, next) {
  const session = getSession(req.cookies?.kb_token);
  if (!session) return res.status(401).json({ error: '未登录' });
  req.user = session;
  next();
}

module.exports = {
  userConfig,
  sessions,
  SESSION_TTL,
  createSession,
  getSession,
  requireAuth,
};