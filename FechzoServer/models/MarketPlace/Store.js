const mongoose = require('mongoose');

const storeSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,   // ← changed from true to false
      default: null,
    },
    storeName: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
    },
    storeType: {
      type: String,
      enum: ['grocery', 'fashion', 'electronic'],
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
    // Address
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String,
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
      },
    },
    // Documents for verification
    documents: {
      gstNumber: String,
      gstCertificate: String,
      panNumber: String,
      panCard: String,
      aadhaarNumber: String,
      aadhaarCard: String,
      shopLicense: String,
      cancelledCheque: String,
    },
    // Bank details
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
    images: [String],

    // Status & admin control
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'suspended', 'blocked'],
      default: 'pending',
    },
    rejectionReason: String,
    suspensionReason: String,

    // Operating
    isOpen: { type: Boolean, default: false },
    operatingHours: [
      {
        day: {
          type: String,
          enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        },
        open: String,
        close: String,
        isClosed: { type: Boolean, default: false },
      },
    ],

    commissionPercent: { type: Number, default: 10 },

    allowedCategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    ],

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes
storeSchema.index({ 'address.coordinates': '2dsphere' });
storeSchema.index({ storeType: 1, status: 1 });
storeSchema.index({ owner: 1 });

module.exports = mongoose.model('Store', storeSchema);