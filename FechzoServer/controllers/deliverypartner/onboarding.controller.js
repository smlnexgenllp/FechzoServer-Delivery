const cloudinary = require("../../config/cloudinary");
const DeliveryPartner = require("../../models/deliverypartner/DeliveryPartner");
const { createNotification } = require("../admin/NotificationController"); // adjust path if needed

// Helper: upload single file buffer to Cloudinary
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
  console.log("[ONBOARDING] Request received from partner:", req.partner?._id || req.partner?.id);

  try {
    // ── 1. Get partner ID safely ────────────────────────────────────────
    const partnerId = req.partner?._id?.toString() || req.partner?.id;
    if (!partnerId) {
      console.warn("[ONBOARDING] Missing partner ID in request");
      return res.status(401).json({ 
        success: false,
        message: "Unauthorized - authentication required" 
      });
    }

    // ── 2. Extract body fields ──────────────────────────────────────────
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

    // ── 3. Required fields validation with detailed feedback ────────────
    const missing = [];

    if (!fullName?.trim())                  missing.push("fullName");
    if (!vehicleType)                       missing.push("vehicleType");
    if (!vehicleNumber?.trim())             missing.push("vehicleNumber");
    if (!city?.trim())                      missing.push("city");

    if (missing.length > 0) {
      console.warn("[ONBOARDING] Validation failed - missing:", missing);
      return res.status(400).json({ 
        success: false,
        message: "Missing required fields",
        missingFields: missing,
        note: "Required: fullName, vehicleType, vehicleNumber, city"
      });
    }

    // ── 4. Prepare update data ──────────────────────────────────────────
    const updateData = {
      fullName: fullName.trim(),
      phone: phone?.trim() || undefined,   // phone is optional
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

    // ── 5. Handle file uploads (Cloudinary) ─────────────────────────────
    if (req.files && Object.keys(req.files).length > 0) {
      console.log("[ONBOARDING] Files received:", Object.keys(req.files));

      const files = req.files;

      const uploadTasks = [];

      if (files.profilePhoto?.[0]?.buffer) {
        uploadTasks.push(
          uploadToCloudinary(files.profilePhoto[0].buffer, "profiles", "profile")
            .then(({ url, publicId }) => {
              updateData.profilePhoto = url;
              updateData.profilePhotoPublicId = publicId;
            })
            .catch(err => console.error("Profile photo upload failed:", err))
        );
      }

      if (files.panCard?.[0]?.buffer) {
        uploadTasks.push(
          uploadToCloudinary(files.panCard[0].buffer, "kyc", "pan")
            .then(({ url, publicId }) => {
              updateData.panCard = url;
              updateData.panCardPublicId = publicId;
            })
            .catch(err => console.error("PAN upload failed:", err))
        );
      }

      if (files.aadharFront?.[0]?.buffer) {
        uploadTasks.push(
          uploadToCloudinary(files.aadharFront[0].buffer, "kyc", "aadhar")
            .then(({ url, publicId }) => {
              updateData.aadharFront = url;
              updateData.aadharFrontPublicId = publicId;
            })
            .catch(err => console.error("Aadhaar upload failed:", err))
        );
      }

      if (files.drivingLicenseFront?.[0]?.buffer) {
        uploadTasks.push(
          uploadToCloudinary(files.drivingLicenseFront[0].buffer, "kyc", "license")
            .then(({ url, publicId }) => {
              updateData.drivingLicenseFront = url;
              updateData.drivingLicenseFrontPublicId = publicId;
            })
            .catch(err => console.error("License upload failed:", err))
        );
      }

      if (files.rcBookFront?.[0]?.buffer) {
        uploadTasks.push(
          uploadToCloudinary(files.rcBookFront[0].buffer, "kyc", "rc")
            .then(({ url, publicId }) => {
              updateData.rcBookFront = url;
              updateData.rcBookFrontPublicId = publicId;
            })
            .catch(err => console.error("RC upload failed:", err))
        );
      }

      // Wait for all uploads (non-blocking errors)
      await Promise.allSettled(uploadTasks);
    }

    // ── 6. Update partner in database ───────────────────────────────────
    const updatedPartner = await DeliveryPartner.findByIdAndUpdate(
      partnerId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedPartner) {
      console.warn("[ONBOARDING] Partner not found:", partnerId);
      return res.status(404).json({ 
        success: false,
        message: "Partner account not found" 
      });
    }

    // ── 7. Optional: send admin notification ────────────────────────────
    try {
      await createNotification({
        restaurantId: "SYSTEM",
        restaurantName: "Delivery Partner Module",
        category: "Registration",
        action: "DELIVERY_PARTNER_ONBOARDING",
        message: `New onboarding request: ${updatedPartner.fullName || "Unnamed Partner"} (${updatedPartner.phone || "No phone"})`,
        details: JSON.stringify({
          partnerId: updatedPartner._id.toString(),
          name: updatedPartner.fullName,
          phone: updatedPartner.phone || "—",
          city: updatedPartner.city || "—",
          vehicle: `${updatedPartner.vehicleType || "?"} - ${updatedPartner.vehicleNumber || "?"}`,
        }),
      });
      console.log("[ONBOARDING] Admin notification sent");
    } catch (notifyErr) {
      console.warn("[ONBOARDING] Notification failed (non-critical):", notifyErr.message);
    }

    // ── 8. Success response ─────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      message: "Onboarding submitted successfully. Waiting for admin approval.",
      partner: {
        id: updatedPartner._id,
        fullName: updatedPartner.fullName,
        approvalStatus: updatedPartner.approvalStatus,
      }
    });

  } catch (err) {
    console.error("[ONBOARDING] CRITICAL ERROR:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    let status = 500;
    let message = "Server error during onboarding";

    if (err.name === "ValidationError") {
      status = 400;
      message = "Validation failed";
      const details = Object.values(err.errors || {}).map(e => ({
        field: e.path,
        message: e.message
      }));
      return res.status(status).json({ success: false, message, details });
    }

    if (err.message?.includes("Only JPG")) {
      status = 400;
      message = "Invalid file format - only JPG/PNG allowed";
    }

    return res.status(status).json({ 
      success: false, 
      message,
      ...(process.env.NODE_ENV === "development" && { debug: err.message })
    });
  }
};

module.exports = { submitOnboarding };