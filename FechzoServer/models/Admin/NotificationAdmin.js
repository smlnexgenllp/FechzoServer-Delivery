const mongoose = require('mongoose');

const adminNotificationSchema = new mongoose.Schema({
  restaurantId: { type: String, required: true },
  restaurantName: { type: String, required: true },
  category: { 
    type: String, 
    required: true, 
    enum: [
      'Registration', 
      'Menu Management', 
      'Payments', 
      'Orders & Delivery', 
      'Ads & Campaigns', 
      'Compliance & Audits'
    ] 
  },
  action: { type: String, required: true },
  message: { type: String, required: true },
  details: { type: String, required: true },
  date: { type: Date, default: Date.now },
  isRead: {
    type: Boolean,
    default: false
  },
}, { timestamps: true });

module.exports = mongoose.models.AdminNotification || mongoose.model('AdminNotification', adminNotificationSchema, 'admin_notifications');