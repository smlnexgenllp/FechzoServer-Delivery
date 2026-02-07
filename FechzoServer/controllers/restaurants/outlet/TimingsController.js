const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');
const RestaurantLog = require('../../../models/restaurants/logs/RestaurantLogSchema');
const OperatingHoursController = require('../Logcontroller/OperatingHoursController');

function isRestaurantOpenNow(restaurant) {
  if (restaurant.globalStatus !== "active") return false;
  const now = DateTime.now().setZone("Asia/Kolkata");
  const day = now.toFormat('cccc'); // e.g., "Monday"
  const minutesNow = now.hour * 60 + now.minute;

  for (const service of ["delivery", "dineIn", "takeaway"]) {
    const timing = restaurant.timings[service];
    if (timing && timing.isActive && timing.schedule[day]) {
      for (const slot of timing.schedule[day]) {
        if (!slot.openTime || !slot.closeTime) continue;
        const [openH, openM] = slot.openTime.split(":").map(Number);
        const [closeH, closeM] = slot.closeTime.split(":").map(Number);
        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;
        if (minutesNow >= openMinutes && minutesNow < closeMinutes) {
          return true;
        }
      }
    }
  }
  return false;
}

exports.getIsOpenNow = async (req, res) => {
  const { restaurantId } = req.params;
  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) return res.status(404).json({ message: "Not found" });
  const openNow = isRestaurantOpenNow(restaurant);
  res.json({ openNow });
};

exports.getGlobalStatus = async (req, res) => {
  const { restaurantId } = req.params;
  const restaurant = await Restaurant.findById(restaurantId).select('globalStatus');
  if (!restaurant) return res.status(404).json({ message: "Not found" });
  res.json({ globalStatus: restaurant.globalStatus });
};

exports.setGlobalStatus = async (req, res) => {
  const { restaurantId } = req.params;
  const { globalStatus } = req.body;
  if (!["active", "inactive"].includes(globalStatus)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  const restaurant = await Restaurant.findById(restaurantId);
  if (!restaurant) return res.status(404).json({ message: "Not found" });

  const previousStatus = restaurant.globalStatus;

  // Save/restore per-service state
  if (globalStatus === "inactive") {
    // Save current state
    restaurant.previousServiceStatus = {
      delivery: restaurant.timings?.delivery?.isActive ?? false,
      dineIn: restaurant.timings?.dineIn?.isActive ?? false,
      takeaway: restaurant.timings?.takeaway?.isActive ?? false
    };
    // Close all services
    if (restaurant.timings) {
      if (restaurant.timings.delivery) restaurant.timings.delivery.isActive = false;
      if (restaurant.timings.dineIn) restaurant.timings.dineIn.isActive = false;
      if (restaurant.timings.takeaway) restaurant.timings.takeaway.isActive = false;
    }
    await OperatingHoursController.startInterruption(restaurantId, 'manual_inactive', 'Set inactive by partner');
  } else if (globalStatus === "active") {
    // Restore previous state
    if (restaurant.previousServiceStatus) {
        if (restaurant.timings.delivery)
            restaurant.timings.delivery.isActive = restaurant.previousServiceStatus.delivery;
        if (restaurant.timings.dineIn)
            restaurant.timings.dineIn.isActive = restaurant.previousServiceStatus.dineIn;
        if (restaurant.timings.takeaway)
            restaurant.timings.takeaway.isActive = restaurant.previousServiceStatus.takeaway;
    }
    await OperatingHoursController.endInterruption(restaurantId, 'manual_inactive');

    // ADD THIS: Start the day's record if not present
    // You need to determine scheduledOpen and scheduledClose for today
    const today = new Date();
    const dayName = today.toLocaleDateString('en-US', { weekday: 'long' }); // e.g., "Monday"
    // Example: Use delivery timings, or pick the earliest open and latest close among all services
    let scheduledOpen = null, scheduledClose = null;
    const allSlots = [];
    ['delivery', 'dineIn', 'takeaway'].forEach(service => {
        const serviceTimings = restaurant.timings[service];
        if (serviceTimings && serviceTimings.schedule[dayName]) {
            serviceTimings.schedule[dayName].forEach(slot => {
                if (slot.openTime && slot.closeTime) {
                    allSlots.push(slot);
                }
            });
        }
    });
    if (allSlots.length > 0) {
        scheduledOpen = new Date(today.toDateString() + ' ' + allSlots.map(s => s.openTime).sort()[0]);
        scheduledClose = new Date(today.toDateString() + ' ' + allSlots.map(s => s.closeTime).sort().reverse()[0]);
    } else {
        scheduledOpen = today;
        scheduledClose = today;
    }
    await OperatingHoursController.startOperatingDay(restaurantId, scheduledOpen, scheduledClose);
  }

  restaurant.globalStatus = globalStatus;
  await restaurant.save();

  // Log the global status change
  try {
    const user = req.user?.username || 'Restaurant Manager';

    const logEntry = new RestaurantLog({
      restaurantId: restaurantId,
      category: 'status',
      title: 'Restaurant Status Changed',
      message: `Restaurant status changed from ${previousStatus} to ${globalStatus}`,
      status: globalStatus,
      details: {
        previousStatus,
        newStatus: globalStatus,
        affectedServices: restaurant.previousServiceStatus || {}
      },
      user,
      timestamp: new Date()
    });

    await logEntry.save();

    // Emit socket event if socket.io is available
    const io = req.app.get('io');
    if (io) {
      io.to(restaurantId).emit('logUpdated', logEntry);
    }
  } catch (logError) {
    console.error('[ERROR] Failed to log status change:', logError);
    // Continue with the regular response
  }

  res.json({ globalStatus: restaurant.globalStatus });
};

exports.getRestaurantTimings = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId.trim())) {
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    const restaurant = await Restaurant.findById(restaurantId.trim()).select('timings').lean();

    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // Return all service schedules
    return res.status(200).json({
      dineIn: restaurant.timings.dineIn || { schedule: {}, isActive: false },
      delivery: restaurant.timings.delivery || { schedule: {}, isActive: false },
      takeaway: restaurant.timings.takeaway || { schedule: {}, isActive: false }
    });
  } catch (error) {
    console.error('[ERROR] Server error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.updateRestaurantTimings = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { service, schedule, isActive } = req.body;

    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId.trim())) {
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    if (!['dineIn', 'delivery', 'takeaway'].includes(service)) {
      return res.status(400).json({ message: 'Invalid service type' });
    }

    if (!schedule) {
      return res.status(400).json({ message: 'Schedule is required' });
    }

    const restaurant = await Restaurant.findById(restaurantId.trim());
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // Get current schedule for comparison (for logging)
    const previousSchedule = restaurant.timings[service]?.schedule || {};
    const previousActive = restaurant.timings[service]?.isActive || false;

    // Initialize service schedule if it doesn't exist
    if (!restaurant.timings[service]) {
      restaurant.timings[service] = { schedule: {}, isActive: false };
    }

    // Update the service timing schedule
    restaurant.timings[service].schedule = schedule;
    restaurant.timings[service].isActive = isActive === undefined ? true : isActive;

    await restaurant.save();

    // Log changes for each updated day
    try {
      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const user = req.user?.username || 'Restaurant Manager';

      // Process each day that has changed
      for (const day of daysOfWeek) {
        const oldSlots = previousSchedule[day] || [];
        const newSlots = schedule[day] || [];

        // Check if slots have changed for this day
        const slotsChanged = JSON.stringify(oldSlots) !== JSON.stringify(newSlots);

        if (slotsChanged) {
          // Create a log entry
          const logEntry = new RestaurantLog({
            restaurantId,
            category: 'timing',
            title: `${service} Hours Updated`,
            message: `Operating hours for ${service} on ${day} have been updated`,
            status: newSlots.length > 0 ? 'active' : 'inactive',
            details: {
              day,
              service,
              slots: newSlots.map(slot => ({
                start: slot.openTime || '00:00',
                end: slot.closeTime || '00:00'
              }))
            },
            user,
            timestamp: new Date()
          });

          await logEntry.save();
        }
      }

      // Log service status change if changed
      if (previousActive !== (isActive === undefined ? true : isActive)) {
        const logEntry = new RestaurantLog({
          restaurantId,
          category: 'service',
          title: `${service} Service Status Changed`,
          message: `${service} service ${isActive ? 'activated' : 'deactivated'}`,
          status: isActive ? 'active' : 'inactive',
          details: {
            serviceName: service,
            previousState: previousActive ? 'active' : 'inactive',
            newState: isActive ? 'active' : 'inactive'
          },
          user,
          timestamp: new Date()
        });

        await logEntry.save();
      }
    } catch (logError) {
      console.error('[ERROR] Failed to log timing changes:', logError);
      // Don't let logging failure affect the API response
    }

    return res.status(200).json({
      message: 'Timings updated successfully',
      [service]: restaurant.timings[service]
    });
  } catch (error) {
    console.error('[ERROR] Server error:', error);
    return res.status(500).json({ message: 'Internal Server Error' });
  }
};