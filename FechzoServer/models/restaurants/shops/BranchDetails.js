const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const branchSchema = new Schema({
  branchId: {
    type: String,
    required: true,
    unique: true
  },
  restaurantId: {
    type: String,
    required: true,
    ref: 'Restaurant'
  },
  brandName: {
    type: String,
    required: true
  },
  branchName: { 
    type: String, 
    required: true 
  },
  restaurantAddress: {
    shopNumber: { type: String, required: true },
    floor: { type: String, required: false },
    area: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    landmark: { type: String, required: false }
  },
  images: {
    restaurant: { type: String, required: false },
    food: { type: [String], required: false },
    menu: { type: [String], required: false },
    profile: { type: String, required: false }
  },
  timings: {
    delivery: {
      openTime: { type: String, required: true },
      closeTime: { type: String, required: true },
      days: { type: [String], required: true }
    },
    dineIn: {
      openTime: { type: String, required: true },
      closeTime: { type: String, required: true },
      days: { type: [String], required: true }
    }
  },
  legalDetails: {
    fssaiNumber: { type: String, required: true, match: [/^\d{14}$/, 'Invalid FSSAI number'] },
    fssaiExpiryDate: { type: String, required: true },
    uploadFssaiLicense: { type: String, required: false },
    gstNumber: { type: String, required: false, match: [/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{1}\d{1}$/, 'Invalid GST number'] }
  },
  managerDetails: {
    managerName: { type: String, required: true },
    managerEmail: { type: String, required: true, match: [/^\S+@\S+\.\S+$/, 'Invalid email format'] },
    managerPhone: { type: String, required: true, match: [/^\d{10}$/, 'Invalid phone number'] },
    managerAltPhone: { type: String, required: false, match: [/^\d{10}$/, 'Invalid phone number'] }
  },
  approvalStatus: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending"
  },
  rejectionReason: {
    type: String,
    required: function () {
      return this.approvalStatus === "Rejected";
    }
  }
}, { timestamps: true });

module.exports = mongoose.model('Branch', branchSchema, 'branches');