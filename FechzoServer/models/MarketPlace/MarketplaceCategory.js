const mongoose = require("mongoose");

const marketplaceCategorySchema = new mongoose.Schema(
  {
    categoryId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    icon: {
      type: String,
      default: "",
    },

    image: {
      type: String,
      default: "",
    },

    parentCategory: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MarketplaceCategory",
      default: null,
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

marketplaceCategorySchema.index({
  parentCategory: 1,
  isActive: 1,
});

marketplaceCategorySchema.index({
  slug: 1,
});

module.exports =
  mongoose.models.MarketplaceCategory ||
  mongoose.model(
    "MarketplaceCategory",
    marketplaceCategorySchema,
    "marketplacecategories"
  );