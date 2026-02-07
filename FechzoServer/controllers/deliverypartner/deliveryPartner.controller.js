const DeliveryPartner = require("../../models/deliveryPartner/DeliveryPartner");

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

module.exports = {
  checkDeliveryPartner,
};
