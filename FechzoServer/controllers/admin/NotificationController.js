const AdminNotification = require("../../models/Admin/NotificationAdmin");
const mongoose = require("mongoose");

// Create a new notification
const createNotification = async (notificationData) => {
  try {
    const notification = new AdminNotification({
      restaurantId: notificationData.restaurantId,
      restaurantName: notificationData.restaurantName,
      category: notificationData.category,
      action: notificationData.action,
      message: notificationData.message,
      details: notificationData.details,
      isRead: false, // Ensure new notifications are unread
    });

    await notification.save();
    console.log(`✅ [SUCCESS] Admin Notification created: ${notification._id}`);
    return notification;
  } catch (error) {
    console.error(
      "❌ [ERROR] Failed to create admin notification:",
      error.message
    );
    throw new Error(`Failed to create admin notification: ${error.message}`);
  }
};

// Get all notifications with filters
const getNotifications = async (req, res) => {
  try {
    console.log("Received notification request with query:", req.query);

    const {
      searchTerm,
      category,
      dateRange,
      startDate,
      endDate,
      sortField = "date",
      sortDirection = "desc",
      page = 1,
      limit = 10,
    } = req.query;

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));

    let query = {};

    // Updated search filter with proper ObjectId handling
    if (searchTerm) {
      query.$or = [
        { restaurantName: { $regex: searchTerm, $options: "i" } },
        { message: { $regex: searchTerm, $options: "i" } },
      ];

      if (mongoose.Types.ObjectId.isValid(searchTerm)) {
        query.$or.push({ _id: new mongoose.Types.ObjectId(searchTerm) });
      }
    }

    // Category filter
    if (category) {
      query.category = { $in: category.split(",") };
    }

    // Date filter
    if (dateRange === "custom") {
      if (!startDate || !endDate) {
        return res.status(400).json({
          error: "Start date and end date are required for custom date range",
        });
      }

      const parsedStartDate = new Date(startDate);
      const parsedEndDate = new Date(endDate);

      if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      query.date = { $gte: parsedStartDate, $lte: parsedEndDate };
    } else {
      const today = new Date();
      const ranges = {
        today: new Date(today.setHours(0, 0, 0, 0)),
        yesterday: new Date(today.setDate(today.getDate() - 1)),
        thisWeek: new Date(today.setDate(today.getDate() - 7)),
        thisMonth: new Date(
          today.setFullYear(today.getFullYear(), today.getMonth(), 1)
        ),
      };
      if (ranges[dateRange]) {
        query.date = { $gte: ranges[dateRange] };
      }
    }

    // Sorting
    const sortOptions = {};
    sortOptions[sortField] = sortDirection === "asc" ? 1 : -1;

    const notifications = await AdminNotification.find(query)
      .sort(sortOptions)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);

    const total = await AdminNotification.countDocuments(query);

    console.log(
      `[API] Sending notifications: count=${notifications.length}, total=${total}`
    );
    res.json({ notifications, total });
  } catch (error) {
    console.error("❌ [ERROR] Failed to fetch admin notifications:", error);
    res.status(500).json({
      error: "Failed to fetch admin notifications",
      details: error.message,
    });
  }
};

// Get unread notifications count
const getUnreadNotificationsCount = async (req, res) => {
  try {
    const { category } = req.query;

    let query = {
      isRead: false, // Only get unread notifications
    };

    // Add category filter if specified
    if (category) {
      query.category = category;
    }

    const count = await AdminNotification.countDocuments(query);

    console.log(
      `[API] Unread notifications count: ${count}, category: ${
        category || "all"
      }`
    );

    res.json({ count });
  } catch (error) {
    console.error("❌ [ERROR] Failed to fetch unread count:", error.message);
    res.status(500).json({
      error: "Failed to fetch unread notifications count",
      details: error.message,
    });
  }
};

// Update notification
const updateNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const { isRead } = req.body; // Change from 'unread' to 'isRead'

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    const updateData = {};
    if (typeof isRead === "boolean") updateData.isRead = isRead; // Update this line

    const notification = await AdminNotification.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Admin notification not found" });
    }

    res.json(notification);
  } catch (error) {
    console.error(
      "❌ [ERROR] Failed to update admin notification:",
      error.message
    );
    res.status(500).json({
      error: "Failed to update admin notification",
      details: error.message,
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid notification ID" });
    }

    const notification = await AdminNotification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({ error: "Admin notification not found" });
    }

    res.json({ message: "Admin notification deleted successfully" });
  } catch (error) {
    console.error(
      "❌ [ERROR] Failed to delete admin notification:",
      error.message
    );
    res.status(500).json({
      error: "Failed to delete admin notification",
      details: error.message,
    });
  }
};

// Update getNotificationCounts to match getNotifications query structure
const getNotificationCounts = async (req, res) => {
  try {
    const { searchTerm, category, dateRange, startDate, endDate } = req.query;

    let query = {};

    // Use same search logic as getNotifications
    if (searchTerm) {
      query.$or = [
        { restaurantName: { $regex: searchTerm, $options: "i" } },
        { message: { $regex: searchTerm, $options: "i" } },
      ];

      if (mongoose.Types.ObjectId.isValid(searchTerm)) {
        query.$or.push({ _id: new mongoose.Types.ObjectId(searchTerm) });
      }
    }

    // Apply same date logic as getNotifications
    if (dateRange === "custom" && startDate && endDate) {
      const parsedStartDate = new Date(startDate);
      const parsedEndDate = new Date(endDate);

      if (isNaN(parsedStartDate.getTime()) || isNaN(parsedEndDate.getTime())) {
        return res.status(400).json({ error: "Invalid date format" });
      }

      query.date = { $gte: parsedStartDate, $lte: parsedEndDate };
    }

    // Get all counts in one operation
    const counts = await AdminNotification.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          unread: {
            $sum: {
              $cond: [{ $eq: ["$isRead", false] }, 1, 0],
            },
          },
          read: {
            $sum: {
              $cond: [{ $eq: ["$isRead", true] }, 1, 0],
            },
          },
        },
      },
    ]);

    res.json(counts[0] || { total: 0, unread: 0, read: 0 });
  } catch (error) {
    console.error("❌ [ERROR] Failed to fetch notification counts:", error);
    res.status(500).json({
      error: "Failed to fetch notification counts",
      details: error.message,
    });
  }
};

module.exports = {
  createNotification,
  getNotifications,
  updateNotification,
  deleteNotification,
  getUnreadNotificationsCount, // Add this new export
  getNotificationCounts, // Add this new export
};
