const mongoose = require("mongoose");

/* =====================================================
   RETURN REQUEST
===================================================== */

const returnRequestSchema = new mongoose.Schema(
  {
    // ===================================================
    // ORDER
    // ===================================================
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketOrder",
      required: true,
      index: true,
    },

    // Human readable order ID
    orderId: {
      type: String,
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

    // ===================================================
    // ORDER ITEM
    // ===================================================
    orderItemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
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

    // ===================================================
    // ITEM SNAPSHOT
    // ===================================================
    productName: {
      type: String,
      required: true,
    },

    productImage: {
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

    // ===================================================
    // QUANTITY
    // ===================================================
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    // ===================================================
    // PRICE SNAPSHOT
    // ===================================================
    itemPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    // ===================================================
    // RETURN REASON
    // ===================================================
    reason: {
      type: String,
      enum: [
        "Size/Fit issue",
        "Wrong product received",
        "Damaged product",
        "Defective product",
        "Product not as expected",
        "Missing item",
        "Other",
      ],
      required: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 1000,
    },

    // ===================================================
    // RETURN IMAGES
    // Cloudinary URLs etc.
    // ===================================================
    images: {
      type: [String],
      default: [],
    },

    // ===================================================
    // RETURN STATUS
    // ===================================================
    status: {
      type: String,
      enum: [
        "Requested",
        "Approved",
        "Rejected",
        "Pickup Scheduled",
        "Picked Up",
        "Received",
        "Refunded",
        "Cancelled",
      ],
      default: "Requested",
      index: true,
    },

    // ===================================================
    // REJECTION
    // ===================================================
    rejectionReason: {
      type: String,
      default: "",
    },

    // ===================================================
    // REFUND
    // ===================================================
    refundStatus: {
      type: String,
      enum: [
        "Not Applicable",
        "Pending",
        "Processing",
        "Completed",
        "Failed",
      ],
      default: "Pending",
      index: true,
    },

    refundMethod: {
      type: String,
      enum: [
        "Original Payment",
        "Bank Transfer",
        "UPI",
        "Wallet",
        null,
      ],
      default: null,
    },

    refundReference: {
      type: String,
      default: null,
    },

    // ===================================================
    // DATES
    // ===================================================
    requestedAt: {
      type: Date,
      default: Date.now,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectedAt: {
      type: Date,
      default: null,
    },

    pickedUpAt: {
      type: Date,
      default: null,
    },

    receivedAt: {
      type: Date,
      default: null,
    },

    refundedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    // ===================================================
    // NOTES
    // ===================================================
    adminNote: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

/* =====================================================
   INDEXES
===================================================== */

returnRequestSchema.index({
  user: 1,
  createdAt: -1,
});

returnRequestSchema.index({
  store: 1,
  status: 1,
});

returnRequestSchema.index({
  order: 1,
  orderItemId: 1,
});

returnRequestSchema.index({
  orderId: 1,
});

returnRequestSchema.index({
  refundStatus: 1,
});

/* =====================================================
   MODEL
===================================================== */

module.exports =
  mongoose.models.ReturnRequest ||
  mongoose.model(
    "ReturnRequest",
    returnRequestSchema,
    "return_requests"
  );