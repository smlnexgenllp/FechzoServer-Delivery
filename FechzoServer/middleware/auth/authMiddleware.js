const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
dotenv.config();

const authMiddleware = (req, res, next) => {
  console.log('Auth middleware: Checking token');
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    console.log('Auth middleware: No token provided');
    return res.status(401).json({ message: 'No token provided, authorization denied' });
  }

  try {
    console.log('Auth middleware: Verifying token');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Will contain adminId and username for admin tokens
    console.log('Auth middleware: Token verified, decoded:', decoded);
    next();
  } catch (error) {
    console.error('Auth middleware: Invalid token', {
      message: error.message,
      stack: error.stack
    });
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authMiddleware;