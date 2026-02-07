const mongoose = require('mongoose');

const restaurantLogSchema = new mongoose.Schema({
    restaurantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Restaurant',
        required: true,
        index: true
    },
    category: {
        type: String,
        enum: ['timing', 'service', 'status', 'other'],
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'open', 'closed', 'info'],
        default: 'info'
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    user: {
        type: String,
        default: 'System'
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Create indexes for efficient querying
restaurantLogSchema.index({ timestamp: -1 });
restaurantLogSchema.index({ category: 1, timestamp: -1 });
restaurantLogSchema.index({ restaurantId: 1, category: 1, timestamp: -1 });

module.exports = mongoose.model('RestaurantLog', restaurantLogSchema);