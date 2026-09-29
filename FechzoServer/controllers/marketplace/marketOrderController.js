const MarketOrder = require("../../models/MarketPlace/MarketOrder");
const Product = require("../../models/MarketPlace/Product"); // adjust path
const User = require("../../models/User/User"); // adjust path
const StoreOffer = require("../../models/MarketPlace/StoreOffers"); // adjust path
const mongoose = require("mongoose");

// =====================================================
// GENERATE ORDER ID
// =====================================================
const generateOrderId = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 9000 + 1000);
  return `FM${timestamp}${random}`;
};

// =====================================================
// HELPERS
// =====================================================
const cleanId = (value) => {
  if (!value) return null;
  if (typeof value === "object") {
    return value._id
      ? String(value._id)
      : value.id
      ? String(value.id)
      : null;
  }
  return String(value);
};

const calculateOfferDiscount = (offer, subtotal) => {
  if (!offer || subtotal <= 0) {
    return { discountAmount: 0, freeDelivery: false };
  }

  if (subtotal < (Number(offer.minOrderValue) || 0)) {
    return { discountAmount: 0, freeDelivery: false };
  }

  if (offer.offerType === "free_delivery") {
    return { discountAmount: 0, freeDelivery: true };
  }

  let discountAmount = 0;

  if (offer.offerType === "percentage") {
    discountAmount = (subtotal * Number(offer.discountValue || 0)) / 100;
    if (offer.maxDiscount != null) {
      discountAmount = Math.min(discountAmount, Number(offer.maxDiscount));
    }
  } else if (offer.offerType === "flat") {
    discountAmount = Number(offer.discountValue) || 0;
  }

  discountAmount = Math.min(discountAmount, subtotal);
  discountAmount = Math.round(discountAmount * 100) / 100;

  return { discountAmount, freeDelivery: false };
};

// =====================================================
// CREATE ORDER
// =====================================================
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
      // Offer fields from frontend (optional – server re-validates)
      appliedOfferId,
      couponCode,
    } = req.body;

    const cleanUserId = cleanId(userId);
    const cleanStoreId = cleanId(storeId);

    // ---------- Validation ----------
    if (
      !cleanUserId ||
      !cleanStoreId ||
      !storeType ||
      !items?.length ||
      !deliveryAddress
    ) {
      return res.status(400).json({
        error:
          "userId, storeId, storeType, items and deliveryAddress are required",
      });
    }

    if (cleanUserId.length !== 24 || cleanStoreId.length !== 24) {
      return res.status(400).json({
        error: "Invalid userId or storeId format",
      });
    }

    if (!["grocery", "fashion", "electronics"].includes(storeType)) {
      return res.status(400).json({ error: "Invalid storeType" });
    }

    // ---------- Build order items with snapshot ----------
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const productId = cleanId(item.productId);
      if (!productId) {
        return res.status(400).json({ error: "Invalid productId in items" });
      }

      const product = await Product.findById(productId);
      if (!product || product.isDeleted || !product.isActive) {
        return res.status(400).json({
          error: `Product not available: ${productId}`,
        });
      }

      let variant = null;
      let price = 0;
      let mrp = 0;
      let sku = "";
      let attributes = {};
      let image = product.thumbnail || product.images?.[0] || "";

      if (item.variantId) {
        const variantId = cleanId(item.variantId);
        variant = product.variants.id(variantId);

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
        if (product.variants && product.variants.length > 0) {
          return res.status(400).json({
            error: `Please select a variant for ${product.name}`,
          });
        }
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

    // ---------- OFFER: validate & calculate (server-side) ----------
    let discount = 0;
    let deliveryCharge = 0;
    let appliedOfferSnapshot = {
      offerId: null,
      title: "",
      offerType: null,
      discountValue: 0,
      maxDiscount: null,
      minOrderValue: 0,
      couponCode: null,
      badgeText: "",
      discountAmount: 0,
    };

    const now = new Date();
    let offerDoc = null;

    // 1) By appliedOfferId
    if (appliedOfferId && mongoose.Types.ObjectId.isValid(String(appliedOfferId))) {
      offerDoc = await StoreOffer.findOne({
        _id: appliedOfferId,
        storeId: cleanStoreId,
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      });
    }

    // 2) By coupon code
    if (!offerDoc && couponCode) {
      offerDoc = await StoreOffer.findOne({
        storeId: cleanStoreId,
        isCoupon: true,
        couponCode: String(couponCode).toUpperCase().trim(),
        isActive: true,
        startDate: { $lte: now },
        endDate: { $gte: now },
      });
    }

    // 3) Best auto offer (no coupon) for this store
    if (!offerDoc) {
      const autoOffers = await StoreOffer.find({
        storeId: cleanStoreId,
        isActive: true,
        isCoupon: false,
        startDate: { $lte: now },
        endDate: { $gte: now },
      }).lean();

      let best = null;
      let bestDiscount = 0;

      for (const o of autoOffers) {
        const { discountAmount } = calculateOfferDiscount(o, subtotal);
        if (discountAmount > bestDiscount) {
          bestDiscount = discountAmount;
          best = o;
        }
      }

      if (best) {
        offerDoc = best;
      }
    }

    // Usage limit
    if (
      offerDoc &&
      offerDoc.usageLimit != null &&
      Number(offerDoc.usedCount || 0) >= Number(offerDoc.usageLimit)
    ) {
      offerDoc = null;
    }

    if (offerDoc) {
      const { discountAmount, freeDelivery } = calculateOfferDiscount(
        offerDoc,
        subtotal
      );

      discount = discountAmount;
      if (freeDelivery) {
        deliveryCharge = 0;
      }

      appliedOfferSnapshot = {
        offerId: offerDoc._id,
        title: offerDoc.title || "",
        offerType: offerDoc.offerType || null,
        discountValue: Number(offerDoc.discountValue) || 0,
        maxDiscount:
          offerDoc.maxDiscount != null ? Number(offerDoc.maxDiscount) : null,
        minOrderValue: Number(offerDoc.minOrderValue) || 0,
        couponCode: offerDoc.couponCode || null,
        badgeText: offerDoc.badgeText || "",
        discountAmount: discount,
      };

      // Increment used count
      await StoreOffer.updateOne(
        { _id: offerDoc._id },
        { $inc: { usedCount: 1 } }
      );
    }

    const tax = 0;
    const totalAmount = Math.max(
      0,
      subtotal + deliveryCharge - discount + tax
    );

    // ---------- Create Order ----------
    const order = await MarketOrder.create({
      orderId: generateOrderId(),
      user: cleanUserId,
      store: cleanStoreId,
      storeType,
      items: orderItems,
      deliveryAddress,
      subtotal,
      deliveryCharge,
      discount,
      tax,
      totalAmount,
      paymentMethod,
      paymentStatus: "Pending",
      customerNote,
      status: "Placed",
      appliedOffer: appliedOfferSnapshot,
      couponCode: appliedOfferSnapshot.couponCode || null,
    });

    res.status(201).json({
      message: "Order placed successfully",
      order,
    });
  } catch (error) {
    console.error("Create Market Order Error:", error);
    res.status(500).json({
      error: error.message || "Internal server error",
    });
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
      order.cancelledBy = "store";
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