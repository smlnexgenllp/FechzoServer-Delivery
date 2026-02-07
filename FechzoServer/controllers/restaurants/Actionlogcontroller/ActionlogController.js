
const mongoose = require('mongoose');
const ActionLog = require('../../../models/restaurants/actionlogs/actionlogschema');
const OperatingHoursController = require('../Logcontroller/OperatingHoursController');
const Notification = require('../../../models/restaurants/NotificationModel');

const createActionLog = async (req, res) => {
  try {
    console.log('Received request body:', req.body);

    if (!mongoose.Types.ObjectId.isValid(req.body.restaurantId)) {
      return res.status(400).json({ error: 'Invalid restaurantId format' });
    }

    // Validate type and status against enum
    const validTypes = ['suspension', 'block', 'unblock'];
    const validStatuses = ['active', 'completed', 'pending'];
    if (!validTypes.includes(req.body.type)) {
      return res.status(400).json({ error: `Invalid action type. Must be one of: ${validTypes.join(', ')}` });
    }
    if (!validStatuses.includes(req.body.status)) {
      return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
    }

    const actionLog = new ActionLog({
      restaurantId: req.body.restaurantId,
      restaurantName: req.body.restaurantName,
      type: req.body.type,
      admin: req.body.admin,
      reason: req.body.reason,
      details: {
        duration: req.body.details?.duration || undefined,
        endDate: req.body.details?.endDate ? new Date(req.body.details.endDate) : undefined,
        blockDate: req.body.details?.blockDate ? new Date(req.body.details.blockDate) : undefined,
        permanentBlock: req.body.details?.permanentBlock !== undefined ? req.body.details.permanentBlock : undefined,
        guidelines: req.body.details?.guidelines || undefined,
        appealProcess: req.body.details?.appealProcess || undefined,
      },
      status: req.body.status,
      date: req.body.date ? new Date(req.body.date) : new Date(),
    });

    const savedLog = await actionLog.save();
    console.log('Created action log:', savedLog);

    // Create a notification for the restaurant
    let notificationType, notificationTitle, notificationMessage;

    if (req.body.type === 'suspension') {
      notificationType = 'system_suspension';
      notificationTitle = 'Account Suspended';
      notificationMessage = `Your restaurant has been suspended for ${req.body.details?.duration || 'a period of time'}. Reason: ${req.body.reason}`;
      await OperatingHoursController.startInterruption(req.body.restaurantId, 'suspension', req.body.reason);
    } else if (req.body.type === 'block') {
      notificationType = 'system_block';
      notificationTitle = 'Account Blocked';
      notificationMessage = `Your restaurant has been blocked. Reason: ${req.body.reason}`;
      await OperatingHoursController.startInterruption(req.body.restaurantId, 'block', req.body.reason);
    } else if (req.body.type === 'unblock') {
      notificationType = 'system_alert';
      notificationTitle = 'Account Reactivated';
      notificationMessage = 'Your restaurant account has been reactivated.';
      await OperatingHoursController.endInterruption(req.body.restaurantId, 'suspension');
      await OperatingHoursController.endInterruption(req.body.restaurantId, 'block');
    }

    if (notificationType) {
      const notification = new Notification({
        restaurantId: req.body.restaurantId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        details: {
          actionType: req.body.type,
          reason: req.body.reason,
          ...req.body.details
        },
        priority: 'high',
        icon: req.body.type === 'unblock' ? 'FaCheckCircle' : 'FaExclamationTriangle'
      });

      await notification.save();

      // Emit socket event for real-time notification
      const io = req.app.get('io');
      if (io) {
        io.to(req.body.restaurantId.toString()).emit('adminAction', {
          notification: {
            _id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            details: notification.details,
            priority: notification.priority,
            icon: notification.icon,
            isRead: false,
            createdAt: notification.createdAt
          }
        });
      }
    }

    res.status(201).json(savedLog);
  } catch (error) {
    console.error('Error creating action log:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

const getRestaurantActionLogs = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ error: 'Invalid restaurantId format' });
    }

    const logs = await ActionLog.find({ restaurantId }).sort({ date: -1 });
    console.log(`Fetched ${logs.length} action logs for restaurantId: ${restaurantId}`);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching action logs:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

const updateActionLogStatus = async (req, res) => {
  try {
    const { restaurantId, type } = req.body;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ error: 'Invalid restaurantId format' });
    }

    // Find active actions of specified type for the restaurant
    const result = await ActionLog.updateMany(
      {
        restaurantId: restaurantId,
        type: type,
        status: 'active'
      },
      {
        $set: { status: 'completed' }
      }
    );

    res.status(200).json({
      message: `Updated ${result.modifiedCount} action logs to completed`,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error updating action log status:', error);
    res.status(500).json({
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// Middleware to validate action log data
const validateActionLog = (req, res, next) => {
  console.log('Validating request body:', req.body); // Debug log

  const { restaurantId, type, admin, reason } = req.body;

  if (!restaurantId || !type || !admin || !reason) {
    return res.status(400).json({
      error: 'Missing required fields: restaurantId, type, admin, and reason are required',
      received: { restaurantId, type, admin, reason }
    });
  }

  // Validate type enum values
  const validTypes = ['suspension', 'block', 'unblock'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({
      error: 'Invalid action type. Must be one of: suspension, block, unblock'
    });
  }

  // Validate restaurantId format
  if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
    return res.status(400).json({
      error: 'Invalid restaurantId format'
    });
  }

  next();
};

module.exports = {
  createActionLog,
  validateActionLog,
  getRestaurantActionLogs,
  updateActionLogStatus
};
