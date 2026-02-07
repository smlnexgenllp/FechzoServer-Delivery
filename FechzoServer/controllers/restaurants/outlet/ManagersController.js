const mongoose = require('mongoose');
const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');

exports.getRestaurantAccountManager = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    console.log(`[DEBUG] Fetching account manager for restaurantId:`, restaurantId);

    if (!restaurantId || typeof restaurantId !== 'string') {
      console.warn('[ERROR] restaurantId missing or invalid type');
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    const cleanId = restaurantId.trim();
    if (!mongoose.Types.ObjectId.isValid(cleanId)) {
      console.warn('[ERROR] Invalid MongoDB ObjectId format:', cleanId);
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    const restaurant = await Restaurant.findById(cleanId)
      .select('accountManager')
      .lean();

    console.log('[DEBUG] Database query result:', restaurant);

    if (!restaurant) {
      console.warn(`[ERROR] No restaurant found for ID: ${cleanId}`);
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const accountManager = restaurant.accountManager || {
      name: "",
      designation: "",
      email: "",
      phone: ""
    };

    return res.status(200).json(accountManager);
  } catch (error) {
    console.error('[ERROR] Failed to fetch account manager:', error.message, error.stack);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

exports.updateRestaurantAccountManager = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { name, designation, email, phone } = req.body;

    console.log(`[DEBUG] Updating account manager for restaurantId:`, restaurantId);
    console.log(`[DEBUG] Payload:`, { name, designation, email, phone });

    if (!restaurantId || typeof restaurantId !== 'string') {
      console.warn('[ERROR] restaurantId missing or invalid type');
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    const cleanId = restaurantId.trim();
    if (!mongoose.Types.ObjectId.isValid(cleanId)) {
      console.warn('[ERROR] Invalid MongoDB ObjectId format:', cleanId);
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    if (!name || !designation || !email || !phone) {
      console.warn('[ERROR] Missing required fields');
      return res.status(400).json({ message: 'All account manager fields (name, designation, email, phone) are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.warn('[ERROR] Invalid email format');
      return res.status(400).json({ message: 'Invalid email format' });
    }

    const phoneRegex = /^\+91-\d{10}$/;
    if (!phoneRegex.test(phone)) {
      console.warn('[ERROR] Invalid phone format');
      return res.status(400).json({ message: 'Phone must be in format +91-XXXXXXXXXX' });
    }

    const restaurant = await Restaurant.findById(cleanId);
    if (!restaurant) {
      console.warn(`[ERROR] No restaurant found for ID: ${cleanId}`);
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    restaurant.accountManager = { name, designation, email, phone };
    await restaurant.save();
    console.log('[DEBUG] Account manager updated successfully');

    return res.status(200).json({ name, designation, email, phone });
  } catch (error) {
    console.error('[ERROR] Failed to update account manager:', error.message, error.stack);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};