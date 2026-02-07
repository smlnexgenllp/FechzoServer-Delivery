// controllers/partner/onboarding.controller.js
const DeliveryPartner = require("../../models/deliverypartner/DeliveryPartner");

exports.submitOnboarding = async (req, res) => {
  try {
    const partner = await DeliveryPartner.findById(req.partnerId);

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    const {
      fullName,
      phone,
      vehicleType,
      vehicleNumber,
      drivingLicense,
      aadhaarNumber,
      panNumber,
      bankAccount,
      latitude,
      longitude,
    } = req.body;

    // Update fields
    partner.fullName = fullName;
    partner.phone = phone;
    partner.vehicleType = vehicleType;
    partner.vehicleNumber = vehicleNumber;
    partner.drivingLicense = drivingLicense;
    partner.aadhaarNumber = aadhaarNumber;
    partner.panNumber = panNumber;
    partner.bankAccount = bankAccount;

    // 📍 Save GeoJSON location
    if (latitude && longitude) {
      partner.currentLocation = {
        type: "Point",
        coordinates: [longitude, latitude], // IMPORTANT: lng first
      };
    }

    partner.documentsSubmitted = true;

    await partner.save();

    res.status(200).json({
      success: true,
      message: "Onboarding submitted successfully",
      partner,
    });
  } catch (err) {
    console.error("Onboarding error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
