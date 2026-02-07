const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();
const User = require('../../models/User/User');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// In-memory OTP store
const otpStore = {};

const sendEmailOtp = async (req, res) => {
  const email = req.body.email || req.body.value;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  otpStore[email] = {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
  };

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Your OTP Code',
      text: `Your OTP code is ${otp}. It is valid for 5 minutes.`,
    });

    return res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('OTP send error:', error);
    return res.status(500).json({ message: 'Failed to send OTP' });
  }
};

const verifyEmailOtp = async (req, res) => {
  const email = req.body.email || req.body.value;
  const otp = req.body.otp;

  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  if (!otpStore[email]) {
    return res.status(400).json({ message: 'OTP not found or expired' });
  }

  const { otp: storedOtp, expiresAt } = otpStore[email];

  if (Date.now() > expiresAt) {
    delete otpStore[email]; 
    return res.status(400).json({ message: 'OTP expired' });
  }

  if (storedOtp !== String(otp)) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  try {
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({ email });
    }

    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    delete otpStore[email];

    return res.status(200).json({
      message: 'OTP verified successfully',
      token,
      user,
    }); 
  } catch (error) {
    console.error('Verify error:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

module.exports = { sendEmailOtp, verifyEmailOtp };
