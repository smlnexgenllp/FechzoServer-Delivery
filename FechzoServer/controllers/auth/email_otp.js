const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
dotenv.config();
const User = require("../../models/User/User");

const SibApiV3Sdk = require("sib-api-v3-sdk");

// Brevo client setup
const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY;

const emailApi = new SibApiV3Sdk.TransactionalEmailsApi();

// In-memory OTP store (OK for now)
const otpStore = {};

const sendEmailOtp = async (req, res) => {
  try {
    const { value: email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    otpStore[email] = {
      otp,
      expiresAt: Date.now() + 5 * 60 * 1000
    };

    await emailApi.sendTransacEmail({
      sender: { email: process.env.BREVO_SENDER, name: "Fechzo OTP" },
      to: [{ email }],
      subject: "Your OTP Code for Fechzo",
      htmlContent: `
        <p>Hello,</p>
        <p>Your OTP is <b>${otp}</b></p>
        <p>This OTP is valid for 5 minutes.</p>
      `
    });

    return res.status(200).json({ message: "OTP sent successfully" });

  } catch (error) {
    console.error("Brevo API Error:", error);
    return res.status(500).json({
      message: "Failed to send OTP",
      error: error.message
    });
  }
};

const verifyEmailOtp = async (req, res) => {
  try {
    const { value: email, otp } = req.body;

    if (!otpStore[email]) {
      return res.status(400).json({ message: "OTP not found" });
    }

    const { otp: storedOtp, expiresAt } = otpStore[email];

    if (Date.now() > expiresAt) {
      delete otpStore[email];
      return res.status(400).json({ message: "OTP expired" });
    }

    if (storedOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email });
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    delete otpStore[email];

    return res.status(200).json({
      message: "OTP verified successfully",
      token,
      user
    });

  } catch (error) {
    console.error("OTP Verify Error:", error);
    return res.status(500).json({
      message: "OTP verification failed",
      error: error.message
    });
  }
};

module.exports = { sendEmailOtp, verifyEmailOtp };