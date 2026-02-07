const Addon = require("../../models/restaurants/AddOns");

exports.getAddonsByRestaurant = async (req, res) => {
  try {
    const restaurant_id = req.params.restaurantId; // Get restaurantId from URL params

    if (!restaurant_id) {
      return res.status(400).json({ message: "Restaurant ID is required" });
    }

    const addons = await Addon.find({ restaurant_id }); // Fetch addons for the given restaurant
    res.status(200).json(addons);
  } catch (error) {
    console.error("Error fetching addons:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
