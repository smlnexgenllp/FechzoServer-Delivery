const Restaurant = require('../../models/restaurants/shops/RestaurantDetails');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Debugging: Log the username and password
    // console.log('Received username:', username);
    // console.log('Received password:', password);

    // Find restaurant by manager's username
    const restaurant = await Restaurant.findOne({ "managerDetails.username": username });
    if (!restaurant) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Compare passwords directly (assuming the password is stored in plain text in the database)
    if (password !== restaurant.managerDetails.password) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

     // Check approval status
     if (restaurant.approvalStatus !== "Approved") {
      return res.status(401).json({
        message: `Your account is ${restaurant.approvalStatus}. Please contact support for more details.`
      });
    }

    // Create payload for JWT
    const payload = {
      restaurantId: restaurant._id, // Use _id if restaurantId does not exist
      username: restaurant.managerDetails.username,
      managerName: restaurant.managerDetails.managerName,
    };

    // Generate token
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    res.status(200).json({ message: "Login successful", token, managerName: restaurant.managerDetails.managerName,restaurantobject_id:restaurant._id,}); // Send managerName
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

module.exports = { login };
