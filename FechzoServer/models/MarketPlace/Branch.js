const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
  {
    branchId: {
      type: String,
      required: true,
      unique: true
    },

    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true
    },

    branchName: {
      type: String,
      required: true
    },

    address: {
      shopNumber: String,
      area: String,
      city: String,
      state: String,
      postalCode: String,
      landmark: String,
      latitude: String,
      longitude: String,
      mapLink: String
    },

    phone: String,

    images: {
      profile: String,
      cover: String,
      gallery: {
        type: [String],
        default: []
      }
    },

    timings: {
      openTime: String,
      closeTime: String,
      days: {
        type: [String],
        default: []
      }
    },

    approvalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending"
    },

    rejectionReason: String,

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
  "Branch",
  branchSchema,
  "branches"
);