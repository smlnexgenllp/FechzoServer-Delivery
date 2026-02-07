
const Alert = require('../../models/restaurants/AlertModels');

// Create a new alert
exports.createAlert = async (req, res) => {
  try {
    const { restaurantId, message } = req.body;

    // Validate required fields
    if (!restaurantId || !message) {
      return res.status(400).json({
        success: false,
        error: 'restaurantId and message are required',
      });
    }

    const alert = new Alert({
      restaurantId,
      message,
      createdAt: new Date(),
      read: false,
    });

    await alert.save();

    res.status(201).json({
      success: true,
      alert,
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating alert',
    });
  }
};


// Get alerts for a restaurant
exports.getAlerts = async (req, res) => {
  try {
    const { restaurantId, unread, page = 1, limit = 10 } = req.query;

    console.log('GET ALERTS API CALLED');
    console.log('Query Params:', { restaurantId, unread, page, limit });

    // Validate restaurantId
    if (!restaurantId) {
      console.warn('restaurantId is missing in query');
      return res.status(400).json({
        success: false,
        error: 'restaurantId is required',
      });
    }

    // Build query
    const query = { restaurantId };
    if (unread === 'true') {
      query.read = false;
    }

    // Convert page and limit to numbers
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;

    console.log('MongoDB Query:', query);
    console.log('Pagination -> Page:', pageNum, 'Limit:', limitNum, 'Skip:', skip);

    // Fetch alerts with pagination
    const alerts = await Alert.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const totalAlerts = await Alert.countDocuments(query);
    const totalPages = Math.ceil(totalAlerts / limitNum);

    console.log('Fetched Alerts Count:', alerts.length);
    console.log('Total Alerts:', totalAlerts, 'Total Pages:', totalPages);

    res.status(200).json({
      success: true,
      alerts,
      totalPages,
      currentPage: pageNum,
      totalAlerts,
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching alerts',
    });
  }
};

// Update alert (mark as read)
exports.updateAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const { read } = req.body;

    // Validate input
    if (read === undefined) {
      return res.status(400).json({
        success: false,
        error: 'read status is required',
      });
    }

    // Find and update alert
    const alert = await Alert.findByIdAndUpdate(
      id,
      { read },
      { new: true, runValidators: true }
    );

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    res.status(200).json({
      success: true,
      alert,
    });
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating alert',
    });
  }
};

exports.markAlertAsRead = async (req, res) => {
  try {
    const { alertId } = req.params;

    console.log('Mark Alert as Read API CALLED', { alertId });

    // Validate alertId
    if (!alertId) {
      console.warn('alertId is missing');
      return res.status(400).json({
        success: false,
        error: 'alertId is required',
      });
    }

    // Update the alert to mark as read
    const alert = await Alert.findByIdAndUpdate(
      alertId,
      { read: true },
      { new: true }
    );

    if (!alert) {
      console.warn('Alert not found for ID:', alertId);
      return res.status(404).json({
        success: false,
        error: 'Alert not found',
      });
    }

    console.log('Alert marked as read:', alertId);
    res.status(200).json({
      success: true,
      alert,
    });
  } catch (error) {
    console.error('Error marking alert as read:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while marking alert as read',
    });
  }
};