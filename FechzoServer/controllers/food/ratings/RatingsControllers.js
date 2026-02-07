const mongoose = require('mongoose');
const Rating = require('../../../models/restaurants/RatingModels');

const submitRating = async (req, res) => {
    try {
        console.log("➡️ Received rating submission request");
        console.log("🔹 Request body:", req.body);

        const { userId, restaurantId, foodId, rating, review } = req.body;

        if (!userId || !restaurantId || !foodId || !rating) {
            console.warn("⚠️ Missing required fields:", { userId, restaurantId, foodId, rating });
            return res.status(400).json({ message: "Missing required fields" });
        }

        const newRating = new Rating({
            userId,
            restaurantId,
            foodId,
            rating,
            review,
        });

        console.log("📝 Saving new rating:", newRating);

        await newRating.save();

        console.log("✅ Rating saved successfully");
        return res.status(201).json({ message: "Rating submitted successfully" });
    } catch (error) {
        console.error("❌ Error in submitRating:", error);
        return res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

const getRestaurantRatings = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        console.log("📥 Fetching ratings for restaurant:", restaurantId);

        const ratings = await Rating.find({ restaurant: restaurantId }).populate('user', 'name');

        console.log("✅ Ratings fetched:", ratings.length);
        res.json(ratings);
    } catch (err) {
        console.error('❌ Fetch ratings error:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    submitRating,
    getRestaurantRatings,
};
