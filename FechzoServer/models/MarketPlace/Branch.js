const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
  {
    branchId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Store",
      required: true,
      index: true,
    },

    branchName: {
      type: String,
      required: true,
      trim: true,
    },

    address: {
      shopNumber: {
        type: String,
        default: "",
      },

      area: {
        type: String,
        default: "",
      },

      city: {
        type: String,
        default: "",
      },

      state: {
        type: String,
        default: "",
      },

      postalCode: {
        type: String,
        default: "",
      },

      landmark: {
        type: String,
        default: "",
      },

      latitude: {
        type: String,
        default: "",
      },

      longitude: {
        type: String,
        default: "",
      },

      mapLink: {
        type: String,
        default: "",
      },
    },

    phone: {
      type: String,
      default: "",
    },

    images: {
      profile: {
        type: String,
        default: "",
      },

      cover: {
        type: String,
        default: "",
      },

      gallery: {
        type: [String],
        default: [],
      },
    },

    timings: {
      openTime: {
        type: String,
        default: "",
      },

      closeTime: {
        type: String,
        default: "",
      },

      days: {
        type: [String],
        default: [],
      },
    },

    approvalStatus: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
      ],
      default: "pending",
      index: true,
    },

    rejectionReason: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

branchSchema.index({
  storeId: 1,
  isActive: 1,
});

module.exports =
  mongoose.models.Branch ||
  mongoose.model("Branch", branchSchema, "branches");