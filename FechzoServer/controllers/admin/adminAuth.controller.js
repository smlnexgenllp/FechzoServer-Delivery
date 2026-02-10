// controllers/admin/adminAuth.controller.js
const jwt = require("jsonwebtoken");
const Admin = require("../../models/Admin/admin");

const adminLogin = async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  // (skip hash check for now if needed)
  if (password !== admin.password) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    {
      id: admin._id,
      role: "ADMIN", // 🔥 THIS IS CRITICAL
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  res.json({ token });
};

module.exports = { adminLogin };
