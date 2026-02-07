const Restaurant = require("../../models/restaurants/shops/RestaurantDetails");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
// Nodemailer setup
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// 1. Forgot Password Page Entry Point
const forgotpassword = (req, res) => {
  res.status(200).json({ message: "Forgot password page logic here" });
};

// 2. Send/Resend OTP
const sendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const restaurant = await Restaurant.findOne({ "managerDetails.managerEmail": email });
    if (!restaurant) return res.status(404).json({ error: "Invalid email ID" });

    const otp = crypto.randomInt(100000, 999999).toString();
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    restaurant.otp = hashedOtp;
    restaurant.otpExpiry = Date.now() + 10 * 60 * 1000; // 10 mins
    await restaurant.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Your OTP for Password Reset`,
      html: `
        <h2>Hello ${restaurant.managerDetails.managerName || "User"},</h2>
        <p>You requested to reset your password for <strong>${restaurant.restaurantName}</strong>.</p>
        <p>Your OTP is: <strong>${otp}</strong></p>
        <p>This OTP is valid for 10 minutes.</p>
        <p>If you did not request this, please ignore this email.</p>
        <p>Regards,<br/>${restaurant.restaurantName} Team</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("❌ Error sending OTP:", error.message);
    res.status(500).json({ error: "Failed to send OTP. Please try again." });
  }
};

// 3. Verify OTP
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: "Email and OTP are required" });

  try {
    const restaurant = await Restaurant.findOne({ "managerDetails.managerEmail": email });
    const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

    if (!restaurant || restaurant.otp !== hashedOtp)
      return res.status(400).json({ error: "Invalid OTP" });

    if (restaurant.otpExpiry < Date.now())
      return res.status(400).json({ error: "OTP has expired" });

    // Clear OTP
    restaurant.otp = null;
    restaurant.otpExpiry = null;
    await restaurant.save();

    res.status(200).json({ message: "OTP verified successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to verify OTP" });
  }
};

// 4. Reset Password
const resetPassword = async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) return res.status(400).json({ error: "Email and new password required" });

  try {
    const restaurant = await Restaurant.findOne({ "managerDetails.managerEmail": email });
    if (!restaurant) return res.status(404).json({ error: "Invalid email ID" });

    restaurant.managerDetails.password = newPassword;
    await restaurant.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to reset password" });
  }
};

module.exports={ forgotpassword, sendOtp, verifyOtp, resetPassword };
