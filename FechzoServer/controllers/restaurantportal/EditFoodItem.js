const Food = require("../../models/restaurants/FoodItemDetails");
const cloudinary = require("../../config/cloudinary");
const fs = require("fs");

exports.editFood = async (req, res) => {
  try {
    console.log(" [INFO] Received PUT request to edit food item.");
    console.log(" [DATA] Request body:", req.body);
    console.log(" [DATA] Request file (image):", req.file ? req.file.path : "No file uploaded");

    const {
      food_id,
      name,
      description,
      food_type,
      category_id,
      subcategory_id,
      cuisine,
      restaurant_id,
      add_on_id,
      price,
      serviceType,
      packingcharge, // Added packingcharge
    } = req.body;

    if (!food_id) {
      console.error(" [ERROR] Food ID (_id) is required but not provided.");
      return res.status(400).json({ message: "Food ID is required" });
    }

    // Validate packingcharge
    let parsedPackingCharge;
    if (packingcharge !== undefined && packingcharge !== "") {
      parsedPackingCharge = parseFloat(packingcharge);
      if (isNaN(parsedPackingCharge) || parsedPackingCharge < 0 || parsedPackingCharge > 10) {
        console.error(" [ERROR] Invalid packingcharge value:", packingcharge);
        return res.status(400).json({ message: "Packing charge must be a number between 0 and 10" });
      }
    } else {
      parsedPackingCharge = undefined; // Let MongoDB use the existing value or default
    }
    console.log(" [INFO] Parsed packingcharge:", parsedPackingCharge);

    // Parse serviceType
    let parsedServiceType;
    try {
      parsedServiceType = serviceType
        ? Array.isArray(serviceType)
          ? serviceType
          : JSON.parse(serviceType)
        : undefined;
    } catch (error) {
      console.error(" [ERROR] Invalid serviceType format:", error.message);
      return res.status(400).json({ message: "Invalid serviceType format" });
    }

    // Parse add_on_id
    let parsedAddOns;
    try {
      parsedAddOns = add_on_id
        ? Array.isArray(add_on_id)
          ? add_on_id
          : JSON.parse(add_on_id)
        : undefined;
    } catch (error) {
      console.error(" [ERROR] Invalid add_on_id format:", error.message);
      return res.status(400).json({ message: "Invalid add_on_id format" });
    }

    // Fetch existing food item first
    const existingFood = await Food.findById(food_id);
    if (!existingFood) {
      console.error(" [ERROR] Food item not found for ID:", food_id);
      return res.status(404).json({ message: "Food item not found" });
    }

    // Handle image upload + delete old image
    let imageUrl = existingFood.image;
    if (req.file) {
      try {
        console.log(" [UPLOAD] Uploading new image to Cloudinary...");
        const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
          folder: "Uploads",
        });
        imageUrl = uploadResponse.secure_url;
        fs.unlinkSync(req.file.path); // remove temp file

        // Delete old image from Cloudinary
        if (existingFood.image) {
          const oldPublicId = extractCloudinaryPublicId(existingFood.image);
          if (oldPublicId) {
            await cloudinary.uploader.destroy(oldPublicId);
            console.log(" [CLEANUP] Old image deleted from Cloudinary:", oldPublicId);
          }
        }
      } catch (uploadError) {
        console.error(" [ERROR] Image upload failed:", uploadError.message);
        return res.status(500).json({ message: "Image upload failed", error: uploadError.message });
      }
    }

    // Build update object
    const updateFields = {
      ...(name && { name }),
      ...(description && { description }),
      ...(food_type && { food_type }),
      ...(category_id && { category_id }),
      ...(subcategory_id && subcategory_id.trim() !== "" && { subcategory_id }),
      ...(cuisine && { cuisine }),
      ...(restaurant_id && { restaurant_id }),
      ...(parsedAddOns !== undefined && { add_on_id: parsedAddOns }),
      ...(price !== undefined && { price: parseFloat(price) }),
      ...(parsedServiceType !== undefined && { serviceType: parsedServiceType }),
      ...(parsedPackingCharge !== undefined && { packingcharge: parsedPackingCharge }), // Added packingcharge
      ...(imageUrl && { image: imageUrl }),
    };

    console.log(" [INFO] Update fields:", updateFields);

    const updatedFood = await Food.findByIdAndUpdate(
      food_id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedFood) {
      console.error(" [ERROR] Food item not found during update for ID:", food_id);
      return res.status(404).json({ message: "Food item not found" });
    }

    console.log(" [SUCCESS] Food item updated:", updatedFood);

    res.status(200).json({
      message: "Food item updated successfully",
      data: updatedFood,
    });
  } catch (error) {
    console.error(" [ERROR] Error editing food item:", error.message);
    res.status(500).json({ message: "Error editing food item", error: error.message });
  }
};

// Helper to extract public ID from Cloudinary URL
function extractCloudinaryPublicId(url) {
  try {
    const parts = url.split("/");
    const fileName = parts[parts.length - 1];
    const publicId = fileName.split(".")[0];
    return `Uploads/${publicId}`;
  } catch {
    return null;
  }
}