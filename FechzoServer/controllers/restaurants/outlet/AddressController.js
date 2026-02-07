const mongoose = require('mongoose');
const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');

exports.getRestaurantAddress = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    console.log(`[DEBUG] Raw restaurantId from params:`, restaurantId);
    console.log(`[DEBUG] Type of restaurantId:`, typeof restaurantId);

    // Validate restaurantId format
    if (!restaurantId || typeof restaurantId !== 'string') {
      console.warn('[ERROR] restaurantId missing or invalid type');
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    // Clean restaurantId string
    const cleanId = restaurantId.trim();
    console.log(`[DEBUG] Cleaned restaurantId:`, cleanId);

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(cleanId)) {
      console.warn('[ERROR] Invalid MongoDB ObjectId format:', cleanId);
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    // Query database
    const restaurant = await Restaurant.findById(cleanId)
      .select('restaurantName restaurantAddress')
      .lean();

    console.log('[DEBUG] Database query result:', restaurant);

    if (!restaurant) {
      console.warn(`[ERROR] No restaurant found for ID: ${cleanId}`);
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    return res.status(200).json({
      restaurantName: restaurant.restaurantName,
      restaurantAddress: {
        shopNumber: restaurant.restaurantAddress.shopNumber,
        area: restaurant.restaurantAddress.area,
        city: restaurant.restaurantAddress.city,
        postalCode: restaurant.restaurantAddress.postalCode,
        state: restaurant.restaurantAddress.state,
        landmark: restaurant.restaurantAddress.landmark,
        latitude: restaurant.restaurantAddress.latitude,
        longitude: restaurant.restaurantAddress.longitude,
        mapLink: restaurant.restaurantAddress.mapLink
      }
    });

  } catch (error) {
    console.error('[ERROR] Server error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.updateRestaurantAddress = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { restaurantName, restaurantAddress } = req.body;
    console.log(`[updateRestaurantAddress] Updating address for restaurantId: ${restaurantId}`, { restaurantName, restaurantAddress });
    console.log(`[updateRestaurantAddress] Request headers:`, req.headers);
    console.log(`[updateRestaurantAddress] Authenticated user:`, req.user || 'None');

    // Validate restaurantId
    if (!restaurantId || restaurantId === 'undefined') {
      console.warn('[updateRestaurantAddress] Invalid restaurantId: received undefined or empty');
      return res.status(400).json({ message: 'Restaurant ID is required' });
    }

    // Validate MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      console.warn('[updateRestaurantAddress] Invalid MongoDB ObjectId format:', restaurantId);
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    // Validate request body
    if (!restaurantName || !restaurantAddress) {
      console.warn('[updateRestaurantAddress] Missing required fields in request body');
      return res.status(400).json({ message: 'Restaurant name and address are required' });
    }

    // Use findByIdAndUpdate to query by _id
    const restaurant = await Restaurant.findByIdAndUpdate(
      restaurantId,
      {
        restaurantName,
        restaurantAddress: {
          shopNumber: restaurantAddress.shopNumber || '',
          area: restaurantAddress.area || '',
          city: restaurantAddress.city || '',
          postalCode: restaurantAddress.postalCode || '',
          state: restaurantAddress.state || '',
          landmark: restaurantAddress.landmark || '',
          latitude: restaurantAddress.latitude || '',
          longitude: restaurantAddress.longitude || '',
          mapLink: restaurantAddress.mapLink || ''
        }
      },
      { new: true, runValidators: true }
    );

    if (!restaurant) {
      console.log(`[updateRestaurantAddress] No restaurant found for _id: ${restaurantId}`);
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    res.status(200).json({
      restaurantName: restaurant.restaurantName,
      restaurantAddress: {
        shopNumber: restaurant.restaurantAddress.shopNumber,
        area: restaurant.restaurantAddress.area,
        city: restaurant.restaurantAddress.city,
        postalCode: restaurant.restaurantAddress.postalCode,
        state: restaurant.restaurantAddress.state,
        landmark: restaurant.restaurantAddress.landmark,
        latitude: restaurant.restaurantAddress.latitude,
        longitude: restaurant.restaurantAddress.longitude,
        mapLink: restaurant.restaurantAddress.mapLink
      }
    });
  } catch (error) {
    console.error(`[updateRestaurantAddress] Error: ${error.message}`, error.stack);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', errors: error.errors });
    }
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};