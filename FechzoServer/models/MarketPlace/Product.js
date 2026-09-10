const mongoose = require("mongoose");

// =====================================================
// VARIANT SCHEMA
// =====================================================
const variantSchema = new mongoose.Schema(
  {
    // =========================
    // SKU
    // =========================
    sku: {
      type: String,
      required: true,
      trim: true,
    },

    // =========================
    // ATTRIBUTES
    // Example:
    // { color: "Black", size: "M" }
    // =========================
    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // =========================
    // VARIANT IMAGES
    // Images belonging to this color/variant
    // =========================
    images: {
      type: [String],
      default: [],
    },

    // =========================
    // SELLING PRICE
    // =========================
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    // =========================
    // MRP
    // =========================
    mrp: {
      type: Number,
      required: true,
      min: 0,
    },

    // =========================
    // STOCK
    // =========================
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: true,
  }
);

// =====================================================
// PRODUCT SCHEMA
// =====================================================
const productSchema = new mongoose.Schema(
  {
    // =========================
    // PRODUCT ID
    // =========================
    productId: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },

    // =========================
    // STORE
    // =========================
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    storeType: {
      type: String,
      enum: [
        "grocery",
        "fashion",
        "electronics",
      ],
      required: true,
      index: true,
    },

    // =========================
    // CATEGORY
    // =========================
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceCategory",
      required: true,
      index: true,
    },
    
    // =========================
    // BASIC DETAILS
    // =========================
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    brand: {
      type: String,
      default: "",
      trim: true,
    },
// =====================================================
// GENDER
// =====================================================
    gender: {
      type: String,
      enum: [
        "men",
        "women",
        "boys",
        "girls",
        "baby-kids",
        "unisex",
      ],
      default: null,
      index: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },

    shortDescription: {
      type: String,
      default: "",
      trim: true,
    },

    // =========================
    // DEFAULT PRODUCT IMAGES
    // =========================
    images: {
      type: [String],
      default: [],
    },

    thumbnail: {
      type: String,
      default: "",
    },

    // =========================
    // UNIT
    // =========================
    unitType: {
      type: String,
      enum: [
        "weight",
        "volume",
        "count",
        "length",
        "size",
        "other",
      ],
      default: "count",
    },

    unit: {
      type: String,
      default: "piece",
      trim: true,
    },

    // =========================
    // VARIANTS
    // =========================
    variants: {
      type: [variantSchema],
      default: [],
    },

    // =========================
    // SPECIFICATIONS
    // =========================
    specifications: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // =========================
    // STATUS
    // =========================
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "suspended",
      ],
      default: "pending",
      index: true,
    },

    // =========================
    // ACTIVE / DELETE
    // =========================
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    // =========================
    // RATING
    // =========================
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
  },
  {
    timestamps: true,
  }
);

// =====================================================
// INDEXES
// =====================================================

productSchema.index({
  storeId: 1,
  storeType: 1,
  gender: 1,
});

productSchema.index({
  categoryId: 1,
});

productSchema.index({
  storeId: 1,
  categoryId: 1,
});

productSchema.index({
  storeId: 1,
  isActive: 1,
  isDeleted: 1,
});

productSchema.index({
  name: "text",
  brand: "text",
  description: "text",
  shortDescription: "text",
});

// =====================================================
// MODEL
// =====================================================

module.exports =
  mongoose.models.Product ||
  mongoose.model(
    "Product",
    productSchema,
    "products"
  );