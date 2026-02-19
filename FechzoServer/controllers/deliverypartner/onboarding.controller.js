const DeliveryPartner = require("../../models/deliverypartner/DeliveryPartner");
const { createNotification } = require("../admin/NotificationController");

const submitOnboarding = async (req, res) => {
  try {
    const partnerId = req.partner?._id;
    if (!partnerId) {
      return res.status(401).json({ success: false, message: "Unauthorized - Please login again" });
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
      bankName,
      accountNumber,
      ifsc,
    } = req.body;

    // Required fields validation
    const requiredFields = { fullName, phone, vehicleType, vehicleNumber, city, area };
    for (const [key, value] of Object.entries(requiredFields)) {
      if (!value?.trim()) {
        return res.status(400).json({ success: false, message: `${key} is required` });
      }
    }

    // Phone format
    if (!/^[6-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ success: false, message: "Invalid Indian mobile number" });
    }

    // Update partner (set onboarding to true, status to PENDING)
    const updatedPartner = await DeliveryPartner.findByIdAndUpdate(
      partnerId,
      {
        fullName: fullName.trim(),
        phone: phone.trim(),
        vehicleType,
        vehicleNumber: vehicleNumber.trim().toUpperCase(),
        licenseNumber: licenseNumber?.trim(),
        aadharNumber: aadharNumber?.trim(),
        city: city.trim(),
        area: area.trim(),
        latitude: latitude ? Number(latitude) : undefined,
        longitude: longitude ? Number(longitude) : undefined,
        bankDetails: {
          bankName: bankName?.trim(),
          accountNumber: accountNumber?.trim(),
          ifsc: ifsc?.trim().toUpperCase(),
          // fundAccountId will be added later when linking via Razorpay
        },
        onboardingCompleted: true,
        approvalStatus: "PENDING",
        isActive: false,
      },
      { new: true, runValidators: true }
    );

    if (!updatedPartner) {
      return res.status(404).json({ success: false, message: "Partner not found" });
    }

    // Create admin notification
    await createNotification({
      restaurantId: "SYSTEM",
      restaurantName: "Delivery Partner System",
      category: "Registration",
      action: "DELIVERY_PARTNER_ONBOARDING",
      message: `New onboarding request from ${updatedPartner.fullName} (${updatedPartner.phone})`,
      details: JSON.stringify({
        partnerId: updatedPartner._id.toString(),
        name: updatedPartner.fullName,
        phone: updatedPartner.phone,
        city: updatedPartner.city,
        vehicle: `${updatedPartner.vehicleType} - ${updatedPartner.vehicleNumber}`,
        status: updatedPartner.approvalStatus,
      }),
    });

    res.status(200).json({
      success: true,
      message: "Onboarding submitted successfully. Waiting for admin approval.",
      partner: {
        fullName: updatedPartner.fullName,
        approvalStatus: updatedPartner.approvalStatus,
      },
    });
  } catch (error) {
    console.error("Onboarding submission error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Server error during onboarding",
    });
  }
};

module.exports = { submitOnboarding };