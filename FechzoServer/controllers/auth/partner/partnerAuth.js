// controllers/auth/partner/partnerAuth.js
const bcrypt = require('bcryptjs');
const DeliveryPartner = require('../../../models/deliverypartner/DeliveryPartner');

exports.registerPartner = async (req, res) => {
  try {
    const { email, password, fullName, mobile } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existing = await DeliveryPartner.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const partner = await DeliveryPartner.create({
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      fullName: fullName?.trim(),
      mobile: mobile?.trim(),
      isVerified: true, // or false if you want email confirmation
    });

    res.status(201).json({
      success: true,
      message: 'Partner registered successfully',
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

exports.loginPartner = async (req, res) => {
  try {
    const { email, password } = req.body;

    const partner = await DeliveryPartner.findOne({ email: email.trim().toLowerCase() });
    if (!partner) {
      return res.status(400).json({ 
        message: 'This email is not registered. Please sign up first.' 
      });
    }

    const isMatch = await bcrypt.compare(password, partner.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect password' });
    }

    const token = jwt.sign(
      { id: partner._id, email: partner.email, role: 'partner' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      partner: {
        id: partner._id,
        email: partner.email,
        fullName: partner.fullName,
        mobile: partner.mobile,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};