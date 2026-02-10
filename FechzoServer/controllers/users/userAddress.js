const User = require('../../models/User/User'); // Adjust path if needed

const updateAddress = async (req, res) => {
    try {
        console.log("Received Data:", req.body); // Debugging
        const { userId, doorNo, street, city, state, landmark, pincode ,latitude,longitude} = req.body;

        if (!userId || !doorNo || !street || !city || !state || !pincode) {
            return res.status(400).json({ error: "All fields are required" });
        }
        if (!latitude || !longitude) {
  return res.status(400).json({ error: "Latitude & Longitude required" });
}
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        if (!user.addresses) {
            user.addresses = []; // Ensure addresses array exists
        }

        user.addresses.push({ doorNo, street, city, state, landmark, pincode, latitude: Number(latitude),
  longitude: Number(longitude) });
        await user.save();

        res.status(200).json({ message: "Address added successfully", addresses: user.addresses });
    } catch (error) {
        console.error("Error adding address:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

// Edit Address
const editAddress = async (req, res) => {
    try {
        const { userId, addressId } = req.params;
        const { doorNo, street, landmark, city, state, pincode, latitude, longitude } = req.body;

        if (!userId || !addressId) return res.status(400).json({ error: "User ID and Address ID are required" });
        if (!doorNo || !street || !city || !state || !pincode) {
            return res.status(400).json({ error: "All address fields are required" });
        }
        if (!latitude || !longitude) {
  return res.status(400).json({ error: "Latitude & Longitude required" });
}

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ error: "User not found" });

        const addressIndex = user.addresses.findIndex(addr => addr._id.toString() === addressId);
        if (addressIndex === -1) return res.status(404).json({ error: "Address not found" });

        user.addresses[addressIndex] = { _id: addressId, doorNo, street, landmark, city, state, pincode, latitude: Number(latitude), longitude: Number(longitude) };
        await user.save();

        return res.status(200).json({ message: "Address updated successfully", addresses: user.addresses });
    } catch (error) {
        console.error("Error editing address:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};
     
// Delete Address
const deleteAddress = async (req, res) => {
    try {
      const { userId, addressId } = req.params;
  
      if (!userId || !addressId) return res.status(400).json({ error: "User ID and Address ID are required" });
  
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
  
      user.addresses = user.addresses.filter(addr => addr._id.toString() !== addressId);
      await user.save();
  
      return res.status(200).json({ message: "Address deleted successfully", addresses: user.addresses });
    } catch (error) {
      console.error("Error deleting address:", error);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };
  
  // Fetch User Details (Including Address)
const fetchUserDetails = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id) return res.status(400).json({ error: "User ID is required" });

        const user = await User.findById(id).select("name email phone addresses");

        if (!user) return res.status(404).json({ error: "User not found" });

        return res.status(200).json(user);
    } catch (error) {
        console.error("Error fetching user details:", error);
        return res.status(500).json({ error: "Internal Server Error" });
    }
};

module.exports = { updateAddress, editAddress, deleteAddress, fetchUserDetails };