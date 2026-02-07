const jwt = require('jsonwebtoken');

module.exports = function (req, res, next) {
  const token = req.cookies.adminToken;
  
  if (!token) {
    console.log('No adminToken in cookies');
    return res.status(401).json({ success: false, message: 'Not authenticated' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    console.log('Token verification failed:', err);
    return res.status(403).json({ success: false, message: 'Invalid token' });
  }
};
