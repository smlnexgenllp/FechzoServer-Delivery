const Order = require("../../models/order/order");


exports.getNearbyRestaurants = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ success: false, message: "Location required" });
    }

    const userLat = Number(latitude);
    const userLng = Number(longitude);

    console.log(`Searching restaurants near [${userLng}, ${userLat}]`);

    const restaurants = await Restaurant.find({
      globalStatus: "active",
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [userLng, userLat]  // [longitude, latitude]
          },
          $maxDistance: 10000 // 10 km
        }
      }
    })
      .select("restaurantName restaurantAddress images location")
      .limit(20);

    console.log(`Found ${restaurants.length} nearby restaurants`);

    res.json({
      success: true,
      count: restaurants.length,
      restaurants
    });
  } catch (err) {
    console.error("Nearby restaurants error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch" });
  }
};