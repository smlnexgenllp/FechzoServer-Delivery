const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'order_placed',
      'order_preparing',
      'order_ready',
      'order_pickedUp',
      'order_delivered',
      'order_arrivingSoon',
      'order_cancelled',
      'payment_completed',
      'payment_failed',
      'system_alert',
      'system_suspension',
      'system_block',
      'promotion_alert'
    ]
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  icon: {
    type: String,
    default: 'FaBell'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries
notificationSchema.index({ restaurantId: 1, createdAt: -1 });
notificationSchema.index({ restaurantId: 1, isRead: 1 });

module.exports = mongoose.model('Notification', notificationSchema);