const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      unique: true
    },

    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true
    },

    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      default: null
    },

    mainCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },

    productCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductCategory",
      required: true
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      default: ""
    },

    brand: {
      type: String,
      default: ""
    },

    images: {
      type: [String],
      default: []
    },

    price: {
      type: Number,
      required: true,
      min: 0
    },

    discountPrice: {
      type: Number,
      default: 0
    },

    stock: {
      type: Number,
      default: 0
    },

    unit: {
      type: String,
      default: "piece"
    },

    sku: {
      type: String,
      default: ""
    },

    attributes: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },

    isAvailable: {
      type: Boolean,
      default: true
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "Product",
  productSchema,
  "products"
);