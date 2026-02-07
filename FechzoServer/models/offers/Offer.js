// models/Offer.js
const mongoose = require('mongoose');

const OfferSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  offerType: { type: String, enum: ['promo', 'freebie', 'bogo', 'combo', 'loyalty'], required: true },
  promoCode: { 
    type: String, 
    required: function() { return this.offerType === 'promo'; },
    // Add uppercase transformation
    set: function(v) { return v ? v.toUpperCase() : v; }
  },
  discountType: { 
    type: String, 
    enum: ['percentage', 'fixed'], 
    required: function() { return ['promo', 'combo'].includes(this.offerType); } 
  },
  discountValue: { 
    type: Number, 
    required: function() { return ['promo', 'combo'].includes(this.offerType); } 
  },
  maxDiscount: { 
    type: Number, 
    required: function() { return this.offerType === 'promo' && this.discountType === 'percentage'; } 
  },
  minOrderValue: { type: Number },
  validFrom: { type: Date, required: true },
  validTo: { type: Date, required: true },
  applicableFor: { type: String, enum: ['all', 'new'], required: true },
  
  // Modify the freeItemId field to make it more forgiving
  freeItemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Food',
    required: function() { return this.offerType === 'freebie'; },
    // Convert string IDs to ObjectId
    set: function(v) { 
      if (v && typeof v === 'string' && mongoose.Types.ObjectId.isValid(v)) {
        return new mongoose.Types.ObjectId(v);
      }
      return v;
    }
  },
  bogoItemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Food',
    required: function() { return this.offerType === 'bogo'; },
    set: function(v) { 
      if (v && typeof v === 'string' && mongoose.Types.ObjectId.isValid(v)) {
        return new mongoose.Types.ObjectId(v);
      }
      return v;
    }
  },
  getFreeItemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Food',
    required: function() { return this.offerType === 'bogo'; },
    set: function(v) { 
      if (v && typeof v === 'string' && mongoose.Types.ObjectId.isValid(v)) {
        return new mongoose.Types.ObjectId(v);
      }
      return v;
    }
  },
  comboItemIds: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Food',
    required: function() { return this.offerType === 'combo'; }
  }],
  
  // Keep string versions for backward compatibility
  freeItem: { type: String },
  bogoItem: { type: String },
  getFreeItem: { type: String },
  comboItems: [{ type: String }],
  
  loyaltyMinOrders: { 
    type: Number, 
    required: function() { return this.offerType === 'loyalty'; } 
  },
  loyaltyDiscountValue: { 
    type: Number, 
    required: function() { return this.offerType === 'loyalty'; } 
  },
  loyaltyDiscountType: { 
    type: String, 
    enum: ['percentage', 'fixed'], 
    default: 'percentage',
    required: function() { return this.offerType === 'loyalty'; } 
  },
  loyaltyMaxDiscount: { 
    type: Number, 
    required: function() { return this.offerType === 'loyalty' && this.loyaltyDiscountType === 'percentage'; } 
  },
  status: { type: String, enum: ['Active', 'Scheduled', 'Inactive'], default: 'Scheduled' },
  createdBy: { type: String, enum: ['Online', 'Offline'], default: 'Online' },
}, { timestamps: true });

module.exports = mongoose.model('Offer', OfferSchema);