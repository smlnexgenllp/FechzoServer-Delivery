const Addon = require("../../models/restaurants/AddOns");
const cloudinary = require("../../config/cloudinary");

const createAddon = async (req, res) => {
  try {
    const parsedBody = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { groupName, restaurant_id } = parsedBody;

    let addonItems = JSON.parse(req.body.addonItems || "[]");

    if (!groupName || !restaurant_id || !Array.isArray(addonItems)) {
      return res.status(400).json({ success: false, message: "All fields are required" });
    }

    const files = req.files || [];

    const uploadedItems = await Promise.all(
      addonItems.map(async (item, index) => {
        let image = null;
        const fileKey = `addonItems[${index}][image]`;
        const file = files.find(f => f.fieldname === fileKey);

        if (file) {
          const result = await cloudinary.uploader.upload(file.path, {
            folder: "addon_items",
          });
          image = result.secure_url;
        }

        return {
          name: item.name,
          price: item.price,
          addonType: item.addonType, // ✅ now used from frontend
          image,
        };
      })
    );

    const addon = new Addon({
      groupName,
      restaurant_id,
      addonItems: uploadedItems,
    });

    await addon.save();

    res.status(201).json({ success: true, data: addon });
  } catch (error) {
    console.error("Error creating addon:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

module.exports = { createAddon };
