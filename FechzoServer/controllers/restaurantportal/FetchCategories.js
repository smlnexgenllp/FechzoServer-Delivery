const Category = require("../../models/restaurants/FoodCategory");
const FoodItem = require("../../models/restaurants/FoodItemDetails");
const mongoose = require("mongoose");

exports.getCategoriesByRestaurant = async (req, res) => {
  try {
    const { restaurant_id } = req.params;

    if (!restaurant_id) {
      return res.status(400).json({ message: "Restaurant ID is required" });
    }

    // Get all categories
    const categories = await Category.find({
      restaurant_id: new mongoose.Types.ObjectId(restaurant_id),
    });

    // Count food items per category
    const foodCounts = await FoodItem.aggregate([
      {
        $match: {
          restaurant_id: new mongoose.Types.ObjectId(restaurant_id), // convert string to ObjectId
        },
      },
      {
        $group: {
          _id: "$category_id",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = {};
    foodCounts.forEach((item) => {
      countMap[item._id.toString()] = item.count;
    });

    const categoriesWithCounts = categories.map((cat) => ({
      ...cat.toObject(),
      foodItemCount: countMap[cat._id.toString()] || 0,
    }));

    res.status(200).json(categoriesWithCounts);
  } catch (err) {
    console.error("[ERROR] Failed to fetch categories:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
