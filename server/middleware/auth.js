import jwt from 'jsonwebtoken';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.split(' ')[1];

  console.log(`[auth] ${req.method} ${req.path} | header=${authHeader ? authHeader.slice(0, 30) + '…' : 'MISSING'} | JWT_SECRET set=${!!process.env.JWT_SECRET}`);

  if (!token) {
    console.log('[auth] 401 — no token in Authorization header');
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(`[auth] OK — id=${decoded.id} role=${decoded.role} exp=${new Date(decoded.exp * 1000).toISOString()}`);
    req.user = decoded;
    next();
  } catch (err) {
    console.log(`[auth] 401 — jwt.verify failed: ${err.name}: ${err.message}`);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      console.log(`[auth] 403 — role=${req.user?.role} not in [${roles.join(',')}]`);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
