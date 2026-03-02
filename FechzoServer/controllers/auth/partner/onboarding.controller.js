// controllers/deliverypartner/onboarding.controller.js
const cloudinary = require("../../config/cloudinary");
const DeliveryPartner = require("../../models/deliverypartner/DeliveryPartner");
const { createNotification } = require("../admin/NotificationController");

const uploadToCloudinary = async (buffer, folder, prefix) => {
  if (!buffer || buffer.length === 0) {
    throw new Error("Empty file buffer");
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `delivery-partners/${folder}`,
        public_id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png"],
        transformation: [{ quality: "auto:good" }, { fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return reject(error);
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );
    stream.end(buffer);
  });
};

const submitOnboarding = async (req, res) => {
  try {
    console.log("══════════════════════════════════════════════");
    console.log("ONBOARDING REQUEST RECEIVED");
    console.log("Partner ID:", req.partner?._id || req.partner?.id);
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Body fields:", Object.keys(req.body));
    console.log("Files received:", req.files ? Object.keys(req.files) : "NONE");

    const partnerId = req.partner?._id?.toString() || req.partner?.id;
    if (!partnerId) {
      return res.status(401).json({ success: false, message: "Unauthorized - missing partner id" });
    }

    // ── Text fields ───────────────────────────────────────
    const {
      fullName,
      phone,
      vehicleType,
      vehicleNumber,
      licenseNumber,
      aadharNumber,
      city,
      area,
      latitude,
      longitude,
      bankName,
      accountNumber,
      ifsc,
    } = req.body;

    // Basic required text validation
    const requiredTextFields = {
      fullName,
      vehicleType,
      vehicleNumber: vehicleNumber?.trim()?.toUpperCase(),
      city: city?.trim(),
    };

    const missingText = Object.entries(requiredTextFields)
      .filter(([_, val]) => !val)
      .map(([key]) => key);

    if (missingText.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        missing: missingText,
      });
    }

    const updateData = {
      fullName: fullName.trim(),
      phone: phone?.trim() || undefined,
      vehicleType,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      licenseNumber: licenseNumber?.trim()?.toUpperCase() || undefined,
      aadharNumber: aadharNumber?.trim() || undefined,
      city: city.trim(),
      area: area?.trim() || undefined,
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      bankName: bankName?.trim() || undefined,
      accountNumber: accountNumber?.trim() || undefined,
      ifsc: ifsc?.trim()?.toUpperCase() || undefined,
      onboardingCompleted: true,
      approvalStatus: "PENDING",
      isActive: false,
    };

    // ── Handle file uploads ───────────────────────────────────────
    const uploadedFiles = {};
    const uploadErrors = [];

    if (req.files && Object.keys(req.files).length > 0) {
      const fieldsToUpload = [
        { key: "profilePhoto",     folder: "profiles",  prefix: "profile", required: true  },
        { key: "panCard",          folder: "kyc",       prefix: "pan",     required: true  },
        { key: "aadharFront",      folder: "kyc",       prefix: "aadhar",  required: true  },
        { key: "drivingLicenseFront", folder: "kyc", prefix: "license",   required: true  },
        { key: "rcBookFront",      folder: "kyc",       prefix: "rc",      required: true  },
      ];

      for (const { key, folder, prefix, required } of fieldsToUpload) {
        const file = req.files[key]?.[0];
        if (file?.buffer) {
          try {
            const result = await uploadToCloudinary(file.buffer, folder, prefix);
            updateData[key] = result.url;
            updateData[`${key}PublicId`] = result.publicId;
            uploadedFiles[key] = result.url;
            console.log(`Uploaded ${key} → ${result.url}`);
          } catch (err) {
            console.error(`Upload failed for ${key}:`, err.message);
            uploadErrors.push(key);
          }
        } else if (required) {
          uploadErrors.push(key);
        }
      }
    } else {
      console.warn("No files were parsed by multer");
    }

    // Critical documents check
    const criticalDocs = ["profilePhoto", "panCard", "aadharFront", "drivingLicenseFront", "rcBookFront"];
    const missingCritical = criticalDocs.filter(doc => !updateData[doc] && !uploadErrors.includes(doc));

    if (missingCritical.length > 0 || uploadErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Some required documents were not uploaded successfully",
        missing: missingCritical,
        failedUploads: uploadErrors,
      });
    }

    // Save to database
    const updatedPartner = await DeliveryPartner.findByIdAndUpdate(
      partnerId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPartner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    // Optional: notification
    await createNotification({
      restaurantId: "SYSTEM",
      category: "Registration",
      action: "DELIVERY_PARTNER_ONBOARDING",
      message: `New onboarding submission: ${updatedPartner.fullName} (${updatedPartner.phone || "n/a"})`,
      details: JSON.stringify({
        partnerId: updatedPartner._id.toString(),
        name: updatedPartner.fullName,
        phone: updatedPartner.phone,
        city: updatedPartner.city,
      }),
    });

    console.log("Onboarding completed successfully for", partnerId);
    return res.status(200).json({
      success: true,
      message: "Onboarding submitted successfully. Waiting for approval.",
      partner: {
        id: updatedPartner._id,
        fullName: updatedPartner.fullName,
        phone: updatedPartner.phone,
        onboardingCompleted: updatedPartner.onboardingCompleted,
        approvalStatus: updatedPartner.approvalStatus,
      },
    });

  } catch (err) {
    console.error("ONBOARDING ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Server error during onboarding",
      error: err.message,
    });
  }
};

module.exports = { submitOnboarding };