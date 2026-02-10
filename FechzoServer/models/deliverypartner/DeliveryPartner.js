const mongoose = require("mongoose");

const DeliveryPartnerSchema = new mongoose.Schema(
  {
    fullName: String,
    email: { type: String, unique: true },
    phone: String,

    vehicleType: String,
    vehicleNumber: String,
    licenseNumber: String,
    aadharNumber: String,

    city: String,
    area: String,
    latitude: Number,
    longitude: Number,

    bankName: String,
    accountNumber: String,
    ifsc: String,

    onboardingCompleted: { type: Boolean, default: false },

    approvalStatus: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },

    isActive: { type: Boolean, default: false },

    loginOtp: String,
    otpExpires: Date,
  },
  { timestamps: true }
);

// ⭐ KEY LINE — prevents OverwriteModelError
module.exports =
  mongoose.models.DeliveryPartner ||
  mongoose.model("DeliveryPartner", DeliveryPartnerSchema);
