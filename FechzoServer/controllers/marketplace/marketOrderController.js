const MarketOrder = require("../../models/MarketPlace/MarketOrder");
const Product = require("../../models/MarketPlace/Product"); // adjust path
const User = require("../../models/User/User"); // adjust path

// =====================================================
// GENERATE ORDER ID
// =====================================================
const generateOrderId = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `FM${timestamp}${random}`;
};

const createOrder = async (req, res) => {
  try {
    const {
      userId,
      storeId,
      storeType,
      items, 
      deliveryAddress,
      paymentMethod = "COD",
      customerNote = "",
    } = req.body;
    if (
      !userId ||
      !storeId ||
      !storeType ||
      !items?.length ||
      !deliveryAddress
    ) {
      return res.status(400).json({
        error:
          "userId, storeId, storeType, items and deliveryAddress are required",
      });
    }

    if (!["grocery", "fashion", "electronics"].includes(storeType)) {
      return res.status(400).json({ error: "Invalid storeType" });
    }

    // ---------- Build order items with snapshot ----------
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product || product.isDeleted || !product.isActive) {
        return res.status(400).json({
          error: `Product not available: ${item.productId}`,
        });
      }

      let variant = null;
      let price = 0;
      let mrp = 0;
      let sku = "";
      let attributes = {};
      let image = product.thumbnail || product.images?.[0] || "";

      if (item.variantId) {
        variant = product.variants.id(item.variantId);
        if (!variant) {
          return res.status(400).json({
            error: `Variant not found for product ${product.name}`,
          });
        }
        if (variant.stock < item.quantity) {
          return res.status(400).json({
            error: `Insufficient stock for ${product.name}`,
          });
        }
        price = variant.price;
        mrp = variant.mrp;
        sku = variant.sku;
        attributes = variant.attributes || {};
        image = variant.images?.[0] || image;
      } else {
        // No variant – use first variant or throw
        if (product.variants.length > 0) {
          return res.status(400).json({
            error: `Please select a variant for ${product.name}`,
          });
        }
        // fallback if product has no variants (rare)
        price = 0;
        mrp = 0;
      }

      const quantity = Number(item.quantity) || 1;
      subtotal += price * quantity;

      orderItems.push({
        product: product._id,
        variant: variant?._id || null,
        name: product.name,
        brand: product.brand || "",
        image,
        sku,
        attributes,
        quantity,
        price,
        mrp,
      });
    }

    // ---------- Pricing ----------
    const deliveryCharge = 0; // you can calculate later
    const discount = 0;
    const tax = 0;
    const totalAmount = subtotal + deliveryCharge - discount + tax;

    // ---------- Create Order ----------
    const order = await MarketOrder.create({
      orderId: generateOrderId(),
      user: userId,
      store: storeId,
      storeType,
      items: orderItems,
      deliveryAddress,
      subtotal,
      deliveryCharge,
      discount,
      tax,
      totalAmount,
      paymentMethod,
      paymentStatus: paymentMethod === "COD" ? "Pending" : "Pending",
      customerNote,
      status: "Placed",
    });
    res.status(201).json({
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    console.error("Create Market Order Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =====================================================
// GET USER ORDERS
// =====================================================
const getUserOrders = async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, storeType, page = 1, limit = 10 } = req.query;

    const filter = { user: userId };
    if (status) filter.status = status;
    if (storeType) filter.storeType = storeType;

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      MarketOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("store", "name logo")
        .lean(),
      MarketOrder.countDocuments(filter),
    ]);

    res.status(200).json({
      orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get User Orders Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =====================================================
// GET SINGLE ORDER
// =====================================================
const getOrderById = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await MarketOrder.findOne({
      $or: [{ _id: orderId }, { orderId: orderId }],
    })
      .populate("store", "name logo phone address")
      .populate("user", "name email phone")
      .lean();

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.status(200).json({ order });
  } catch (error) {
    console.error("Get Order Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =====================================================
// UPDATE ORDER STATUS (Store / Admin)
// =====================================================
const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status, trackingId, courier, estimatedDelivery, adminNote } =
      req.body;

    const allowedStatus = [
      "Confirmed",
      "Packed",
      "Shipped",
      "Out for Delivery",
      "Delivered",
      "Cancelled",
      "Returned",
      "Refunded",
    ];

    if (status && !allowedStatus.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const order = await MarketOrder.findOne({
      $or: [{ _id: orderId }, { orderId: orderId }],
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (status) order.status = status;
    if (trackingId) order.trackingId = trackingId;
    if (courier) order.courier = courier;
    if (estimatedDelivery) order.estimatedDelivery = estimatedDelivery;
    if (adminNote) order.adminNote = adminNote;

    if (status === "Cancelled") {
      order.cancelledAt = new Date();
      order.cancelledBy = "store"; // or admin
    }

    await order.save();

    res.status(200).json({
      message: "Order status updated",
      order,
    });
  } catch (error) {
    console.error("Update Order Status Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =====================================================
// CANCEL ORDER (User)
// =====================================================
const cancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await MarketOrder.findOne({
      $or: [{ _id: orderId }, { orderId: orderId }],
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Only allow cancel if still early
    if (!["Placed", "Confirmed"].includes(order.status)) {
      return res.status(400).json({
        error: "Order cannot be cancelled at this stage",
      });
    }

    order.status = "Cancelled";
    order.cancelReason = reason || "Cancelled by user";
    order.cancelledAt = new Date();
    order.cancelledBy = "user";

    await order.save();

    res.status(200).json({
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    console.error("Cancel Order Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// =====================================================
// GET STORE ORDERS (for store dashboard)
// =====================================================
const getStoreOrders = async (req, res) => {
  try {
    const { storeId } = req.params;
    const { status, page = 1, limit = 20 } = req.query;

    const filter = { store: storeId };
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [orders, total] = await Promise.all([
      MarketOrder.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate("user", "name phone")
        .lean(),
      MarketOrder.countDocuments(filter),
    ]);

    res.status(200).json({
      orders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get Store Orders Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  getStoreOrders,
};
