const express = require("express");
const multer = require("multer");
const cloudinary = require("../../config/cloudinary");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

router.post("/", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Image is required",
      });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "fechzo/products",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);

          return res.status(500).json({
            success: false,
            message: "Image upload failed",
          });
        }

        return res.status(200).json({
          success: true,
          imageUrl: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(req.file.buffer);
  } catch (error) {
    console.error("Upload Error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;