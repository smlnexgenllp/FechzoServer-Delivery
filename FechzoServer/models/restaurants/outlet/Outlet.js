// /models/outlet/Outlet.js
const mongoose = require('mongoose');

const OutletSchema = new mongoose.Schema({
  outlet_id: { type: String, required: true, unique: true }, // Matches your existing schema
  name: { type: String, required: true }, // Maps to outletName in frontend
  description: { type: String },
  location: {
    address: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
  },
  contact: { type: String },
  status: { type: String, default: 'active' },
  // Additional fields for frontend compatibility
  outletType: { type: String, default: 'Bakery & Cafe' },
  outletLocation: { type: String }, // Separate from location object for frontend
  specialties: { type: [String], default: [] },
  restaurantId: { type: String, unique: true },
  activeSince: { type: String },
  mapLink: { type: String },
  aboutUs: { type: String },
  ourStory: {
    title: { type: String },
    description: { type: String }
  },
  outletImage: { type: String },
  outletImageApprovalStatus: { type: String, default: 'approved' }, // pending, approved, rejected
  requestedTitle: { type: String },
  outletNameApprovalStatus: { type: String, default: 'approved' }, // pending, approved, rejected
}, { timestamps: true });

module.exports = mongoose.model('Outlets', OutletSchema);