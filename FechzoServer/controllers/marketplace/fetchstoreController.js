const Store = require("../../models/MarketPlace/Store"); // adjust path if needed

// ============================================
// GET STORES BY TYPE (for Grocery / Fashion / Electronics)
// ============================================
exports.getStoresByType = async (req, res) => {
  try {
    const { storeType, status = "approved" } = req.query;

    if (!storeType) {
      return res.status(400).json({
        success: false,
        message: "storeType is required (grocery, fashion, electronic)",
      });
    }

    // Validate storeType
    const allowedTypes = ["grocery", "fashion", "electronic"];
    if (!allowedTypes.includes(storeType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid storeType. Allowed: grocery, fashion, electronic",
      });
    }

    const filter = {
      storeType,
      status,
      isDeleted: false,
    };

    const stores = await Store.find(filter)
      .select(
        "storeName storeType description logo banner storefrontImage images isOpen address minOrderValue deliveryRadius rating createdAt"
      )
      .sort({ isOpen: -1, createdAt: -1 }); // Open stores first

    res.status(200).json({
      success: true,
      count: stores.length,
      stores,
    });
  } catch (error) {
    console.error("getStoresByType error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching stores",
      error: error.message,
    });
  }
};

// ============================================
// GET SINGLE STORE BY ID
// ============================================
exports.getStoreById = async (req, res) => {
  try {
    const { id } = req.params;

    const store = await Store.findOne({
      _id: id,
      isDeleted: false,
      status: "approved",
    }).select("-loginCredentials -documents -bankDetails");

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found",
      });
    }

    res.status(200).json({
      success: true,
      store,
    });
  } catch (error) {
    console.error("getStoreById error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// ============================================
// GET ALL APPROVED STORES (optional - for homepage)
// ============================================
exports.getAllApprovedStores = async (req, res) => {
  try {
    const stores = await Store.find({
      status: "approved",
      isDeleted: false,
    })
      .select(
        "storeName storeType logo banner storefrontImage isOpen address minOrderValue"
      )
      .sort({ isOpen: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: stores.length,
      stores,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};