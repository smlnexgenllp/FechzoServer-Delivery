const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  restaurantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  title: { type: String, required: true },
  description: { type: String, required: true },
  itemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Food',
    required: true
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  budget: { type: Number, required: true, min: 2000 },
  isPopupAd: { type: Boolean, default: false },
  popupBudget: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'active', 'rejected', 'completed', 'paused'],
    default: 'pending'
  },
  image: { type: String },
  pendingApproval: [{
    id: { type: String },
    url: { type: String },
    name: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],
  rejectionReason: { type: String },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  spent: { type: Number, default: 0 },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  validationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  validationNotes: { type: String },
  validatedAt: { type: Date },
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentId: { type: String },
  orderId: { type: String },
  refundStatus: {
    type: String,
    enum: ['none', 'pending', 'completed', 'failed'],
    default: 'none'
  },
  refundAmount: { type: Number, default: 0 },
  refundReason: { type: String },
  // Add a field to track session IDs if not already present
  trackedSessions: [{ type: String }],
  
  image: { type: String },
  pendingApproval: [{
    id: { type: String },
    url: { type: String },
    name: { type: String },
    uploadedAt: { type: Date, default: Date.now }
  }],
  rejectionReason: { type: String },
  impressions: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  spent: { type: Number, default: 0 },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  approvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  validationStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  validationNotes: { type: String },
  validatedAt: { type: Date },
  validatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  discountPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentId: { type: String },
  orderId: { type: String },
  refundStatus: {
    type: String,
    enum: ['none', 'pending', 'completed', 'failed'],
    default: 'none'
  },
  refundAmount: { type: Number, default: 0 },
  refundReason: { type: String },
});

module.exports = mongoose.model('Ad', adSchema);