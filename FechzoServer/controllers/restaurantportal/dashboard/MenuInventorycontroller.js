const mongoose = require('mongoose');
const cron = require('node-cron');
const { DateTime } = require('luxon');
const Food = require('../../../models/restaurants/FoodItemDetails');
const Category = require('../../../models/restaurants/FoodCategory');
const SubCategory = require('../../../models/restaurants/FoodSubCategory');

/**
 * Get current time in HH:mm format
 */
const getCurrentTime = (zone = 'Asia/Kolkata') =>
  DateTime.now().setZone(zone).toFormat('HH:mm');

/**
 * Handles same-day and overnight time ranges
 * Examples:
 * 09:00 - 22:00  ✔
 * 22:00 - 02:00  ✔
 */
const isTimeInRange = (current, start, end) => {
  if (!current || !start || !end) return false;

  if (start <= end) {
    return current >= start && current <= end;
  }

  // Overnight range
  return current >= start || current <= end;
};

// =======================
// CRON JOB
// =======================
const startAutoUpdateJob = () => {
  console.log('Starting auto-update cron job');

  cron.schedule('* * * * *', async () => {
    try {
      console.log('Running auto-update status job');

      const foods = await Food.find({ autoUpdate: true });
      console.log('Found auto-update foods:', foods.length);

      const currentTime = getCurrentTime();

      for (const food of foods) {
        if (food.availableTimeStart && food.availableTimeEnd) {
          const shouldBeAvailable = isTimeInRange(
            currentTime,
            food.availableTimeStart,
            food.availableTimeEnd
          );

          if (food.available_status !== shouldBeAvailable) {
            food.available_status = shouldBeAvailable;
            await food.save();

            console.log('Updated status for food:', {
              foodId: food._id.toString(),
              name: food.name,
              available_status: food.available_status,
            });
          }
        }
      }

      console.log('Auto-update status job completed');
    } catch (error) {
      console.error('Error in auto-update status job:', {
        message: error.message,
        stack: error.stack,
      });
    }
  });
};

/**
 * IMPORTANT:
 * Enable this only on ONE server instance
 * Example:
 * RUN_CRON=true node server.js
 */
if (process.env.RUN_CRON === 'true') {
  startAutoUpdateJob();
}

// =======================
// GET FOODS BY RESTAURANT
// =======================
exports.getFoodsByRestaurant = async (req, res) => {
  try {
    console.log('Entering getFoodsByRestaurant', { query: req.query });

    const { restaurant_id } = req.query;

    if (!restaurant_id) {
      console.warn('Missing restaurant_id in query');
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID is required',
      });
    }

    console.log('Fetching foods for restaurant_id:', restaurant_id);

    const foods = await Food.find({ restaurant_id })
      .populate('category_id', 'name')
      .populate('subcategory_id', 'name')
      .lean();

    console.log('Fetched foods count:', foods.length);

    const formattedFoods = foods.map((food) => {
      let status;

      if (food.autoUpdate && food.availableTimeStart && food.availableTimeEnd) {
        const currentTime = getCurrentTime();

        const isAvailable = isTimeInRange(
          currentTime,
          food.availableTimeStart,
          food.availableTimeEnd
        );

        status = isAvailable ? 'In Stock' : 'Out of Stock';
      } else {
        status = food.available_status ? 'In Stock' : 'Out of Stock';
      }

      return {
        id: food._id.toString(),
        name: food.name,
        category: food.category_id?.name || 'Uncategorized',
        subcategory: food.subcategory_id?.name || '',
        status,
        price: food.price,
        description: food.description || '',
        autoUpdate: food.autoUpdate || false,
        availableTimeStart: food.availableTimeStart || '',
        availableTimeEnd: food.availableTimeEnd || '',
      };
    });

    console.log('Formatted foods count:', formattedFoods.length);

    res.status(200).json({
      success: true,
      foods: formattedFoods,
    });
  } catch (error) {
    console.error('Error fetching foods:', {
      message: error.message,
      stack: error.stack,
    });
    res.status(500).json({
      success: false,
      message: 'Server error while fetching foods',
    });
  }
};

// =======================
// UPDATE FOOD STATUS (MANUAL)
// =======================
exports.updateFoodStatus = async (req, res) => {
  try {
    console.log('Entering updateFoodStatus', {
      params: req.params,
      body: req.body,
    });

    const { foodId } = req.params;
    const { available_status } = req.body;

    const food = await Food.findById(foodId);
    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Food item not found',
      });
    }

    // Manual action disables autoUpdate
    food.available_status = available_status;
    food.autoUpdate = false;
    food.availableTimeStart = '';
    food.availableTimeEnd = '';

    await food.save();

    res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      food: {
        id: food._id.toString(),
        name: food.name,
        available_status: food.available_status,
        autoUpdate: food.autoUpdate,
        availableTimeStart: food.availableTimeStart,
        availableTimeEnd: food.availableTimeEnd,
      },
    });
  } catch (error) {
    console.error('Error updating food status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating status',
    });
  }
};

// =======================
// UPDATE AUTO SETTINGS
// =======================
exports.updateFoodAutoSettings = async (req, res) => {
  try {
    console.log('Entering updateFoodAutoSettings', {
      params: req.params,
      body: req.body,
    });

    const { foodId } = req.params;
    const { autoUpdate, availableTimeStart, availableTimeEnd } = req.body;

    if (autoUpdate && (!availableTimeStart || !availableTimeEnd)) {
      return res.status(400).json({
        success: false,
        message: 'Start and end time are required for auto update',
      });
    }

    const food = await Food.findById(foodId);
    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Food item not found',
      });
    }

    food.autoUpdate = autoUpdate;
    food.availableTimeStart = autoUpdate ? availableTimeStart : '';
    food.availableTimeEnd = autoUpdate ? availableTimeEnd : '';

    if (autoUpdate) {
      const currentTime = getCurrentTime();
      food.available_status = isTimeInRange(
        currentTime,
        food.availableTimeStart,
        food.availableTimeEnd
      );
    }

    await food.save();

    res.status(200).json({
      success: true,
      message: 'Auto-update settings updated successfully',
      food: {
        id: food._id.toString(),
        name: food.name,
        autoUpdate: food.autoUpdate,
        availableTimeStart: food.availableTimeStart,
        availableTimeEnd: food.availableTimeEnd,
        available_status: food.available_status,
      },
    });
  } catch (error) {
    console.error('Error updating food auto settings:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating auto settings',
    });
  }
};
