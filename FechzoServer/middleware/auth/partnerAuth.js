const jwt = require("jsonwebtoken");

const partnerAuth = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔥 THIS IS REQUIRED
    req.partner = {
      id: decoded.id,
      phone: decoded.phone,
      role: decoded.role || "PARTNER",
    };

    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = partnerAuth;
