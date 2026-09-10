const Wishlist = require("../../models/MarketPlace/Wishlist");

// =====================================================
// ADD TO WISHLIST
// =====================================================
exports.addToWishlist = async (req, res) => {
  try {
    // JWT contains "id", not "_id"
    const userId = req.user?.id;
    const { productId } = req.body;

    console.log("Add Wishlist:");
    console.log("User ID:", userId);
    console.log("Product ID:", productId);

    // Check authentication
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Check product ID
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    // Check if already exists
    const existing = await Wishlist.findOne({
      userId,
      productId,
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        message: "Already in wishlist",
        wishlist: existing,
      });
    }

    // Create wishlist
    const wishlist = await Wishlist.create({
      userId,
      productId,
    });

    console.log("Wishlist created:", wishlist);

    return res.status(201).json({
      success: true,
      message: "Added to wishlist",
      wishlist,
    });
  } catch (error) {
    console.error("Add wishlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to add wishlist",
      error: error.message,
    });
  }
};


// =====================================================
// REMOVE FROM WISHLIST
// =====================================================
exports.removeFromWishlist = async (req, res) => {
  try {
    // JWT contains "id"
    const userId = req.user?.id;
    const { productId } = req.body;

    console.log("Remove Wishlist:");
    console.log("User ID:", userId);
    console.log("Product ID:", productId);

    // Check authentication
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Check product ID
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const deleted = await Wishlist.findOneAndDelete({
      userId,
      productId,
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Product not found in wishlist",
      });
    }

    return res.json({
      success: true,
      message: "Removed from wishlist",
    });
  } catch (error) {
    console.error("Remove wishlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to remove wishlist",
      error: error.message,
    });
  }
};


// =====================================================
// GET USER WISHLIST
// =====================================================
exports.getWishlist = async (req, res) => {
  try {
    // JWT contains "id"
    const userId = req.user?.id;

    console.log("Get Wishlist User ID:", userId);

    // Check authentication
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const wishlist = await Wishlist.find({
      userId,
    })
      .populate("productId")
      .sort({ createdAt: -1 });

    return res.json({
      success: true,
      wishlist,
    });
  } catch (error) {
    console.error("Get wishlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch wishlist",
      error: error.message,
    });
  }
};


// =====================================================
// CHECK PRODUCT WISHLIST STATUS
// =====================================================
exports.checkWishlist = async (req, res) => {
  try {
    // JWT contains "id"
    const userId = req.user?.id;
    const { productId } = req.query;

    console.log("Check Wishlist:");
    console.log("User ID:", userId);
    console.log("Product ID:", productId);

    // Check authentication
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Check product ID
    if (!productId) {
      return res.status(400).json({
        success: false,
        message: "Product ID is required",
      });
    }

    const existing = await Wishlist.findOne({
      userId,
      productId,
    });

    return res.json({
      success: true,
      isWishlisted: Boolean(existing),
    });
  } catch (error) {
    console.error("Check wishlist error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to check wishlist",
      error: error.message,
    });
  }
};