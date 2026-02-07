const Subcategory = require("../../models/restaurants/FoodSubCategory");
const FoodItem = require("../../models/restaurants/FoodItemDetails");
const mongoose = require("mongoose");

// Fetch subcategories along with food item counts
exports.getSubcategories = async (req, res) => {
  try {
    const { restaurantId, categoryId } = req.params;

    // Step 1: Fetch subcategories
    const subcategories = await Subcategory.find({
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
      category_id: new mongoose.Types.ObjectId(categoryId),
    });

    // Step 2: Aggregate food item counts by subcategory
    const foodCounts = await FoodItem.aggregate([
      {
        $match: {
          restaurant_id: new mongoose.Types.ObjectId(restaurantId),
          category_id: new mongoose.Types.ObjectId(categoryId),
        },
      },
      {
        $group: {
          _id: "$subcategory_id",
          count: { $sum: 1 },
        },
      },
    ]);

    const countMap = {};
    foodCounts.forEach((item) => {
      if (item._id) {
        countMap[item._id.toString()] = item.count;
      }
    });

    // Step 3: Merge counts into subcategories
    const subcategoriesWithCounts = subcategories.map((sub) => ({
      ...sub.toObject(),
      foodItemCount: countMap[sub._id.toString()] || 0,
    }));

    res.json(subcategoriesWithCounts);
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({ message: "Server error" });
  }
};
