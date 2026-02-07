const DeliveryPartner = require("../../models/deliveryPartner/DeliveryPartner");

const submitOnboarding = async (req, res) => {
  try {
    const partnerId = req.partner?.id;

    if (!partnerId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      fullName,
      mobile,
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

    if (!fullName || !mobile || !vehicleType || !vehicleNumber || !city) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const partner = await DeliveryPartner.findByIdAndUpdate(
      partnerId,
      {
        fullName,
        mobile,
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
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Onboarding completed",
      partner,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { submitOnboarding };
