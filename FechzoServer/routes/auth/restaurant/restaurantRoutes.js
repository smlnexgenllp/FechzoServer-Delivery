// routes/restaurantRoutes.js
const express = require("express");
const router = express.Router();
const upload = require("../../../middleware/multer");
const { createRestaurant } = require('../../../controllers/shops/RestaurantDetails');
const { login } = require('../../../controllers/auth/restaurantlogin');
const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');
const {forgotpassword, sendOtp, verifyOtp, resetPassword} = require('../../../controllers/auth/forgotpassword');

// Define fields accepted from form
const cpUpload = upload.fields([
  { name: "restaurantImage", maxCount: 1 },
  { name: "profileImage", maxCount: 1 },
  { name: "foodImages", maxCount: 10 },
  { name: "menuImages", maxCount: 10 },
  { name: "uploadPanCard", maxCount: 1 },
  { name: "uploadFssaiLicense", maxCount: 1 },
]);

router.post("/register", cpUpload, createRestaurant);

router.post('/login', login);
// router.get('/:id/contacts', authenticateToken, getRestaurantContacts);

router.get('/check-username', async (req, res) => {
  try {
    const { username } = req.query;
    const existingUser = await Restaurant.findOne({'managerDetails.username': username});
    
    res.json({
      available: !existingUser,
      message: existingUser ? 'Username is already taken' : 'Username is available'
    });
  } catch (error) {
    res.status(500).json({ 
      available: false,
      message: 'Error checking username'
    });
  }
});

router.get('/forgotpassword', forgotpassword);
router.post('/forgotpassword/send-otp', sendOtp);
router.post('/forgotpassword/verify-otp', verifyOtp);
router.post('/forgotpassword/reset-password', resetPassword);

module.exports = router;
