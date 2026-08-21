const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    // ======================
    // PRODUCT ID
    // ======================
    productId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // ======================
    // STORE
    // ======================
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    // ======================
    // BRANCH
    // ======================
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null,
      index: true,
    },

    // ======================
    // MAIN CATEGORY
    // ======================
    mainCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    // ======================
    // PRODUCT CATEGORY
    // ======================
    productCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    // ======================
    // BASIC DETAILS
    // ======================
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    brand: {
      type: String,
      default: "",
      trim: true,
    },

    // ======================
    // PRODUCT IMAGES
    // ======================
    images: {
      type: [String],
      default: [],
    },

    // ======================
    // PRICE
    // ======================
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discountPrice: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ======================
    // INVENTORY
    // ======================
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    unit: {
      type: String,
      default: "piece",
      trim: true,
    },

    sku: {
      type: String,
      default: "",
      trim: true,
    },

    // ======================
    // FLIPKART-STYLE HIGHLIGHTS
    // ======================
    highlights: {
      type: [String],
      default: [],
    },

    // ======================
    // DYNAMIC ATTRIBUTES
    // ======================
    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // ======================
    // RATINGS
    // ======================
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    reviewCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // ======================
    // DELIVERY
    // ======================
    deliveryInfo: {
      type: String,
      default: "Free Delivery",
      trim: true,
    },

    // ======================
    // RETURN POLICY
    // ======================
    returnPolicy: {
      type: String,
      default: "7 Days Replacement",
      trim: true,
    },

    // ======================
    // AVAILABILITY
    // ======================
    isAvailable: {
      type: Boolean,
      default: true,
    },

    // ======================
    // ACTIVE STATUS
    // ======================
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ======================
// INDEXES
// ======================

productSchema.index({
  storeId: 1,
  branchId: 1,
});

productSchema.index({
  mainCategory: 1,
  productCategory: 1,
});

productSchema.index({
  storeId: 1,
  isActive: 1,
  isAvailable: 1,
});

productSchema.index({
  name: "text",
  description: "text",
  brand: "text",
});

// ======================
// MODEL
// ======================

module.exports =
  mongoose.models.Product ||
  mongoose.model(
    "Product",
    productSchema,
    "products"
  );