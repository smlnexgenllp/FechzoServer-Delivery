const DeliveryPartner = require("../../models/deliveryPartner/DeliveryPartner");
const { createNotification } = require("../admin/NotificationController");

const submitOnboarding = async (req, res) => {
  try {
    const partnerId = req.partner?.id;
    if (!partnerId) {
      return res.status(401).json({ message: "Unauthorized" });
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

    if (!fullName || !phone || !vehicleType || !vehicleNumber || !city) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const partner = await DeliveryPartner.findByIdAndUpdate(
      partnerId,
      {
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
        onboardingCompleted: true,
        approvalStatus: "PENDING",
        isActive: false,
      },
      { new: true }
    );

    // ✅ ADMIN NOTIFICATION (SCHEMA-SAFE)
    await createNotification({
      restaurantId: "SYSTEM", // required string
      restaurantName: "Delivery Partner Module",

      category: "Registration", // ✅ VALID ENUM

      action: "DELIVERY_PARTNER_ONBOARDING",

      message: `New delivery partner onboarding request from ${partner.fullName}`,

      details: JSON.stringify({
        partnerId: partner._id,
        name: partner.fullName,
        phone: partner.phone,
        city: partner.city,
        vehicleType: partner.vehicleType,
      }),
    });

    res.status(200).json({
      success: true,
      message: "Onboarding submitted. Waiting for admin approval.",
    });

  } catch (error) {
    console.error("Onboarding error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { submitOnboarding };
