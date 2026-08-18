const cloudinary = require("../config/cloudinary"); // your existing config
const streamifier = require("streamifier"); // npm install streamifier

const uploadToCloudinary = (buffer, folder = "stores") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto", // supports image + pdf
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
};

module.exports = uploadToCloudinary;