const mongoose = require('mongoose');

const deliveryPartnerSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: {
    type: String,
    unique: true,
    sparse: true,
  },
  fullName: {
    type: String,
    trim: true
  },
  profilePhoto: String,
  vehicleType: {
    type: String,
    enum: ['bike', 'scooter', 'cycle', 'car', 'van', 'other']
  },
  vehicleNumber: {
    type: String,
    uppercase: true,
    trim: true
  },
  drivingLicense: String,
  aadhaarNumber: String,
  panNumber: String,
  bankAccount: {
    accountNumber: String,
    ifscCode: String,
    accountHolder: String
  },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  documentsSubmitted: { type: Boolean, default: false },
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  createdAt: { type: Date, default: Date.now },
  lastLogin: Date
});

deliveryPartnerSchema.index({ email: 1 });
deliveryPartnerSchema.index({ phone: 1 });

// Safe model definition
const DeliveryPartner = mongoose.models.DeliveryPartner
  ? mongoose.model('DeliveryPartner')
  : mongoose.model('DeliveryPartner', deliveryPartnerSchema);

module.exports = DeliveryPartner;