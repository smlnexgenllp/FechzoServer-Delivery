const express = require("express");
const router = express.Router();
const axios = require("axios");

router.get("/distance", async (req, res) => {
  const { originLat, originLng, destLat, destLng } = req.query;
  const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

  console.log("Received request to /distance");
  console.log("Origin:", originLat, originLng);
  console.log("Destination:", destLat, destLng);

  if (!originLat || !originLng || !destLat || !destLng) {
    console.warn("Missing coordinates in query params");
    return res.status(400).json({ message: "Missing coordinates" });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${originLat},${originLng}&destinations=${destLat},${destLng}&key=${GOOGLE_MAPS_API_KEY}`;
    console.log("Calling Google Distance Matrix API:", url);

    const response = await axios.get(url);
    const data = response.data;

    console.log("Google API response status:", data.status);
    console.log("Full API response:", JSON.stringify(data, null, 2));

    if (data.status !== "OK" || !data.rows[0]?.elements[0]?.distance) {
      console.error("Invalid response from Google API:", data.error_message || "No distance data");
      throw new Error(data.error_message || "Failed to calculate distance");
    }

    const distanceMeters = data.rows[0].elements[0].distance.value;
    const distanceKm = distanceMeters / 1000;
    const deliveryCharge = (distanceKm * 4 + 20).toFixed(2);

    console.log(`Distance: ${distanceKm.toFixed(2)} km`);
    console.log(`Calculated Delivery Charge: ₹${deliveryCharge}`);

    res.status(200).json({
      distanceKm: distanceKm.toFixed(2),
      deliveryCharge,
    });
  } catch (err) {
    console.error("Distance Matrix error:", err.message);
    res.status(500).json({ message: err.message || "Failed to calculate distance" });
  }
});

module.exports = router;
