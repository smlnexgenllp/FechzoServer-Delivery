// controllers/adminStoreController.js  (or your existing admin controller)

const MarketOrder = require("../../../models/MarketPlace/MarketOrder"); // adjust path
const Product = require("../../../models/MarketPlace/Product");

// GET /api/stores/admin/:storeId/orders
exports.getStoreOrders = async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      status,
      page = 1,
      limit = 15,
      search = "",
      dateFilter = "today", // today | yesterday | week | month | custom | all
      startDate,
      endDate,
    } = req.query;

    const filter = { store: storeId };

    // Status filter
    if (status && status !== "all") {
      filter.status = status;
    }

    // Search (orderId / customer name / phone)
    if (search.trim()) {
      filter.$or = [
        { orderId: { $regex: search.trim(), $options: "i" } },
        { "deliveryAddress.name": { $regex: search.trim(), $options: "i" } },
        { "deliveryAddress.phone": { $regex: search.trim(), $options: "i" } },
      ];
    }

    // Date filter
    const now = new Date();
    let start, end;

    if (dateFilter === "today") {
      start = new Date(now.setHours(0, 0, 0, 0));
      end = new Date(now.setHours(23, 59, 59, 999));
    } else if (dateFilter === "yesterday") {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      start = new Date(yesterday.setHours(0, 0, 0, 0));
      end = new Date(yesterday.setHours(23, 59, 59, 999));
    } else if (dateFilter === "week") {
      start = new Date();
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      end = new Date();
    } else if (dateFilter === "month") {
      start = new Date();
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      end = new Date();
    } else if (dateFilter === "custom" && startDate && endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    }

    if (start && end) {
      filter.createdAt = { $gte: start, $lte: end };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      MarketOrder.find(filter)
        .populate("user", "name email phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      MarketOrder.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (error) {
    console.error("getStoreOrders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch store orders",
    });
  }
};

// GET /api/marketplace/admin/stores/:storeId/menus
exports.getStoreMenus = async (req, res) => {
  try {
    const { storeId } = req.params;
    const {
      status = "all",
      isActive,
      search = "",
      page = 1,
      limit = 15,
    } = req.query;

    const filter = {
      storeId,
      isDeleted: false,
    };

    // Status filter
    if (status && status !== "all") {
      filter.status = status;
    }

    // Active filter
    if (isActive === "true") filter.isActive = true;
    if (isActive === "false") filter.isActive = false;

    // Search
    if (search.trim()) {
      filter.$or = [
        { name: { $regex: search.trim(), $options: "i" } },
        { brand: { $regex: search.trim(), $options: "i" } },
        { productId: { $regex: search.trim(), $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("categoryId", "name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      Product.countDocuments(filter),
    ]);

    res.status(200).json({
      success: true,
      data: products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    });
  } catch (error) {
    console.error("getStoreMenus error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch store menus",
    });
  }
};