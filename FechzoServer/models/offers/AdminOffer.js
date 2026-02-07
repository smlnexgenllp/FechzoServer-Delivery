const mongoose = require('mongoose');

const AdminOfferSchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true }, // 'new', 'all', etc.
  
  // Add separate discount fields while keeping original for compatibility
  discountType: { type: String, enum: ['percentage', 'fixed'] },
  discountValue: { type: Number },
  discount: { type: String, required: true }, // Keep for backward compatibility
  
  // Existing fields
  minOrderValue: { type: Number },
  maxDiscountCap: { type: Number },
  usageLimit: { type: Number },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  restaurants: [{ type: mongoose.Schema.Types.Mixed }],
  promoCode: { type: String, required: true, unique: true },
  description: { type: String },
  status: { 
    type: String, 
    enum: ['Active', 'Scheduled', 'Inactive'], 
    default: 'Scheduled' 
  },
  
  // Add specialized fields for offer types
  offerType: { type: String, enum: ['promo', 'freebie', 'bogo', 'combo', 'loyalty'], default: 'promo' },
  freeItem: { type: String }, // For freebie type
  bogoItem: { type: String }, // For BOGO type
  getFreeItem: { type: String }, // For BOGO type
  comboItems: [{ type: String }], // For combo type
  loyaltyMinOrders: { type: Number }, // For loyalty type
  loyaltyDiscountValue: { type: Number }, // For loyalty type
  
  redemptions: { type: Number, default: 0 },
  totalDiscount: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('AdminOffer', AdminOfferSchema);