const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    // Owner (optional for public registration)
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
    },

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
    },

    // Contact
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },

    // Owner / POC details
    ownerDetails: {
      name: String,
      phone: String,
      email: String,
      designation: {
        type: String,
        default: "Owner",
      },
    },

    // Address
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String,
      fullAddress: String,
      coordinates: {
        type: {
          type: String,
          enum: ["Point"],
          default: "Point",
        },
        coordinates: {
          type: [Number], // [longitude, latitude]
          default: [0, 0],
        },
      },
    },

    // Documents
    documents: {
      gstNumber: String,
      gstCertificate: String, // Cloudinary URL
      panNumber: String,
      panCard: String, // Cloudinary URL
      aadhaarNumber: String,
      aadhaarCard: String, // Cloudinary URL
      shopLicense: String, // Cloudinary URL
      fssaiNumber: String,
      fssaiCertificate: String, // Cloudinary URL
      cancelledCheque: String, // Cloudinary URL
      addressProof: String, // Cloudinary URL
    },

    // Bank Details
    bankDetails: {
      accountHolderName: String,
      accountNumber: String,
      ifscCode: String,
      bankName: String,
      upiId: String,
    },

    // Media
    logo: String,
    banner: String,
    storefrontImage: String,
    interiorImages: [String],
    kitchenImages: [String],
    packagingImages: [String],
    images: [String],

    // Status & Admin Control
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "suspended", "blocked"],
      default: "pending",
    },
    rejectionReason: String,
    suspensionReason: String,

    // Operating
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
        open: String,
        close: String,
        isClosed: {
          type: Boolean,
          default: false,
        },
      },
    ],

    deliveryRadius: {
      type: Number,
      default: 5, // in km
    },
    minOrderValue: {
      type: Number,
      default: 0,
    },

    commissionPercent: {
      type: Number,
      default: 10,
    },

    allowedCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
storeSchema.index({ "address.coordinates": "2dsphere" });
storeSchema.index({ storeType: 1, status: 1 });
storeSchema.index({ owner: 1 });
storeSchema.index({ status: 1, isDeleted: 1 });
storeSchema.index({ email: 1 });
storeSchema.index({ phone: 1 });

module.exports = mongoose.model("Store", storeSchema);