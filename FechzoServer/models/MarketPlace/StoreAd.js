import mongoose from "mongoose";

const storeAdSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String,
      required: true,
    },
    mobileImage: {
      type: String,
    },
    ctaText: {
      type: String,
      default: "Shop Now",
    },
    ctaLink: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["hero", "secondary", "sponsored", "strip", "banner"],
      required: true,
    },
    position: {
      type: String,
      enum: ["home-hero", "home-secondary", "home-sponsored", "home-strip", "category-top"],
      required: true,
    },
    categories: [
      {
        type: String,
        enum: ["grocery", "fashion", "electronics", "all"],
      },
    ],
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    priority: {
      type: Number,
      default: 0,
    },
    badge: {
      type: String,
    },
    bgColor: {
      type: String,
    },
    icon: {
      type: String,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    discountText: {
      type: String,
    },
    price: String,
    originalPrice: String,
  },
  { timestamps: true }
);

// Indexes
storeAdSchema.index({ isActive: 1, position: 1, priority: -1 });
storeAdSchema.index({ startDate: 1, endDate: 1 });

// Prevent OverwriteModelError
const StoreAd = mongoose.models.StoreAd || mongoose.model("StoreAd", storeAdSchema);

export default StoreAd;