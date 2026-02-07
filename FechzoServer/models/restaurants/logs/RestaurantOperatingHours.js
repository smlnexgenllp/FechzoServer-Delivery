const mongoose = require('mongoose');

const interruptionSchema = new mongoose.Schema({
    type: { type: String, enum: ['manual_inactive', 'suspension', 'block'], required: true },
    reason: String,
    start: { type: Date, required: true },
    end: { type: Date }, // null if ongoing
}, { _id: false });

const openPeriodSchema = new mongoose.Schema({
    start: { type: Date, required: true },
    end: { type: Date }, // null if ongoing
}, { _id: false });

const restaurantOperatingHoursSchema = new mongoose.Schema({
    restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true, index: true },
    date: { type: Date, required: true, index: true }, // Store as day (e.g., 2024-06-01)
    scheduledOpen: { type: Date, required: true },
    scheduledClose: { type: Date, required: true },
    openPeriods: [openPeriodSchema], // Array of actual open periods
    interruptions: [interruptionSchema], // Array of interruptions
    totalOpenMinutes: { type: Number, default: 0 }, // Calculated
    status: { type: String, enum: ['ongoing', 'completed'], default: 'ongoing' },
}, { timestamps: true });

module.exports = mongoose.model('RestaurantOperatingHours', restaurantOperatingHoursSchema);