const Addon = require("../../models/restaurants/AddOns");
const cloudinary = require("../../config/cloudinary");
const fs = require("fs");

const updateAddon = async (req, res) => {
  try {
    const parsedBody = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { groupName, addonType } = parsedBody;

    let addonItems = JSON.parse(req.body.addonItems || "[]");
    const files = req.files || [];

    const existingAddon = await Addon.findById(req.params.id);
    if (!existingAddon) {
      return res.status(404).json({ success: false, message: "Addon not found" });
    }

    const existingItems = existingAddon.addonItems || [];

    // Identify removed items by name
    const incomingNames = addonItems.map(item => item.name);
    const removedItems = existingItems.filter(item => !incomingNames.includes(item.name));

    // Delete removed items' images from Cloudinary
    for (const item of removedItems) {
      if (item.image) {
        const publicId = extractCloudinaryPublicId(item.image);
        if (publicId) await cloudinary.uploader.destroy(publicId);
      }
    }

    // Process new/updated items
    const updatedItems = await Promise.all(
      addonItems.map(async (item, index) => {
        let image = item.imageUrl || null;
        const fileKey = `addonItems[${index}][image]`;
        const file = files.find(f => f.fieldname === fileKey);

        const existingItem = existingItems.find(i => i.name === item.name);

        if (file) {
          if (existingItem && existingItem.image) {
            const oldPublicId = extractCloudinaryPublicId(existingItem.image);
            if (oldPublicId) await cloudinary.uploader.destroy(oldPublicId);
          }

          const result = await cloudinary.uploader.upload(file.path, {
            folder: "addon_items",
          });

          image = result.secure_url;
          fs.unlinkSync(file.path);
        }

        return {
          name: item.name,
          price: item.price,
          addonType: item.addonType || addonType || null,
          image: image || (existingItem?.image ?? null),
        };
      })
    );

    const updatedAddon = await Addon.findByIdAndUpdate(
      req.params.id,
      {
        groupName,
        addonType,
        addonItems: updatedItems,
      },
      { new: true }
    );

    res.status(200).json({ success: true, data: updatedAddon });

  } catch (error) {
    console.error("Error updating addon:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Extract Cloudinary public ID from image URL
function extractCloudinaryPublicId(url) {
  try {
    const parts = url.split("/");
    const fileName = parts[parts.length - 1];
    const publicId = fileName.split(".")[0];
    return `addon_items/${publicId}`;
  } catch {
    return null;
  }
}

module.exports = { updateAddon };
