const mongoose = require('mongoose');
const Notification = require('../../models/restaurants/NotificationModel');

// Get all notifications for a restaurant
exports.getNotifications = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID is required'
      });
    }
    
    const notifications = await Notification.find({ restaurantId })
      .sort({ createdAt: -1 })
      .limit(50); 
    
    res.status(200).json({
      success: true,
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message
    });
  }
};

// Mark a notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { restaurantId, notificationId } = req.params;
    
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, restaurantId },
      { isRead: true },
      { new: true }
    );
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: notification
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: error.message
    });
  }
};
// Add this function to handle admin actions like suspensions and blocks
exports.createAdminActionNotification = async (actionData) => {
  try {
    const { restaurantId, type, reason, details } = actionData;
    
    let title, message, priority, icon;
    
    if (type === 'suspension') {
      title = 'Account Suspended';
      message = `Your restaurant account has been temporarily suspended: ${reason}`;
      priority = 'high';
      icon = 'FaExclamationTriangle';
    } else if (type === 'block') {
      title = 'Account Blocked';
      message = `Your restaurant account has been blocked: ${reason}`;
      priority = 'high';
      icon = 'FaTimes';
    } else {
      title = 'Account Status Changed';
      message = `Your restaurant account status has been updated`;
      priority = 'medium';
      icon = 'FaInfoCircle';
    }
    
    // Create the notification
    const notification = new Notification({
      restaurantId,
      type: `system_${type}`,
      title,
      message,
      details: {
        reason,
        actionType: type,
        ...details
      },
      priority,
      icon
    });
    
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating admin action notification:', error);
    return null;
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    const result = await Notification.updateMany(
      { restaurantId, isRead: false },
      { isRead: true }
    );
    
    res.status(200).json({
      success: true,
      message: `Marked ${result.nModified} notifications as read`
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking all notifications as read',
      error: error.message
    });
  }
};

// Create a notification (used internally)
exports.createNotification = async (notificationData) => {
  try {
    const notification = new Notification(notificationData);
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};