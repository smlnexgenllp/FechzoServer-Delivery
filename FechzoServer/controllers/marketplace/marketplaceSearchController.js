const Product = require("../../models/MarketPlace/Product");
const Store = require("../../models/MarketPlace/Store");

// =====================================================
// MARKETPLACE SEARCH
// GET /api/marketplace/search?q=rice
// =====================================================

exports.searchMarketplace = async (req, res) => {
  try {
    const { q } = req.query;

    // -------------------------------------------------
    // Validate search text
    // -------------------------------------------------
    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const search = q.trim();

    // -------------------------------------------------
    // Search Regex
    // -------------------------------------------------
    const searchRegex = new RegExp(search, "i");

    // =================================================
    // 1. SEARCH STORES
    // =================================================

    const stores = await Store.find({
      status: "approved",
      isDeleted: false,

      $or: [
        { storeName: searchRegex },
        { description: searchRegex },
        { storeType: searchRegex },
      ],
    })
      .select(
        "storeName storeType description logo banner storefrontImage isOpen address minOrderValue deliveryRadius rating"
      )
      .sort({
        isOpen: -1,
        rating: -1,
        createdAt: -1,
      })
      .limit(10);

    // =================================================
    // 2. SEARCH PRODUCTS
    // =================================================

    const products = await Product.find({
      status: "approved",
      isActive: true,
      isDeleted: false,

      $or: [
        { name: searchRegex },
        { brand: searchRegex },
        { description: searchRegex },
        { shortDescription: searchRegex },
        { slug: searchRegex },
      ],
    })
      .populate(
        "storeId",
        "storeName storeType logo banner isOpen rating address"
      )
      .populate(
        "categoryId",
        "name slug parentCategory"
      )
      .sort({
        createdAt: -1,
      })
      .limit(30);

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({
      success: true,
      query: search,

      stores: {
        count: stores.length,
        results: stores,
      },

      products: {
        count: products.length,
        results: products,
      },
    });
  } catch (error) {
    console.error("Marketplace search error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error while searching marketplace",
      error: error.message,
    });
  }
};