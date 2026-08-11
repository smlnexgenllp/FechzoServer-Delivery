const mongoose = require("mongoose");

const productCategorySchema = new mongoose.Schema(
  {
    categoryId: {
      type: String,
      required: true,
      unique: true
    },

    mainCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },

    name: {
      type: String,
      required: true
    },

    slug: {
      type: String,
      required: true
    },

    image: String,

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
  "ProductCategory",
  productCategorySchema,
  "productcategories"
);