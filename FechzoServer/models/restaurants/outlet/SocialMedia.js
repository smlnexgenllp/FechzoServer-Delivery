const mongoose = require('mongoose');

const SocialMediaSchema = new mongoose.Schema({
  restaurantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Restaurant',
    required: true 
  },
  platforms: [{
    platform: { 
      type: String, 
      required: true,
      enum: ['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'YouTube']
    },
    link: { 
      type: String, 
      required: true 
    }
  }],
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

module.exports = mongoose.model('SocialMedia', SocialMediaSchema);