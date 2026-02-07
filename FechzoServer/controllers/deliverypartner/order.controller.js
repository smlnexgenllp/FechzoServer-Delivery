const Order = require("../../models/order/order");

exports.getNearbyOrders = async (req, res) => {
  try {
    const partner = req.partner; // from auth middleware

    if (!partner.latitude || !partner.longitude) {
      return res.status(400).json({ message: "Partner location missing" });
    }

    const orders = await Order.find({
      orderStatus: "ready_for_pickup",
      "delivery.partnerId": null,
      deliveryLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [partner.longitude, partner.latitude],
          },
          $maxDistance: 10000, // 10 km
        },
      },
    }).populate("restaurantId", "name address");

    res.json({ success: true, orders });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};
