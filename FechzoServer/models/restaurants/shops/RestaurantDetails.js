const mongoose = require("mongoose");

// Pending Invite Schema
const pendingInviteSchema = new mongoose.Schema({
  role: { type: String, required: true, enum: ["manager", "staff"] },
  name: { type: String, required: true },
  phone: {
    type: String,
    required: true,
    match: [/^\d{10}$/, "Invalid phone number"],
  },
  email: {
    type: String,
    required: true,
    match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
  },
  token: { type: String, required: true, unique: true },
  status: {
    type: String,
    required: true,
    enum: ["pending", "accepted"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

// Main Restaurant Schema
const restaurantSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, unique: true },
    restaurantName: { type: String, required: true },
isBranch: { type: Boolean, default: false },
  parentRestaurant: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Restaurant', 
    default: null 
  },
    ownerDetails: {
      fullName: { type: String, required: true },
      phone: {
        type: String,
        required: true,
        match: [/^\d{10}$/, "Invalid phone number"],
      },
      email: {
        type: String,
        required: true,
        match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
      },
      address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        postalCode: {
          type: String,
          required: true,
          match: [/^\d{6}$/, "Invalid postal code"],
        },
      },
    },
    restaurantAddress: {
      shopNumber: { type: String, required: true },
      postalCode: {
        type: String,
        required: true,
        match: [/^\d{6}$/, "Invalid postal code"],
      },
      area: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      landmark: { type: String },
      latitude: { type: String, required: false },
      longitude: { type: String, required: false },
      mapLink: { type: String },
    },
    images: {
      profile: { type: String },
      food: { type: [String], default: [] },
      menu: { type: [String], default: [] },
      restaurant: { type: [String], default: [] },
    },
    cuisines: {
      type: [String],
      required: true,
      validate: [(v) => v.length > 0, "At least one cuisine is required"],
      default: [],
    },
    services: {
      type: [String],
      enum: ["delivery", "dineIn", "takeaway"],
      default: [],
      validate: [
        {
          validator: function (arr) {
            return arr.length > 0; // At least one service must be selected
          },
          message: "At least one service type must be selected",
        },
        {
          // NEW VALIDATOR: If delivery is selected, takeaway must be included
          validator: function (arr) {
            return !arr.includes("delivery") || arr.includes("takeaway");
          },
          message:
            "Takeaway service is required when delivery service is enabled",
        },
      ],
    },
    timings: {
      delivery: {
        schedule: {
          Monday: [{ openTime: String, closeTime: String }],
          Tuesday: [{ openTime: String, closeTime: String }],
          Wednesday: [{ openTime: String, closeTime: String }],
          Thursday: [{ openTime: String, closeTime: String }],
          Friday: [{ openTime: String, closeTime: String }],
          Saturday: [{ openTime: String, closeTime: String }],
          Sunday: [{ openTime: String, closeTime: String }],
        },
        isActive: { type: Boolean, default: false },
      },
      dineIn: {
        schedule: {
          Monday: [{ openTime: String, closeTime: String }],
          Tuesday: [{ openTime: String, closeTime: String }],
          Wednesday: [{ openTime: String, closeTime: String }],
          Thursday: [{ openTime: String, closeTime: String }],
          Friday: [{ openTime: String, closeTime: String }],
          Saturday: [{ openTime: String, closeTime: String }],
          Sunday: [{ openTime: String, closeTime: String }],
        },
        isActive: { type: Boolean, default: false },
      },
      takeaway: {
        schedule: {
          Monday: [{ openTime: String, closeTime: String }],
          Tuesday: [{ openTime: String, closeTime: String }],
          Wednesday: [{ openTime: String, closeTime: String }],
          Thursday: [{ openTime: String, closeTime: String }],
          Friday: [{ openTime: String, closeTime: String }],
          Saturday: [{ openTime: String, closeTime: String }],
          Sunday: [{ openTime: String, closeTime: String }],
        },
        isActive: { type: Boolean, default: false },
      },
    },
    globalStatus: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    previousServiceStatus: {
      delivery: { type: Boolean, default: false },
      dineIn: { type: Boolean, default: false },
      takeaway: { type: Boolean, default: false },
    },
    legalDetails: {
      panCardNumber: {
        type: String,
        required: true,
        match: [/^[A-Z]{5}\d{4}[A-Z]$/, "Invalid PAN number"],
      },
      panFullName: { type: String, required: true },
      uploadPanCard: { type: String, required: true },
      panApprovalStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "approved",
      },
      panRejectionReason: String,
      pendingPanDetails: {
        number: String,
        name: String,
        imageUrl: String,
        updatedAt: Date,
        rejectionReason: String,
      },
      gstNumber: {
        type: String,
        required: function () {
          return this.legalDetails.isGstRegistered;
        },
        match: [
          /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{1}\d{1}$/,
          "Invalid GST number",
        ],
      },
      isGstRegistered: { type: Boolean, required: true },
      fssaiNumber: {
        type: String,
        required: true,
        match: [/^\d{14}$/, "Invalid FSSAI number"],
      },
      fssaiExpiryDate: { type: String, required: true },
      uploadFssaiLicense: { type: String, required: true },
      fssaiApprovalStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "approved",
      },
      fssaiRejectionReason: String,
      pendingFssaiDetails: {
        number: String,
        expiryDate: Date,
        imageUrl: String,
        updatedAt: Date,
        rejectionReason: String,
      },
    },
    bankDetails: {
      accountHolderName: {
        type: String,
        required: true,
        trim: true,
      },
      bankName: {
        type: String,
        required: true,
        trim: true,
      },
      branchName: {
        type: String,
        required: true,
        trim: true,
      },
      accountNumber: {
        type: String,
        required: true,
        match: [/^\d{9,18}$/, "Invalid account number"],
      },
      confirmAccountNumber: {
        type: String,
        required: true,
        validate: {
          validator: function (value) {
            return value === this.bankDetails.accountNumber;
          },
          message: "Account numbers do not match",
        },
      },
      ifscCode: {
        type: String,
        required: true,
        match: [/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code"],
      },
      accountType: {
        type: String,
        required: true,
        enum: ["Savings", "Current"],
      },
      approvalStatus: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "approved",
      },
      rejectionReason: String,
      pendingDetails: {
        accountHolderName: String,
        bankName: String,
        branchName: String,
        accountNumber: String,
        ifscCode: String,
        accountType: String,
        isApprovalPending: {
          type: Boolean,
          default: false,
        },
        updatedAt: {
          type: Date,
        },
        rejectionReason: String,
      },
      lastUpdated: {
        type: Date,
        default: Date.now,
      },
    },
    managerDetails: {
      managerName: { type: String },
      managerEmail: {
        type: String,
        required: true,
        match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
      },
      managerPhone: {
        type: String,
        match: [/^\d{10}$/, "Invalid phone number"],
      },
      managerAltPhone: {
        type: String,
        match: [/^\d{10}$/, "Invalid phone number"],
      },
      username: { type: String, required: true, unique: true },
      password: { type: String, required: true },
    },
    otp: { type: String }, // Field for OTP
    otpExpiry: { type: Date }, // Field for OTP expiration

    staff: [{ name: String, phone: String, email: String }],
    socialMedia: [{ platform: String, link: String }],
    pendingInvites: { type: [pendingInviteSchema], default: [] },
    // branches: { type: [branchSchema], default: [] },
    approvalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    rejectionReason: {
      type: String,
      required: function () {
        return this.approvalStatus === "Rejected";
      },
    },
    commissionPercentage: { type: Number },
    aboutUs: { type: String },
    ourStory: {
      title: { type: String },
      description: { type: String },
    },
    specialties: { type: [String], default: [] },
    mapLink: { type: String },
    activeSince: { type: String },
    requestedTitle: { type: String },
    outletNameApprovalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
    },
    profileImageApprovalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
    },
    titleChangeRequests: [
      {
        requestType: {
          type: String,
          enum: ["title", "profileImage"],
          required: true,
          default: "title",
        },
        newTitle: { type: String }, // Required for title requests
        imageUrl: { type: String }, // Required for profileImage requests
        reason: { type: String },
        status: {
          type: String,
          enum: ["Pending", "Approved", "Rejected"],
          default: "Pending",
        },
        rejectionReason: { type: String }, // Store rejection reason
        createdAt: { type: Date, default: Date.now },
      },
    ],
    accountManager: {
      name: { type: String },
      designation: { type: String },
      email: { type: String },
      phone: { type: String },
    },
    numbers: {
      contactNumbers: [
        {
          label: { type: String, required: true },
          number: { type: String, required: true },
        },
      ],
      reminderNumbers: [
        {
          label: { type: String, required: true },
          number: { type: String, required: true },
        },
      ],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "Restaurant",
  restaurantSchema,
  "restaurantregister"
);
