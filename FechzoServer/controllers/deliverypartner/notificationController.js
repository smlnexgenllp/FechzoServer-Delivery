const Notification = require("../../models/deliverypartner/Notification");
// Get notifications
exports.getNotifications = async (req, res) => {
  console.log("Notification API called");
  console.log("Partner:", req.partner);

  try {
    const notifications = await Notification.find({
      userId: req.partner._id,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      notifications,
    });
  } catch (err) {
    console.error("Get Notifications Error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// Unread Count
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.partner._id,
      isRead: false,
    });

    res.json({
      success: true,
      count,
    });
  } catch (err) {
    console.error("Unread Count Error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// Mark Read
exports.markAsRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.partner._id,
      },
      {
        isRead: true,
      }
    );

    res.json({
      success: true,
      message: "Marked as read",
    });
  } catch (err) {
    console.error("Mark Read Error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// Mark All Read
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        userId: req.partner._id,
        isRead: false,
      },
      {
        isRead: true,
      }
    );

    res.json({
      success: true,
    });
  } catch (err) {
    console.error("Mark All Read Error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// Delete Notification
exports.deleteNotification = async (req, res) => {
  try {
    await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.partner._id,
    });

    res.json({
      success: true,
      message: "Deleted",
    });
  } catch (err) {
    console.error("Delete Notification Error:", err);

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};

// Create Notification
exports.createNotifications = async ({
  io,
  userId,
  userType,
  userModel,
  title,
  message,
  type = "general",
  orderId = null,
  data = {},
}) => {
  try {
    const notification = await Notification.create({
      userId,
      userType,
      userModel,
      title,
      message,
      type,
      orderId,
      data,
    });

    if (io) {
      io.to(`partner_${userId}`).emit(
        "newNotification",
        notification
      );
    }

    return notification;
  } catch (err) {
    console.error("Create Notification Error:", err);
    throw err;
  }
};