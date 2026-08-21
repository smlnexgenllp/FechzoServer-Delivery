const jwt = require("jsonwebtoken");
const Store = require("../../models/MarketPlace/Store");

const protectStore = async (req, res, next) => {
  try {
    let token;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer ")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Not authorized. Please login.",
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    if (decoded.type !== "store") {
      return res.status(401).json({
        success: false,
        message: "Invalid store authentication",
      });
    }

    const store = await Store.findOne({
      _id: decoded.storeId,
      isDeleted: false,
      status: "approved",
    }).select("-loginCredentials.password");

    if (!store) {
      return res.status(401).json({
        success: false,
        message: "Store not found or access denied",
      });
    }

    req.store = store;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = protectStore;