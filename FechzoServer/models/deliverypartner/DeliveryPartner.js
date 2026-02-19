const mongoose = require("mongoose");

const DeliveryPartnerSchema = new mongoose.Schema(
  {
    fullName: { type: String, trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, unique: true, trim: true },

    // ── Vehicle & Basic Documents (from signup / early steps) ──
    vehicleType: {
      type: String,
      enum: ["BIKE", "SCOOTER", "CYCLE", "ELECTRIC_BIKE", "OTHER"],
    },
    vehicleNumber: { type: String, uppercase: true, trim: true },

    licenseNumber: { type: String, uppercase: true, trim: true },
    aadharNumber: { type: String, trim: true },

    city: { type: String, trim: true },
    area: { type: String, trim: true },
    latitude: Number,
    longitude: Number,

    bankName: { type: String, trim: true },
    accountNumber: { type: String, trim: true },
    ifsc: { type: String, uppercase: true, trim: true },

    // ── NEW: Document Photos (Cloudinary URLs + public_ids) ──
    profilePhoto: String,
    profilePhotoPublicId: String,

    panCard: String,                    // PAN card photo URL
    panCardPublicId: String,

    aadharFront: String,
    aadharFrontPublicId: String,

    drivingLicenseFront: String,
    drivingLicenseFrontPublicId: String,

    rcBookFront: String,
    rcBookFrontPublicId: String,

    // Status fields
    onboardingCompleted: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },
    isActive: { type: Boolean, default: false },

    // OTP / auth fields (already used in login)
    loginOtp: String,
    otpExpires: Date,

    // Timestamps
  },
  { timestamps: true }
);

// Indexes for faster lookup
DeliveryPartnerSchema.index({ phone: 1 });
DeliveryPartnerSchema.index({ approvalStatus: 1, isActive: 1 });

module.exports =
  mongoose.models.DeliveryPartner ||
  mongoose.model("DeliveryPartner", DeliveryPartnerSchema);