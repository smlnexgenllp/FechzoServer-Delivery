const mongoose = require("mongoose");
const Food = require("../../../models/restaurants/FoodItemDetails");
const Restaurant = require("../../../models/restaurants/shops/RestaurantDetails");

const fetchFoodAndRestaurants = async (req, res) => {
  try {
    console.log("📥 Request received for fetchFoodAndRestaurants");
    const { payload, page = 1, limit = 20 } = req.query;
    console.log("✅ Query Params:", { payload, page, limit });

    if (!payload) {
      console.log("❌ No payload provided");
      return res.status(400).json({ message: "No payload provided." });
    }

    // Parse payload
    let parsedPayload;
    try {
      parsedPayload = JSON.parse(decodeURIComponent(payload));
      console.log("✅ Parsed Payload:", parsedPayload);
    } catch (error) {
      console.error("❌ Error parsing payload:", error.message);
      return res.status(400).json({ message: "Invalid payload format." });
    }

    // Extract food name and filters
    const foodName = typeof parsedPayload.food === "string" ? parsedPayload.food : parsedPayload.food?.name;
    const { cuisines = [], minRating = "", services = [] } = parsedPayload;
    console.log("🔍 Food Name:", foodName, "Filters:", { cuisines, minRating, services });

    if (!foodName) {
      console.log("❌ Food name missing");
      return res.status(400).json({ message: "Food name is missing in payload." });
    }

    // Build food query with filters
    const foodQuery = { name: { $regex: new RegExp(foodName, "i") } };
    if (cuisines.length > 0) {
      foodQuery.cuisine = { $in: cuisines.map(c => new RegExp(c, "i")) };
    }
    if (services.length > 0) {
      foodQuery.serviceType = { $in: services.map(s => new RegExp(s, "i")) };
    }

    // Search food items
    console.log(`🔎 Searching for food with query:`, foodQuery);
    const foodItems = await Food.find(foodQuery, {
      name: 1,
      image: 1,
      restaurant_id: 1,
      cuisine: 1,
      serviceType: 1
    })
      .lean()
      .limit(Number(limit))
      .skip((page - 1) * Number(limit));

    console.log("✅ Food Items Found:", foodItems.length, foodItems);

    if (!foodItems.length) {
      console.log(`⚠️ No food items found for "${foodName}"`);
      return res.status(404).json({ message: `No food items found for "${foodName}".` });
    }

    // Fetch restaurants
    const restaurantIds = [
      ...new Set(
        foodItems
          .map((item) => item.restaurant_id?.toString())
          .filter(Boolean)
      ),
    ].map((id) => new mongoose.Types.ObjectId(id));
    console.log("✅ Restaurant IDs:", restaurantIds);

    if (!restaurantIds.length) {
      console.log("⚠️ No valid restaurant IDs found");
      return res.status(404).json({ message: "No restaurants found for the given food." });
    }

    // Query restaurants with minRating filter
    const restaurantQuery = { _id: { $in: restaurantIds } };
    if (minRating) {
      const ratingValue = parseFloat(minRating.replace("+", ""));
      restaurantQuery.ratings = { $gte: ratingValue };
    }

    const restaurants = await Restaurant.find(restaurantQuery)
      .select(
        "restaurantId restaurantName restaurantAddress images ratings reviews"
      )
      .lean();

    console.log("✅ Restaurants Found:", restaurants.length, restaurants);

    // Aggregate cuisines and serviceType per restaurant
    const restaurantFoodMap = {};
    foodItems.forEach((food) => {
      const restaurantId = food.restaurant_id.toString();
      if (!restaurantFoodMap[restaurantId]) {
        restaurantFoodMap[restaurantId] = {
          cuisines: new Set(),
          services: new Set(),
          foodImages: [],
        };
      }
      if (food.cuisine) {
        restaurantFoodMap[restaurantId].cuisines.add(food.cuisine);
      }
      if (food.serviceType && Array.isArray(food.serviceType)) {
        food.serviceType.forEach((service) => {
          restaurantFoodMap[restaurantId].services.add(service);
        });
      }
      restaurantFoodMap[restaurantId].foodImages.push({
        name: food.name,
        image: food.image || "https://via.placeholder.com/150",
      });
    });

    // Merge food data with restaurant data
    const restaurantsWithFoodImages = restaurants.map((restaurant) => {
      const foodData = restaurantFoodMap[restaurant._id.toString()] || {
        cuisines: new Set(),
        services: new Set(),
        foodImages: [],
      };

      return {
        restaurantId:restaurant._id,
        restaurant_id: restaurant.restaurantId,
        restaurantDetails: { name: restaurant.restaurantName || "Unknown" },
        restaurant_thumbnail: restaurant.images?.restaurant || "https://via.placeholder.com/300",
        locationDetails: {
          address:
            `${restaurant.restaurantAddress?.shopNumber || ""} ${restaurant.restaurantAddress?.area || ""}, ${restaurant.restaurantAddress?.city || ""}, ${restaurant.restaurantAddress?.state || ""}`.trim() ||
            "Location not available",
        },
        cuisines: Array.from(foodData.cuisines),
        services: Array.from(foodData.services),
        ratings: restaurant.ratings || "No Ratings",
        reviews: restaurant.reviews || "0",
        restaurant_logo: restaurant.images?.profile || null,
        foodImages: foodData.foodImages,
      };
    });

    // Pagination metadata
    const totalFoodItems = await Food.countDocuments(foodQuery);
    console.log("📊 Total Food Items:", totalFoodItems);

    const totalPages = Math.ceil(totalFoodItems / limit);

    res.json({
      data: restaurantsWithFoodImages,
      pagination: {
        currentPage: Number(page),
        totalPages,
        totalItems: totalFoodItems,
        limit: Number(limit),
      },
    });
  } catch (error) {
    console.error("❌ Server Error:", error.message, error.stack);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

module.exports = { fetchFoodAndRestaurants };