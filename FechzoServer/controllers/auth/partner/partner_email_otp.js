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

  if (!["login", "signup"].includes(purpose)) {
    return res.status(400).json({ message: "Invalid purpose" });
  }

  try {
    const existingPartner = await DeliveryPartner.findOne({ email });

    if (purpose === "login" && !existingPartner) {
      return res.status(400).json({ 
        message: "Email not registered. Please signup first.",
        alreadyRegistered: false 
      });
    }

    if (purpose === "signup" && existingPartner) {
      return res.status(400).json({ 
        message: "Email already registered. Please login instead.",
        alreadyRegistered: true 
      });
    }

    // Optional: extra checks for login
    if (purpose === "login" && existingPartner) {
      if (!existingPartner.isActive) {
        return res.status(403).json({ message: "Account is inactive" });
      }
      if (existingPartner.approvalStatus !== "APPROVED") {
        return res.status(403).json({ message: "Account not yet approved" });
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore[email] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min
      purpose, // store purpose to enforce consistency
    };

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Fechzo Delivery Partner - ${purpose === "signup" ? "Signup" : "Login"} OTP`,
      text: `Your OTP is ${otp}. Valid for 5 minutes.`,
    });

    res.status(200).json({ 
      message: "OTP sent successfully",
      alreadyRegistered: !!existingPartner 
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
  const { email, otp, purpose } = req.body; // purpose should match send

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

    if (purpose === "signup") {
      // Create new partner
      partner = await DeliveryPartner.create({
        email,
        isVerified: true,
        isActive: true,           // or false — depending on your flow
        approvalStatus: "PENDING", // or "APPROVED" if instant
        lastLogin: new Date(),
        // other defaults...
      });
    } else {
      // Login – must already exist
      partner = await DeliveryPartner.findOne({ email });
      if (!partner) {
        delete otpStore[email];
        return res.status(400).json({ message: "Partner not found" });
      }
      partner.lastLogin = new Date();
      await partner.save();
    }

    const token = jwt.sign(
      { id: partner._id, email: partner.email, role: "partner" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    delete otpStore[email];

    res.status(200).json({
      success: true,
      message: purpose === "signup" ? "Account created successfully" : "Logged in successfully",
      token,
      partner: {
        id: partner._id,
        email: partner.email,
        fullName: partner.fullName || null,
        isVerified: partner.isVerified,
        approvalStatus: partner.approvalStatus,
        // add more fields as needed
      },
    });

  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ message: "Server error" });
  }
};