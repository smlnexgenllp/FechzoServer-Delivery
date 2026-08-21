const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    // =========================
    // OWNER
    // =========================
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },

    // =========================
    // STORE BASIC DETAILS
    // =========================
    storeName: {
      type: String,
      required: [true, "Store name is required"],
      trim: true,
    },

    storeType: {
      type: String,
      enum: ["grocery", "fashion", "electronic"],
      required: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // =========================
    // STORE LOGIN
    // =========================
    loginCredentials: {
      username: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true,
      },

      password: {
        type: String,
        required: true,
      },
    },

    // =========================
    // CONTACT
    // =========================
    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // =========================
    // OWNER / POC DETAILS
    // =========================
    ownerDetails: {
      name: {
        type: String,
        trim: true,
      },

      phone: {
        type: String,
        trim: true,
      },

      email: {
        type: String,
        lowercase: true,
        trim: true,
      },

      designation: {
        type: String,
        default: "Owner",
        trim: true,
      },
    },

    // =========================
    // ADDRESS
    // =========================
    address: {
      street: {
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

      pincode: {
        type: String,
        default: "",
      },

      landmark: {
        type: String,
        default: "",
      },

      fullAddress: {
        type: String,
        default: "",
      },

      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },

        coordinates: {
          type: [Number],
          default: [0, 0],
        },
      },
    },

    // =========================
    // DOCUMENTS
    // =========================
    documents: {
      gstNumber: {
        type: String,
        default: "",
      },

      gstCertificate: {
        type: String,
        default: "",
      },

      panNumber: {
        type: String,
        default: "",
      },

      panCard: {
        type: String,
        default: "",
      },

      aadhaarNumber: {
        type: String,
        default: "",
      },

      aadhaarCard: {
        type: String,
        default: "",
      },

      shopLicense: {
        type: String,
        default: "",
      },

      fssaiNumber: {
        type: String,
        default: "",
      },

      fssaiCertificate: {
        type: String,
        default: "",
      },

      cancelledCheque: {
        type: String,
        default: "",
      },

      addressProof: {
        type: String,
        default: "",
      },
    },

    // =========================
    // BANK DETAILS
    // =========================
    bankDetails: {
      accountHolderName: {
        type: String,
        default: "",
      },

      accountNumber: {
        type: String,
        default: "",
      },

      ifscCode: {
        type: String,
        default: "",
      },

      bankName: {
        type: String,
        default: "",
      },

      upiId: {
        type: String,
        default: "",
      },
    },

    // =========================
    // MEDIA
    // =========================
    logo: {
      type: String,
      default: "",
    },

    banner: {
      type: String,
      default: "",
    },

    storefrontImage: {
      type: String,
      default: "",
    },

    interiorImages: {
      type: [String],
      default: [],
    },

    kitchenImages: {
      type: [String],
      default: [],
    },

    packagingImages: {
      type: [String],
      default: [],
    },

    images: {
      type: [String],
      default: [],
    },

    // =========================
    // STATUS / ADMIN CONTROL
    // =========================
    status: {
      type: String,
      enum: [
        "pending",
        "approved",
        "rejected",
        "suspended",
        "blocked",
      ],
      default: "pending",
      index: true,
    },

    rejectionReason: {
      type: String,
      default: "",
    },

    suspensionReason: {
      type: String,
      default: "",
    },

    // =========================
    // OPERATING STATUS
    // =========================
    isOpen: {
      type: Boolean,
      default: false,
    },

    operatingHours: [
      {
        day: {
          type: String,
          enum: [
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
          ],
        },

        open: {
          type: String,
          default: "",
        },

        close: {
          type: String,
          default: "",
        },

        isClosed: {
          type: Boolean,
          default: false,
        },
      },
    ],

    // =========================
    // DELIVERY SETTINGS
    // =========================
    deliveryRadius: {
      type: Number,
      default: 5,
      min: 0,
    },

    minOrderValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =========================
    // COMMISSION
    // =========================
    commissionPercent: {
      type: Number,
      default: 10,
      min: 0,
      max: 100,
    },

    // =========================
    // ALLOWED CATEGORIES
    // =========================
    allowedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    // =========================
    // SOFT DELETE
    // =========================
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// =====================================================
// INDEXES
// =====================================================

// Location search
storeSchema.index({
  "address.coordinates": "2dsphere",
});

// Store type + status
storeSchema.index({
  storeType: 1,
  status: 1,
});

// Owner stores
storeSchema.index({
  owner: 1,
});

// Status + deleted
storeSchema.index({
  status: 1,
  isDeleted: 1,
});

// Contact search
storeSchema.index({
  email: 1,
});

storeSchema.index({
  phone: 1,
});

// Store login username
storeSchema.index({
  "loginCredentials.username": 1,
});

// =====================================================
// MODEL
// =====================================================

// IMPORTANT:
// Prevent OverwriteModelError
module.exports =
  mongoose.models.Store ||
  mongoose.model("Store", storeSchema, "stores");