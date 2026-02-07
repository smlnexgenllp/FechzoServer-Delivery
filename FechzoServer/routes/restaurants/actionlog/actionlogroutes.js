const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { createActionLog, getRestaurantActionLogs } = require('../../../controllers/restaurants/Actionlogcontroller/ActionlogController');

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

// Routes with validation (commented out to avoid conflict with restaurantRoutes.js)
// router.post('/', validateActionLog, createActionLog);
// router.get('/:restaurantId', getRestaurantActionLogs);

module.exports = router;
