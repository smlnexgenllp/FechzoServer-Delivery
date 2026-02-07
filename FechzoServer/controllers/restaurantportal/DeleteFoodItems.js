const mongoose = require("mongoose");
const Food = require("../../models/restaurants/FoodItemDetails"); // Corrected path to Food model

// Delete a food item
exports.deleteFoodItem = async (req, res) => {
  try {
    const { foodId } = req.params;

    // Validate foodId
    if (!mongoose.Types.ObjectId.isValid(foodId)) {
      return res.status(400).json({ error: "Invalid food item ID" });
    }

    // Find the food item
    const foodItem = await Food.findById(foodId);
    if (!foodItem) {
      return res.status(404).json({ error: "Food item not found" });
    }

    // Delete the food item
    await Food.findByIdAndDelete(foodId);

    return res.status(200).json({ message: "Food item deleted successfully" });
  } catch (error) {
    console.error("Error deleting food item:", error);
    return res.status(500).json({ error: "Failed to delete food item" });
  }
};