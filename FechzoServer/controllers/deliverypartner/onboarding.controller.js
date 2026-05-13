// controllers/deliveryPartner/deliveryPartner.controller.js
const cloudinary = require("../../config/cloudinary");
const DeliveryPartner = require("../../models/deliverypartner/DeliveryPartner");
const { createNotification } = require("../admin/NotificationController");

const uploadToCloudinary = (buffer, folder, prefix) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `delivery-partners/${folder}`,
        public_id: `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png"],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
};

const submitOnboarding = async (req, res) => {
  try {
    const partnerId = req.partner?._id?.toString() || req.partner?.id;
    if (!partnerId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

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
    } = req.body;

    const required = { fullName, vehicleType, vehicleNumber, city };
    const missing = Object.keys(required).filter(k => !required[k]?.trim());
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
        missingFields: missing,
      });
    }

    const updateData = {
      fullName: fullName.trim(),
      phone: phone?.trim(),
      vehicleType,
      vehicleNumber: vehicleNumber.trim().toUpperCase(),
      licenseNumber: licenseNumber?.trim()?.toUpperCase(),
      aadharNumber: aadharNumber?.trim(),
      city: city.trim(),
      area: area?.trim(),
      latitude: latitude ? Number(latitude) : undefined,
      longitude: longitude ? Number(longitude) : undefined,
      onboardingCompleted: true,
      approvalStatus: "PENDING",
      isActive: false,
    };

    // Handle file uploads
    if (req.files && Object.keys(req.files).length > 0) {
      const files = req.files;
      const uploads = [];

      if (files.profilePhoto?.[0]?.buffer) {
        uploads.push(
          uploadToCloudinary(files.profilePhoto[0].buffer, "profiles", "profile")
            .then(r => {
              updateData.profilePhoto = r.url;
              updateData.profilePhotoPublicId = r.publicId;
            })
        );
      }

      if (files.panCard?.[0]?.buffer) {
        uploads.push(
          uploadToCloudinary(files.panCard[0].buffer, "kyc", "pan")
            .then(r => {
              updateData.panCard = r.url;
              updateData.panCardPublicId = r.publicId;
            })
        );
      }

      // Repeat for aadharFront, drivingLicenseFront, rcBookFront...

      await Promise.allSettled(uploads);
    }

    const partner = await DeliveryPartner.findByIdAndUpdate(partnerId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!partner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    // Notification to admin
    await createNotification({
      restaurantId: "SYSTEM",
      category: "Registration",
      action: "DELIVERY_PARTNER_ONBOARDING",
      message: `New onboarding: ${partner.fullName} (${partner.phone || "No phone"})`,
      details: JSON.stringify({
        partnerId: partner._id.toString(),
        name: partner.fullName,
        phone: partner.phone,
        city: partner.city,
      }),
    });

    res.status(200).json({
      success: true,
      message: "Onboarding submitted. Bank linking in progress. Waiting for approval.",
    });
  } catch (err) {
    console.error("[ONBOARDING] Error:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
};

module.exports = { submitOnboarding };