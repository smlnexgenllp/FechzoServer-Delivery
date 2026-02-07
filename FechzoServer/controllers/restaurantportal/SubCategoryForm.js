const Subcategory = require("../../models/restaurants/FoodSubCategory");

const addSubcategory = async (req, res) => {
    const { name, category_id, restaurantId } = req.body; // Use correct field names

    if (!name || !category_id || !restaurantId) {
      return res.status(400).json({ error: "All fields are required" });
    }

    try {
      const newSubcategory = new Subcategory({ 
        name, 
        category_id,  // Use correct field name
        restaurantId  // Use correct field name
      });

      await newSubcategory.save();
      res.status(201).json(newSubcategory);
    } catch (error) {
      console.error("[ERROR] Failed to add subcategory:", error);
      res.status(500).json({ error: "Failed to add subcategory" });
    }
};

module.exports = { addSubcategory };


// Update Subcategory
const updateSubcategory = async (req, res) => {
  const { parentCategory, oldName, newName } = req.body;

  if (!parentCategory || !oldName || !newName) {
    return res.status(400).json({ error: "All fields are required" });
  }

  try {
    const subcategory = await Subcategory.findOne({
      name: oldName,
      category_id: parentCategory,
    });

    if (!subcategory) {
      return res.status(404).json({ error: "Subcategory not found" });
    }

    subcategory.name = newName;
    await subcategory.save();

    res.status(200).json({ success: true, message: "Subcategory updated successfully", subcategory });
  } catch (error) {
    console.error("[ERROR] Failed to update subcategory:", error);
    res.status(500).json({ error: "Failed to update subcategory" });
  }
};

const deleteSubcategory = async (req, res) => {
  try {
    const { id } = req.params;

    // First delete all food items in this subcategory
    await FoodItem.deleteMany({ subcategory_id: id });

    // Then delete the subcategory itself
    const deletedSubcategory = await Subcategory.findByIdAndDelete(id);

    if (!deletedSubcategory) {
      return res.status(404).json({ error: "Subcategory not found" });
    }

    res.status(200).json({ 
      success: true, 
      message: "Subcategory and all its food items deleted successfully" 
    });
  } catch (error) {
    console.error("[ERROR] Failed to delete subcategory:", error);
    res.status(500).json({ 
      error: "Failed to delete subcategory" 
    });
  }
};
module.exports = { addSubcategory, updateSubcategory, deleteSubcategory };
