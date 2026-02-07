const Food = require("../../models/restaurants/FoodItemDetails"); // adjust path if different

// GET /api/restaurants/fooditems/:restaurantId/:categoryId/:subcategoryId? (subcategory optional)
const getFoodItems = async (req, res) => {
  const { restaurantId, categoryId, subcategoryId } = req.params;

  if (!restaurantId || !categoryId) {
    return res.status(400).json({ error: "restaurantId and categoryId are required." });
  }

  try {
    const query = {
      restaurant_id: restaurantId,
      category_id: categoryId,
    };

    if (subcategoryId && subcategoryId !== "undefined") {
      query.subcategory_id = subcategoryId;
    }

    const foodItems = await Food.find(query);
    return res.status(200).json(foodItems);
  } catch (error) {
    console.error("Error fetching food items:", error);
    return res.status(500).json({ error: "Failed to fetch food items." });
  }
};

module.exports = {
  getFoodItems,
};
