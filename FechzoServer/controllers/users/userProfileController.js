const User = require('../../models/User/User');
const cloudinary = require('../../config/cloudinary');
const fs = require('fs');

/**
 * Get user profile by email
 * @route GET /api/users/email/:email
 */
const getUserByEmail = async (req, res) => {
    try {
        const { email } = req.params;
        
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        return res.status(200).json(user);
    } catch (error) {
        console.error("Error fetching user by email:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Update user profile
 * @route PUT /api/users/profile
 */
const updateUserProfile = async (req, res) => {
    try {
        
        const { email, fullName, phone } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }
        
        // Find user by email
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Update basic profile information
        if (fullName) user.name = fullName;
        if (phone) user.phone = phone;
        
        // Handle profile picture upload if provided
        if (req.file) {
            try {
                console.log("Processing file upload");
                
                // Convert buffer to base64 string for Cloudinary
                const b64 = Buffer.from(req.file.buffer).toString('base64');
                const dataURI = `data:${req.file.mimetype};base64,${b64}`;
                
                // Upload to cloudinary
                const result = await cloudinary.uploader.upload(dataURI, {
                    folder: 'user_profiles',
                    width: 300,
                    crop: 'scale'
                });
                
                console.log("Cloudinary upload result:", result);
                
                // Update user profile picture URL
                user.profilePicture = result.secure_url;
                
            } catch (uploadError) {
                console.error("Error uploading profile picture:", uploadError);
                return res.status(500).json({ error: "Failed to upload profile picture", details: uploadError.message });
            }
        }
        
        // Save updated user
        await user.save();
        
        return res.status(200).json({
            message: "Profile updated successfully",
            user: {
                name: user.name,
                email: user.email,
                phone: user.phone,
                profilePicture: user.profilePicture,
                addresses: user.addresses
            }
        });
    } catch (error) {
        console.error("Error updating user profile:", error);
        return res.status(500).json({ error: "Internal Server Error", details: error.message });
    }
};

/**
 * Add a new address to user profile
 * @route POST /api/users/address
 */
const addAddress = async (req, res) => {
    try {
        const { email, address } = req.body;
        
        if (!email || !address) {
            return res.status(400).json({ error: "Email and address details are required" });
        }
        
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // If this is the first address or marked as default, ensure it's the only default
        if (address.isDefault || user.addresses.length === 0) {
            // Set all existing addresses to non-default
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
            
            // Ensure this address is marked as default
            address.isDefault = true;
        }
        
        // Add the new address
        user.addresses.push(address);
        
        await user.save();
        
        return res.status(201).json({
            message: "Address added successfully",
            address: user.addresses[user.addresses.length - 1]
        });
    } catch (error) {
        console.error("Error adding address:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Update an existing address
 * @route PUT /api/users/address/:addressId
 */
const updateAddress = async (req, res) => {
    try {
        const { email, address } = req.body;
        const { addressId } = req.params;
        
        if (!email || !address || !addressId) {
            return res.status(400).json({ error: "Email, address details, and address ID are required" });
        }
        
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Find the address to update
        const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
        
        if (addressIndex === -1) {
            return res.status(404).json({ error: "Address not found" });
        }
        
        // If this address is being set as default, update all others
        if (address.isDefault) {
            user.addresses.forEach(addr => {
                addr.isDefault = false;
            });
        }
        
        // Update the address fields
        Object.keys(address).forEach(key => {
            user.addresses[addressIndex][key] = address[key];
        });
        
        await user.save();
        
        return res.status(200).json({
            message: "Address updated successfully",
            address: user.addresses[addressIndex]
        });
    } catch (error) {
        console.error("Error updating address:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

/**
 * Delete an address
 * @route DELETE /api/users/address/:addressId
 */
const deleteAddress = async (req, res) => {
    try {
        const { email } = req.body;
        const { addressId } = req.params;
        
        if (!email || !addressId) {
            return res.status(400).json({ error: "Email and address ID are required" });
        }
        
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        
        // Find the address to delete
        const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
        
        if (addressIndex === -1) {
            return res.status(404).json({ error: "Address not found" });
        }
        
        // Check if this was the default address
        const wasDefault = user.addresses[addressIndex].isDefault;
        
        // Remove the address
        user.addresses.splice(addressIndex, 1);
        
        // If the deleted address was the default and there are other addresses,
        // set the first remaining address as default
        if (wasDefault && user.addresses.length > 0) {
            user.addresses[0].isDefault = true;
        }
        
        await user.save();
        
        return res.status(200).json({
            message: "Address deleted successfully",
            addresses: user.addresses
        });
    } catch (error) {
        console.error("Error deleting address:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = {
    getUserByEmail,
    updateUserProfile,
    addAddress,
    updateAddress,
    deleteAddress
};