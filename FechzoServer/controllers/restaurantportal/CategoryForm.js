const Category = require("../../models/restaurants/FoodCategory");

exports.createCategory = async (req, res) => {
  try {
    console.log("[DEBUG] Incoming request:", req.body);

    const { name, restaurant_id } = req.body;

    if (!name || !restaurant_id) {
      console.warn("[WARNING] Missing required fields");
      return res.status(400).json({ message: "Name and Restaurant ID are required" });
    }

    const newCategory = new Category({ name, restaurant_id });

    console.log("[DEBUG] Attempting to save:", newCategory);

    await newCategory.save();

    console.log("[SUCCESS] Category created:", newCategory);
    res.status(201).json(newCategory);
  } catch (err) {
    if (err.code === 11000) {
      console.error("[ERROR] Duplicate category:", err.keyValue);
      return res.status(400).json({ message: "Category name already exists for this restaurant" });
    }
    console.error("[ERROR] Failed to create category:", err.message);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { oldName, newName, restaurant_id } = req.body;

    if (!oldName || !newName || !restaurant_id) {
      return res.status(400).json({ message: "Old name, new name, and restaurant ID are required" });
    }

    const updatedCategory = await Category.findOneAndUpdate(
      { name: oldName, restaurant_id },
      { name: newName },
      { new: true }
    );

    if (!updatedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({ success: true, data: updatedCategory });
  } catch (err) {
    console.error("Error updating category:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// In your category controller file
exports.deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // First delete all subcategories and food items in this category
    await Subcategory.deleteMany({ category_id: id });
    await FoodItem.deleteMany({ category_id: id });

    // Then delete the category itself
    const deletedCategory = await Category.findByIdAndDelete(id);

    if (!deletedCategory) {
      return res.status(404).json({ message: "Category not found" });
    }

    res.status(200).json({ 
      success: true, 
      message: "Category and all its contents deleted successfully" 
    });
  } catch (err) {
    console.error("[ERROR] Failed to delete category:", err);
    res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
};