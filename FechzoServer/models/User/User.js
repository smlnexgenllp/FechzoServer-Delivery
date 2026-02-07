const mongoose = require('mongoose');

/* ================= ADDRESS SCHEMA ================= */
const addressSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Home', 'Work', 'Other'],
      default: 'Home',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    completeAddress: {
      type: String,
      trim: true,
    },
    landmark: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      trim: true,
    },
    state: {
      type: String,
      required: true,
      trim: true,
    },
    pincode: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v) => /^\d{6}$/.test(v),
        message: 'Pincode must be a 6-digit number.',
      },
    },
    country: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v) => /^\d{10}$/.test(v),
        message: 'Phone number must be a 10-digit number.',
      },
    },

    /* ✅ GEOJSON LOCATION */
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: '2dsphere',
      },
    },

    deliveryInstructions: {
      type: String,
      trim: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    isBillingAddress: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

/* ================= USER SCHEMA ================= */
const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
    name: {
      type: String,
      default: null,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
    profilePicture: {
      type: String,
      default: null,
    },
    phone: {
      type: String,
      default: null,
    },
    last_logged_in: {
      type: Date,
      default: null,
    },
    addresses: [addressSchema],
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
