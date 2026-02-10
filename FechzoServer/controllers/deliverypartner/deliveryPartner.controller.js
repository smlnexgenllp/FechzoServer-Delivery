const DeliveryPartner = require("../../models/deliveryPartner/DeliveryPartner");

// Existing function (DON'T CHANGE)
const checkDeliveryPartner = async (req, res) => {
  try {
    const { phone } = req.body;

    const user = await DeliveryPartner.findOne({ phone });

    res.json({
      exists: !!user,
      user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ NEW: ADMIN – Get pending delivery partners
const getPendingPartners = async (req, res) => {
  try {
    const partners = await DeliveryPartner.find({
      approvalStatus: "PENDING",
    });

    res.status(200).json({
      success: true,
      partners,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ NEW: ADMIN – Approve delivery partner
const approvePartner = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const partner = await DeliveryPartner.findByIdAndUpdate(
      partnerId,
      {
        approvalStatus: "APPROVED",
        isActive: true,
      },
      { new: true }
    );

    if (!partner) {
      return res.status(404).json({ message: "Partner not found" });
    }

    res.status(200).json({
      success: true,
      message: "Partner approved successfully",
      partner,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ADMIN – Get approved partners
const getApprovedPartners = async (req, res) => {
  try {
    const partners = await DeliveryPartner.find({
      approvalStatus: "APPROVED",
    });

    res.status(200).json({
      success: true,
      partners,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};
module.exports = {
  checkDeliveryPartner,
  getPendingPartners,
   approvePartner,
   getApprovedPartners, // 👈 export added
};
  