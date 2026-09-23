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

    // ============================================================
    // VERIFY TOKEN
    // ============================================================

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // ============================================================
    // CHECK STORE TOKEN
    // ============================================================

    if (decoded.type !== "store") {
      return res.status(401).json({
        success: false,
        message: "Invalid store authentication",
      });
    }

    if (!decoded.storeId) {
      return res.status(401).json({
        success: false,
        message: "Invalid store token",
      });
    }

    // ============================================================
    // FIND STORE
    // ============================================================

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

    // ============================================================
    // ATTACH STORE TO REQUEST
    // ============================================================

    req.store = store;

    // JWT data also available
    req.storeToken = decoded;

    // Compatibility
    req.user = decoded;

    // ============================================================
    // DEBUG
    // ============================================================

    console.log("========== STORE AUTH ==========");
    console.log(
      "Token Store ID:",
      decoded.storeId
    );
    console.log(
      "Authenticated Store:",
      store._id.toString()
    );
    console.log(
      "Username:",
      decoded.username
    );
    console.log(
      "Token Type:",
      decoded.type
    );
    console.log("================================");

    next();

  } catch (error) {

    console.error(
      "Store authentication error:",
      error.message
    );

    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};

module.exports = protectStore;