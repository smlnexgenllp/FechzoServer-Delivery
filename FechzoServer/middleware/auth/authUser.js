const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  console.log('[authUser] Running for:', req.method, req.originalUrl);

  const authHeader = req.headers.authorization;
  console.log('[authUser] Raw Authorization header:', authHeader || '(missing)');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('[authUser] Missing or invalid Bearer token');
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  console.log('[authUser] Extracted token (first 20 chars):', token.substring(0, 20) + '...');

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('[authUser] Token decoded successfully:', decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('[authUser] JWT verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};