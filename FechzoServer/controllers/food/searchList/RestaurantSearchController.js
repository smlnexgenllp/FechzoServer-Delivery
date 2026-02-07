const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails'); // adjust path if needed
const Food = require('../../../models/restaurants/FoodItemDetails');
// Controller to search restaurants
const searchRestaurants = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ message: "Name query is required" });
    }

    const restaurants = await Restaurant.find({
      restaurantName: { $regex: name, $options: "i" }
    }).select('restaurantName restaurantId images.profile');

    res.status(200).json({ restaurants });
  } catch (error) {
    console.error("Error searching restaurants:", error);
    res.status(500).json({ message: "Server error" });
  }
};
const searchFoods = async (req, res) => {
  try {
    const { name } = req.query;

    if (!name) {
      return res.status(400).json({ message: "Name query is required" });
    }

    const foods = await Food.find({
      name: { $regex: name, $options: "i" }, // Case-insensitive search
    }).select('name image price restaurant_id');

    res.status(200).json({ foods });
  } catch (error) {
    console.error("Error searching foods:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = {
  searchFoods,
  searchRestaurants, // Keep existing restaurant search
};