const express = require("express");
const router = express.Router();
const { updateAddress, editAddress, deleteAddress, fetchUserDetails } = require("../../controllers/users/userAddress");
const { getUserByEmail, updateUserProfile, addAddress, updateAddress: updateProfileAddress, deleteAddress: deleteProfileAddress } = require("../../controllers/users/userProfileController");
const upload = require("../../middleware/multer");

// User address routes from userAddress.js
// Update user address
router.post("/address", updateAddress);

// Route to edit an existing address
router.put("/address/:userId/:addressId", editAddress);

// Route to delete an address
router.delete("/address/:userId/:addressId", deleteAddress);

// Fetch user details
router.get("/:id", fetchUserDetails);

// New routes for editprofile.jsx using userProfileController.js
// Get user profile by email
router.get("/email/:email", getUserByEmail);

// Update user profile with profile picture upload
router.put("/profile", upload.single("profilePicture"), updateUserProfile);

// Add a new address to user profile
router.post("/profile/address", addAddress);

// Update an existing address in user profile
router.put("/profile/address/:addressId", updateProfileAddress);

// Delete an address from user profile
router.delete("/profile/address/:addressId", deleteProfileAddress);

module.exports = router;

