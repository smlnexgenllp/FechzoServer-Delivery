const Wishlist = require("../../models/MarketPlace/Wishlist");

exports.addToWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        message: "Product ID is required",
      });
    }

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

    const wishlist = await Wishlist.create({
      userId,
      productId,
    });

    res.status(201).json({
      success: true,
      message: "Added to wishlist",
      wishlist,
    });
  } catch (error) {
    console.error("Add wishlist error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add wishlist",
    });
  }
};

exports.removeFromWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({
        message: "Product ID is required",
      });
    }

    await Wishlist.findOneAndDelete({
      userId,
      productId,
    });

    res.json({
      success: true,
      message: "Removed from wishlist",
    });
  } catch (error) {
    console.error("Remove wishlist error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to remove wishlist",
    });
  }
};

exports.getWishlist = async (req, res) => {
  try {
    const userId = req.user._id;

    const wishlist = await Wishlist.find({
      userId,
    })
      .populate("productId")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      wishlist,
    });
  } catch (error) {
    console.error("Get wishlist error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch wishlist",
    });
  }
};

exports.checkWishlist = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productId } = req.query;

    if (!productId) {
      return res.status(400).json({
        message: "Product ID is required",
      });
    }

    const existing = await Wishlist.findOne({
      userId,
      productId,
    });

    res.json({
      success: true,
      isWishlisted: Boolean(existing),
    });
  } catch (error) {
    console.error("Check wishlist error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to check wishlist",
    });
  }
};