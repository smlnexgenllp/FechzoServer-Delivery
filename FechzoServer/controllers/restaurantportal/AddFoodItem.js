const Food = require("../../models/restaurants/FoodItemDetails");
const cloudinary = require("../../config/cloudinary");
const { v4: uuidv4 } = require("uuid");

exports.addFood = async (req, res) => {
  try {
      console.log(" [INFO] Received request to add food item.");

      const {
          name,
          description,
          food_type,
          category_id,
          subcategory_id,
          cuisine,
          restaurant_id,
          add_on_id, // This should be an array
          price,
          serviceType, 
          packingcharge
      } = req.body;

      console.log(" [DATA] Request body:", req.body);

      // **Parse serviceType**
      let parsedServiceType;
      try {
          parsedServiceType = Array.isArray(serviceType) ? serviceType : JSON.parse(serviceType);
      } catch (error) {
          console.error(" [ERROR] Failed to parse serviceType:", error.message);
          return res.status(400).json({ message: "Invalid serviceType format" });
      }

      console.log(" [INFO] Parsed serviceType:", parsedServiceType);

      // **Parse Add-ons (Ensure it's an array)**
      let parsedAddOns = [];
      try {
          parsedAddOns = add_on_id
              ? Array.isArray(add_on_id) ? add_on_id : JSON.parse(add_on_id)
              : [];
      } catch (error) {
          console.error(" [ERROR] Failed to parse add_on_id:", error.message);
          return res.status(400).json({ message: "Invalid add_on_id format" });
      }
      

      // Initialize image URL
      let imageUrl = "";

      // Upload image to Cloudinary if file exists
      if (req.file) {
          try {
              console.log(" [UPLOAD] Uploading image to Cloudinary...");
              const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
                  folder: "uploads",
              });
              imageUrl = uploadResponse.secure_url;
              console.log("[SUCCESS] Image uploaded:", imageUrl);
          } catch (uploadError) {
              console.error(" [ERROR] Image upload failed:", uploadError.message);
              return res.status(500).json({ 
                  message: "Image upload failed", 
                  error: uploadError.message 
              });
          }
      } else {
          console.log(" [WARNING] No image file provided.");
      }

      // Create new food item
      const newFood = new Food({
          name,
          description,
          food_type,
          category_id,
        //   subcategory_id,
          cuisine,
          restaurant_id,
          add_on_id: parsedAddOns, // ✅ Store parsed add-ons as an array
          price,
          serviceType: parsedServiceType, 
          food_id: uuidv4(),
          image: imageUrl,
          packingcharge
      });
      // Only include subcategory_id if it's a valid ObjectId string
if (subcategory_id && subcategory_id.trim() !== "") {
    newFood.subcategory_id = subcategory_id;
  }
      console.log("[PROCESS] Saving food item to database...");
      await newFood.save();
      console.log(" [SUCCESS] Food item added successfully:", newFood);

      res.status(201).json({ 
          message: "Food item added successfully", 
          data: newFood 
      });
  } catch (error) {
      console.error("[ERROR] Error adding food item:", error.message);
      res.status(500).json({ 
          message: "Error adding food item", 
          error: error.message 
      });
  }
};

exports.deleteFoodItem = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedItem = await FoodItem.findByIdAndDelete(id);

    if (!deletedItem) {
      return res.status(404).json({ message: "Food item not found" });
    }

    res.status(200).json({ 
      success: true, 
      message: "Food item deleted successfully" 
    });
  } catch (err) {
    console.error("[ERROR] Failed to delete food item:", err);
    res.status(500).json({ 
      message: "Server error", 
      error: err.message 
    });
  }
};
