const mongoose = require('mongoose');
const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');

exports.getRestaurantNumbers = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    console.log(`[DEBUG] Raw restaurantId from params:`, restaurantId);
    console.log(`[DEBUG] Type of restaurantId:`, typeof restaurantId);

    if (!restaurantId || typeof restaurantId !== 'string') {
      console.warn('[ERROR] restaurantId missing or invalid type');
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    const cleanId = restaurantId.trim();
    console.log(`[DEBUG] Cleaned restaurantId:`, cleanId);

    if (!mongoose.Types.ObjectId.isValid(cleanId)) {
      console.warn('[ERROR] Invalid MongoDB ObjectId format:', cleanId);
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    const restaurant = await Restaurant.findById(cleanId)
      .select('numbers.contactNumbers numbers.reminderNumbers')
      .lean();

    console.log('[DEBUG] Database query result:', restaurant);

    if (!restaurant) {
      console.warn(`[ERROR] No restaurant found for ID: ${cleanId}`);
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    return res.status(200).json({
      contactNumbers: restaurant.numbers?.contactNumbers || [],
      reminderNumbers: restaurant.numbers?.reminderNumbers || []
    });
  } catch (error) {
    console.error('[ERROR] Server error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.updateRestaurantNumbers = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { contactNumbers, reminderNumbers } = req.body;

    console.log(`[DEBUG] Updating numbers for restaurantId:`, restaurantId);
    console.log(`[DEBUG] Payload:`, { contactNumbers, reminderNumbers });

    if (!restaurantId || typeof restaurantId !== 'string') {
      console.warn('[ERROR] restaurantId missing or invalid type');
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    const cleanId = restaurantId.trim();
    if (!mongoose.Types.ObjectId.isValid(cleanId)) {
      console.warn('[ERROR] Invalid MongoDB ObjectId format:', cleanId);
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    if (!Array.isArray(contactNumbers) || !Array.isArray(reminderNumbers)) {
      console.warn('[ERROR] Invalid numbers payload');
      return res.status(400).json({ message: 'Contact and reminder numbers must be arrays' });
    }

    // Validate phone numbers
    const phoneRegex = /^\+91-\d{10}$/;
    const validateNumbers = (numbers) => numbers.every(num => 
      num.label && typeof num.label === 'string' && num.label.trim() && 
      num.number && phoneRegex.test(num.number)
    );

    if (!validateNumbers(contactNumbers) || !validateNumbers(reminderNumbers)) {
      console.warn('[ERROR] Invalid number format');
      return res.status(400).json({ message: 'Each number must have a non-empty label and a valid phone number (+91-XXXXXXXXXX)' });
    }

    const restaurant = await Restaurant.findById(cleanId);
    if (!restaurant) {
      console.warn(`[ERROR] No restaurant found for ID: ${cleanId}`);
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    restaurant.numbers = {
      contactNumbers,
      reminderNumbers
    };

    await restaurant.save();
    console.log('[DEBUG] Numbers updated successfully');

    return res.status(200).json({ 
      message: 'Numbers updated successfully', 
      contactNumbers, 
      reminderNumbers 
    });
  } catch (error) {
    console.error('[ERROR] Server error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};