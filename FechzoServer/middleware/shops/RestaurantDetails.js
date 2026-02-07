const path = require("path");
const fs = require("fs");
const fileUpload = require("express-fileupload");

// Middleware to configure file upload settings (without temp files)
const configureFileUpload = fileUpload({
  useTempFiles: false, // No temporary files
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit file size to 5MB
});

// Middleware to handle uploaded files and move them to the `uploads` directory
const handleFileUpload = async (req, res, next) => {
  try {
    if (!req.files) {
      return next(); // No files uploaded, proceed
    }
    

    const filePaths = {};
    const uploadDir = path.join(__dirname, "../../uploads/");

    // ✅ Ensure the uploads directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // ✅ Iterate through uploaded files and save them
    for (const [key, file] of Object.entries(req.files)) {
      // Handle multiple files under the same key
      if (Array.isArray(file)) {
        filePaths[key] = [];

        for (const singleFile of file) {
          const uniqueFileName = `${Date.now()}_${Math.floor(Math.random() * 10000)}_${singleFile.name}`;
          const filePath = path.join(uploadDir, uniqueFileName);
          await singleFile.mv(filePath); // Move file to uploads directory
          filePaths[key].push(`uploads/${uniqueFileName}`);
        }
      } else {
        // Single file upload case
        const uniqueFileName = `${Date.now()}_${Math.floor(Math.random() * 10000)}_${file.name}`;
        const filePath = path.join(uploadDir, uniqueFileName);
        await file.mv(filePath);
        filePaths[key] = `uploads/${uniqueFileName}`;
      }
    }

    // ✅ Attach file paths to request object for later use
    req.filePaths = filePaths;
    next(); // Proceed to the next middleware/controller
  } catch (error) {
    console.error("Error handling file upload:", error);
    res.status(500).json({ message: "Error handling file upload", error: error.message });
  }
};

module.exports = {
  configureFileUpload,
  handleFileUpload,
};
