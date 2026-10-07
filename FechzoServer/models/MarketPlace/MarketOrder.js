const mongoose = require("mongoose");

/* =====================================================
   ORDER ITEM (SNAPSHOT)
===================================================== */
const orderItemSchema = new mongoose.Schema(
  {
    // ===================================================
    // UNIQUE ITEM ID
    // Used for item-level return/cancellation tracking
    // ===================================================
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      index: true,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    variant: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    // Snapshot data
    name: {
      type: String,
      required: true,
    },

    brand: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    sku: {
      type: String,
      default: "",
    },

    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    mrp: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

/* =====================================================
   ADDRESS SNAPSHOT
===================================================== */
const addressSnapshotSchema = new mongoose.Schema(
  {
    doorNo: String,
    street: String,
    landmark: String,
    city: String,
    state: String,
    pincode: String,

    latitude: Number,
    longitude: Number,

    name: String,
    phone: String,
    type: String,
  },
  {
    _id: false,
  }
);

/* =====================================================
   APPLIED OFFER SNAPSHOT
===================================================== */
const appliedOfferSchema = new mongoose.Schema(
  {
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StoreOffer",
      default: null,
    },

    title: {
      type: String,
      default: "",
    },

    offerType: {
      type: String,
      enum: ["percentage", "flat", "free_delivery", null],
      default: null,
    },

    discountValue: {
      type: Number,
      default: 0,
    },

    maxDiscount: {
      type: Number,
      default: null,
    },

    minOrderValue: {
      type: Number,
      default: 0,
    },

    couponCode: {
      type: String,
      default: null,
    },

    badgeText: {
      type: String,
      default: "",
    },

    discountAmount: {
      type: Number,
      default: 0,
    },
  },
  {
    _id: false,
  }
);

/* =====================================================
   MARKET ORDER SCHEMA
===================================================== */
const marketOrderSchema = new mongoose.Schema(
  {
    // ===================================================
    // ORDER ID
    // ===================================================
    orderId: {
      type: String,
      unique: true,
      required: true,
      index: true,
    },

    // ===================================================
    // USER
    // ===================================================
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ===================================================
    // STORE
    // ===================================================
    store: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    storeType: {
      type: String,
      enum: ["grocery", "fashion", "electronics"],
      required: true,
      index: true,
    },

    // ===================================================
    // ITEMS
    // ===================================================
    items: {
      type: [orderItemSchema],
      required: true,
      validate: [
        (v) => v.length > 0,
        "Order must have at least one item",
      ],
    },

    // ===================================================
    // DELIVERY ADDRESS
    // ===================================================
    deliveryAddress: {
      type: addressSnapshotSchema,
      required: true,
    },

    // ===================================================
    // PRICING
    // ===================================================
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },

    deliveryCharge: {
      type: Number,
      default: 0,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    tax: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ===================================================
    // OFFER
    // ===================================================
    appliedOffer: {
      type: appliedOfferSchema,
      default: () => ({}),
    },

    couponCode: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
    },

    // ===================================================
    // PAYMENT
    // ===================================================
    paymentMethod: {
      type: String,
      enum: ["COD", "Online"],
      default: "COD",
    },

    paymentStatus: {
      type: String,
      enum: [
        "Pending",
        "Paid",
        "Failed",
        "Refunded",
      ],
      default: "Pending",
    },

    paymentId: {
      type: String,
      default: null,
    },

    razorpayOrderId: {
      type: String,
      default: null,
    },

    // ===================================================
    // STATUS
    // ===================================================
    status: {
      type: String,
      enum: [
        "Placed",
        "Confirmed",
        "Packed",
        "Shipped",
        "Out for Delivery",
        "Delivered",
        "Cancelled",
        "Returned",
        "Refunded",
      ],
      default: "Placed",
      index: true,
    },

    // ===================================================
    // TRACKING
    // ===================================================
    trackingId: {
      type: String,
      default: null,
    },

    courier: {
      type: String,
      default: null,
    },

    estimatedDelivery: {
      type: Date,
      default: null,
    },

    // ===================================================
    // DELIVERY COMPLETION
    // Important for return-window calculation
    // ===================================================
    deliveredAt: {
      type: Date,
      default: null,
      index: true,
    },

    // ===================================================
    // NOTES
    // ===================================================
    customerNote: {
      type: String,
      default: "",
    },

    adminNote: {
      type: String,
      default: "",
    },

    // ===================================================
    // CANCEL
    // ===================================================
    cancelReason: {
      type: String,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelledBy: {
      type: String,
      enum: ["user", "store", "admin", null],
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* =====================================================
   INDEXES
===================================================== */

marketOrderSchema.index({
  user: 1,
  createdAt: -1,
});

marketOrderSchema.index({
  store: 1,
  status: 1,
});

marketOrderSchema.index({
  storeType: 1,
  status: 1,
});

marketOrderSchema.index({
  orderId: 1,
});

marketOrderSchema.index({
  paymentStatus: 1,
});

marketOrderSchema.index({
  "appliedOffer.offerId": 1,
});

marketOrderSchema.index({
  couponCode: 1,
});

marketOrderSchema.index({
  "items.itemId": 1,
});

/* =====================================================
   MODEL
===================================================== */

module.exports =
  mongoose.models.MarketOrder ||
  mongoose.model(
    "MarketOrder",
    marketOrderSchema,
    "market_orders"
  );