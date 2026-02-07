const Restaurant = require('../../models/restaurants/shops/RestaurantDetails');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const login = async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("Login request received with username:", username);

    // Find restaurant by manager's username or email
    const restaurant = await Restaurant.findOne({
      $or: [
        { "managerDetails.username": username },
        { "managerDetails.managerEmail": username },
      ],
    });

    if (!restaurant) {
      console.log("Restaurant not found for username/email:", username);
      return res.status(401).json({ message: "Invalid username or password" });
    }

    console.log("Restaurant found:", restaurant.restaurantName);

    // Compare passwords (assuming plain text; use bcrypt in production)
    if (password !== restaurant.managerDetails.password) {
      console.log("Password mismatch for user:", username);
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Check approval status
    if (restaurant.approvalStatus === "Pending") {
      console.log("Account pending approval for user:", username);
      return res.status(401).json({
        message: "Your account is pending. Please contact support for more details.",
      });
    }

    if (restaurant.approvalStatus === "Rejected") {
      console.log("Account rejected for user:", username);
      return res.status(401).json({
        message: `Your account has been rejected.\nReason: ${restaurant.rejectionReason || "No reason provided"}`,
      });
    }

    // Initialize response data
    let branchIds = [];
    const isBranch = restaurant.isBranch;
    console.log("Is branch:", isBranch);

    // If parent restaurant, fetch branch restaurant _ids
    if (!isBranch) {
      const branches = await Restaurant.find({
        parentRestaurant: restaurant._id,
        isBranch: true,
      }).select('_id restaurantName');

      console.log(`Found ${branches.length} branches for parent restaurant`);

      branchIds = branches.map(branch => ({
        id: branch._id.toString(),
        name: branch.restaurantName,
      }));
    }

    // Create payload for JWT
    const payload = {
      restaurantId: restaurant._id.toString(),
      username: restaurant.managerDetails.username,
      managerName: restaurant.managerDetails.managerName,
      isBranch,
      branchIds: branchIds.map(b => b.id), // Include branch _ids in token
    };

    console.log("JWT payload:", payload);

    // Generate token
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
    console.log("JWT token generated");

    // Send response
    console.log("Login successful for user:", username);
    res.status(200).json({
      message: "Login successful",
      token,
      managerName: restaurant.managerDetails.managerName,
      profileImage: restaurant.images.profile,
      restaurantobject_id: restaurant._id.toString(),
      isBranch,
      branchIds, // Include branch _ids and names for parent restaurants
    });
  } catch (error) {
    console.error("Error during login:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

module.exports = { login };
