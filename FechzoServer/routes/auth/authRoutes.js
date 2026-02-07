const express = require('express');
const router = express.Router();

const authMiddleware = require('../../middleware/auth/authMiddleware');
const { sendEmailOtp, verifyEmailOtp } = require('../../controllers/auth/email_otp');
const { googleAuth, googleCallback } = require('../../controllers/auth/googleAuth');
const { sendPartnerEmailOtp, verifyPartnerEmailOtp } = require('../../controllers/auth/partner/partner_email_otp');
const {registerAdmin, loginAdmin, getAdminProfile, verifyAdminSecret, updateAdminProfile} = require('../../controllers/auth/Admin/admin_register');
const verifyAdmin = require('../../middleware/auth/verifyAdmin');
const { registerPartner, loginPartner } = require('../../controllers/auth/partner/partnerAuth');

// ✅ Nested restaurant route
const restaurantauth = require('./restaurant/restaurantRoutes');

// Google Auth
router.get('/googleAuth', googleAuth);
router.get('/googleAuth/callback', googleCallback);

// OTP routes
router.post('/email-otp', sendEmailOtp);
router.post('/verify-otp', verifyEmailOtp);
router.post("/partner/email-otp", sendPartnerEmailOtp);
router.post("/partner/verify-otp", verifyPartnerEmailOtp);
// Nested restaurant routes
router.use('/restaurant-auth', restaurantauth);
router.post('/partner/register', registerPartner);
router.post('/partner/login', loginPartner);
// Protected example
router.get('/protected', authMiddleware, (req, res) => {
  res.json({ message: 'This is a protected route', user: req.user });
});

router.post('/admin_register', registerAdmin);
router.post('/admin_login', loginAdmin);
router.get('/verify', verifyAdmin, (req, res) => {
  res.status(200).json({ success: true });
});

router.post('/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.clearCookie('adminToken', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'None' : 'Lax',
    path: '/', // <- this must match the path used when setting the cookie
  });

  res.status(200).json({ success: true, message: 'Logged out successfully' });
});

// Admin profile routes
router.get('/admin/profile', verifyAdmin, getAdminProfile);
router.post('/admin/verify-secret', verifyAdmin, verifyAdminSecret);
router.put('/admin/update-profile', verifyAdmin, updateAdminProfile);

module.exports = router;
