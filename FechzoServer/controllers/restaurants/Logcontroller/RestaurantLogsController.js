const mongoose = require('mongoose');
const { DateTime } = require('luxon');
const RestaurantLog = require('../../../models/restaurants/logs/RestaurantLogSchema');

// Get all logs for a restaurant
exports.getRestaurantLogs = async (req, res) => {
    try {
        const { restaurantId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({ error: 'Invalid restaurant ID format' });
        }

        const logs = await RestaurantLog.find({ restaurantId })
            .sort({ timestamp: -1 })
            .limit(100);  // Limit to last 100 logs for performance

        return res.status(200).json(logs);
    } catch (error) {
        console.error('Error fetching restaurant logs:', error);
        return res.status(500).json({ error: 'Failed to retrieve restaurant logs' });
    }
};

// Create a new log entry
exports.createRestaurantLog = async (req, res) => {
    try {
        const {
            restaurantId,
            category,
            title,
            message,
            status,
            details,
            user
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({ error: 'Invalid restaurant ID format' });
        }

        // Validate required fields
        if (!category || !title || !message) {
            return res.status(400).json({
                error: 'Missing required fields: category, title, and message are required'
            });
        }

        // Create new log entry
        const newLog = new RestaurantLog({
            restaurantId,
            category,
            title,
            message,
            status: status || 'info',
            details: details || {},
            user: user || 'System',
            timestamp: new Date()
        });

        const savedLog = await newLog.save();

        // Emit real-time update if socket.io is available
        const io = req.app.get('io');
        if (io) {
            io.to(restaurantId.toString()).emit('logUpdated', savedLog);
        }

        return res.status(201).json(savedLog);
    } catch (error) {
        console.error('Error creating restaurant log:', error);
        return res.status(500).json({ error: 'Failed to create log entry' });
    }
};

// Generate timing change log
exports.logTimingChange = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { service, day, oldSlots, newSlots, user } = req.body;

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({ error: 'Invalid restaurant ID format' });
        }

        // Format slots for display
        const formatTimeSlot = (slots) => {
            return slots.map(slot => ({
                start: slot.openTime || slot.start,
                end: slot.closeTime || slot.end
            }));
        };

        // Determine if restaurant is adding, removing, or modifying slots
        let action = 'updated';
        if (!oldSlots || oldSlots.length === 0) {
            action = 'added';
        } else if (!newSlots || newSlots.length === 0) {
            action = 'removed';
        }

        // Create log entry
        const logEntry = new RestaurantLog({
            restaurantId,
            category: 'timing',
            title: `${service} Hours ${action.charAt(0).toUpperCase() + action.slice(1)}`,
            message: `${service} operating hours ${action} for ${day}`,
            status: newSlots && newSlots.length > 0 ? 'active' : 'inactive',
            details: {
                day,
                service,
                action,
                slots: formatTimeSlot(newSlots || [])
            },
            user: user || 'System',
            timestamp: new Date()
        });

        const savedLog = await logEntry.save();

        // Emit real-time update
        const io = req.app.get('io');
        if (io) {
            io.to(restaurantId.toString()).emit('logUpdated', savedLog);
        }

        return res.status(201).json(savedLog);
    } catch (error) {
        console.error('Error logging timing change:', error);
        return res.status(500).json({ error: 'Failed to log timing change' });
    }
};

// Log service status change
exports.logServiceStatusChange = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { service, previousState, newState, user } = req.body;

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({ error: 'Invalid restaurant ID format' });
        }

        // Create log entry
        const logEntry = new RestaurantLog({
            restaurantId,
            category: 'service',
            title: `${service} Service Status Changed`,
            message: `${service} service changed from ${previousState ? 'active' : 'inactive'} to ${newState ? 'active' : 'inactive'}`,
            status: newState ? 'active' : 'inactive',
            details: {
                serviceName: service,
                previousState: previousState ? 'active' : 'inactive',
                newState: newState ? 'active' : 'inactive'
            },
            user: user || 'System',
            timestamp: new Date()
        });

        const savedLog = await logEntry.save();

        // Emit real-time update
        const io = req.app.get('io');
        if (io) {
            io.to(restaurantId.toString()).emit('logUpdated', savedLog);
        }

        return res.status(201).json(savedLog);
    } catch (error) {
        console.error('Error logging service status change:', error);
        return res.status(500).json({ error: 'Failed to log service status change' });
    }
};

// Log global status change
exports.logGlobalStatusChange = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { previousStatus, newStatus, user } = req.body;

        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
            return res.status(400).json({ error: 'Invalid restaurant ID format' });
        }

        // Create log entry
        const logEntry = new RestaurantLog({
            restaurantId,
            category: 'status',
            title: `Restaurant Status Changed`,
            message: `Restaurant global status changed from ${previousStatus} to ${newStatus}`,
            status: newStatus,
            details: {
                previousStatus,
                newStatus,
                timestamp: new Date()
            },
            user: user || 'System',
            timestamp: new Date()
        });

        const savedLog = await logEntry.save();

        // Emit real-time update
        const io = req.app.get('io');
        if (io) {
            io.to(restaurantId.toString()).emit('logUpdated', savedLog);
        }

        return res.status(201).json(savedLog);
    } catch (error) {
        console.error('Error logging global status change:', error);
        return res.status(500).json({ error: 'Failed to log global status change' });
    }
};