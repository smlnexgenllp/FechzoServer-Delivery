// controllers/partnerAuthController.js

const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const DeliveryPartner = require("../../../models/deliverypartner/DeliveryPartner");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const otpStore = {}; // ← Use Redis in production!

// ────────────────────────────────────────────────
//              SEND OTP – for both login & signup
// ────────────────────────────────────────────────
exports.sendPartnerEmailOtp = async (req, res) => {
  const { email, purpose } = req.body; // purpose: "login" or "signup"
  
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[email] = {
  otp,
  purpose,   // ⭐ VERY IMPORTANT
  expiresAt: Date.now() + 5 * 60 * 1000,
};


  try {
    // Check if partner already exists
    const existingPartner = await DeliveryPartner.findOne({ email });

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Fechzo Delivery Partner - ${purpose === "signup" ? "Signup" : "Login"} OTP`,
      text: `Your OTP is ${otp}. Valid for 5 minutes.`,
    });

    res.status(200).json({
      message: "OTP sent successfully",
      alreadyRegistered: !!existingPartner,   // true if exists, false if new
    });
  } catch (err) {
    console.error("OTP send error:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

// ────────────────────────────────────────────────
//                   VERIFY OTP
// ────────────────────────────────────────────────
exports.verifyPartnerEmailOtp = async (req, res) => {
  console.log("VERIFY OTP BODY:", req.body);   // ← keep this

  const { email, otp, purpose } = req.body;

  if (!email || !otp || !purpose) {
    return res.status(400).json({ message: "Email, OTP and purpose required" });
  }

  const stored = otpStore[email];
  if (!stored || stored.purpose !== purpose) {
    return res.status(400).json({ message: "Invalid or expired OTP session" });
  }

  if (Date.now() > stored.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ message: "OTP expired" });
  }

  if (stored.otp !== otp) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  try {
    let partner;
    let isNew = false;

    if (purpose === "signup") {
      // Check again just before create (race condition protection)
      const exists = await DeliveryPartner.findOne({ email });
      if (exists) {
        delete otpStore[email];
        return res.status(409).json({ message: "Email already registered" });
      }

      partner = await DeliveryPartner.create({
        email: email.trim().toLowerCase(),
        isVerified: true,
        isActive: false,           // ← usually false until onboarding + approval
        approvalStatus: "PENDING",
        lastLogin: new Date(),
        createdByOtp: true,
        // Do NOT set fullName, phone, etc. here — let onboarding do it
      });

      isNew = true;
    } else {
      // Login
      partner = await DeliveryPartner.findOne({ email: email.trim().toLowerCase() });
      if (!partner) {
        delete otpStore[email];
        return res.status(404).json({ message: "No account found with this email" });
      }

      partner.lastLogin = new Date();
      await partner.save();
    }

    // Generate token
    const token = jwt.sign(
      {
        _id: partner._id,
        email: partner.email,
        role: "partner",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    delete otpStore[email];

    return res.status(200).json({
      success: true,
      message: isNew ? "Account created successfully" : "Logged in successfully",
      token,
      partner: {
        id: partner._id.toString(),
        email: partner.email,
        fullName: partner.fullName || null,
        isVerified: partner.isVerified,
        approvalStatus: partner.approvalStatus,
        isActive: partner.isActive,
      },
    });
  } catch (err) {
    console.error("VERIFY OTP CRASH ───────────────────────────────");
    console.error("Error name:   ", err.name);
    console.error("Error message:", err.message);
    console.error("Full stack:   ", err.stack);

    // Mongoose validation / duplicate key / etc.
    if (err.name === "ValidationError") {
      return res.status(400).json({
        message: "Validation failed",
        details: Object.values(err.errors).map(e => e.message),
      });
    }

    if (err.code === 11000) { // Mongo duplicate key
      return res.status(409).json({ message: "Email already in use" });
    }

    return res.status(500).json({
      message: "Server error during verification",
      // only show in dev
      ...(process.env.NODE_ENV === "development" && { debug: err.message }),
    });
  }
};