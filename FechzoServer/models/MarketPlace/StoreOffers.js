const mongoose = require("mongoose");

const storeOfferSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    offerType: {
      type: String,
      enum: ["percentage", "flat", "free_delivery"],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscount: {
      type: Number,
      default: null, // only for percentage
    },
    minOrderValue: {
      type: Number,
      default: 0,
    },
    couponCode: {
      type: String,
      default: null,
      uppercase: true,
      trim: true,
    },
    isCoupon: {
      type: Boolean,
      default: false,
    },
    // Store scope
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store", // adjust if your store model name is different
      required: true,
      index: true,
    },
    // Optional product-level (empty = whole store)
    productIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
    usageLimit: {
      type: Number,
      default: null, // null = unlimited
    },
    usagePerUser: {
      type: Number,
      default: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    badgeText: {
      type: String,
      default: "",
    },
    createdBy: {
      type: String,
      enum: ["store", "admin"],
      default: "store",
    },
  },
  { timestamps: true }
);

// Unique coupon per store (when coupon is set)
storeOfferSchema.index(
  { storeId: 1, couponCode: 1 },
  {
    unique: true,
    partialFilterExpression: { couponCode: { $type: "string" } },
  }
);

module.exports = mongoose.model("StoreOffer", storeOfferSchema);