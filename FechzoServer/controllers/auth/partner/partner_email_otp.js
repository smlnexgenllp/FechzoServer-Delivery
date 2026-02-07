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

const otpStore = {}; // use redis in production!

exports.sendPartnerEmailOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[email] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
  };

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Fechzo Delivery Partner - OTP",
      text: `Your OTP is ${otp}. Valid for 5 minutes.`,
    });

    res.status(200).json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error("Email send error:", err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
};

exports.verifyPartnerEmailOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  const stored = otpStore[email];
  if (!stored) {
    return res.status(400).json({ message: "OTP not found or expired" });
  }

  if (Date.now() > stored.expiresAt) {
    delete otpStore[email];
    return res.status(400).json({ message: "OTP expired" });
  }

  if (stored.otp !== otp) {
    return res.status(400).json({ message: "Invalid OTP" });
  }

  try {
    let partner = await DeliveryPartner.findOne({ email });

    if (!partner) {
      partner = await DeliveryPartner.create({
        email,
        isVerified: true,
        lastLogin: new Date(),
      });
    } else {
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
      message: "Verified successfully",
      token,
      partner: {
        id: partner._id,
        email: partner.email,
        isVerified: partner.isVerified,
        // add more fields later if needed
      },
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ message: "Server error" });
  }
};