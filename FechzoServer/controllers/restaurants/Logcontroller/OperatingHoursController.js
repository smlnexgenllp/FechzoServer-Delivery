const RestaurantOperatingHours = require('../../../models/restaurants/logs/RestaurantOperatingHours');
const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');
const ActionLog = require('../../../models/restaurants/actionlogs/actionlogschema');
const { DateTime } = require('luxon');

// Helper: get start/end of day in UTC
function getDayRange(date) {
    const start = DateTime.fromJSDate(date).startOf('day').toJSDate();
    const end = DateTime.fromJSDate(date).endOf('day').toJSDate();
    return { start, end };
}

// Helper: calculate total open minutes
function calcTotalOpenMinutes(openPeriods, now = new Date()) {
    let total = 0;
    openPeriods.forEach(period => {
        const end = period.end ? new Date(period.end) : now;
        total += Math.max(0, (end - new Date(period.start)) / 60000);
    });
    return Math.round(total);
}

// Called when restaurant opens for the first time today
exports.startOperatingDay = async (restaurantId, scheduledOpen, scheduledClose) => {
    const today = new Date();
    const { start, end } = getDayRange(today);

    let record = await RestaurantOperatingHours.findOne({
        restaurantId,
        date: { $gte: start, $lte: end }
    });

    // If already completed, do not re-open
    if (record && record.status === 'completed') {
        return record;
    }

    if (!record) {
        record = new RestaurantOperatingHours({
            restaurantId,
            date: start,
            scheduledOpen,
            scheduledClose,
            openPeriods: [{ start: new Date() }],
            interruptions: [],
            status: 'ongoing'
        });
        await record.save();
    }
    return record;
};

// Called when a service interruption starts (manual inactive, suspension, block)
exports.startInterruption = async (restaurantId, type, reason) => {
    const today = new Date();
    const { start, end } = getDayRange(today);

    let record = await RestaurantOperatingHours.findOne({
        restaurantId,
        date: { $gte: start, $lte: end }
    });

    if (!record) return;

    // Close current open period
    if (record.openPeriods.length > 0 && !record.openPeriods[record.openPeriods.length - 1].end) {
        record.openPeriods[record.openPeriods.length - 1].end = new Date();
    }

    // Start interruption
    record.interruptions.push({
        type,
        reason,
        start: new Date(),
        end: null
    });

    await record.save();
};

// Called when a service resumes (manual active, unsuspend, unblock)
exports.endInterruption = async (restaurantId, type) => {
    const today = new Date();
    const { start, end } = getDayRange(today);

    let record = await RestaurantOperatingHours.findOne({
        restaurantId,
        date: { $gte: start, $lte: end }
    });

    if (!record) return;

    // Do not add open period if already completed
    if (record.status === 'completed') return;

    // End the latest interruption of this type
    for (let i = record.interruptions.length - 1; i >= 0; i--) {
        if (record.interruptions[i].type === type && !record.interruptions[i].end) {
            record.interruptions[i].end = new Date();
            break;
        }
    }

    // Only start a new open period if there is no ongoing one
    const hasOngoingOpenPeriod = record.openPeriods.some(p => !p.end);
    if (!hasOngoingOpenPeriod) {
        record.openPeriods.push({ start: new Date(), end: null });
    }

    await record.save();
};

// Called at end of day or on demand to finalize
exports.finalizeOperatingDay = async (restaurantId, date = new Date()) => {
    const { start, end } = getDayRange(date);

    let record = await RestaurantOperatingHours.findOne({
        restaurantId,
        date: { $gte: start, $lte: end }
    });

    if (!record) return;

    // Close any open period
    if (record.openPeriods.length > 0 && !record.openPeriods[record.openPeriods.length - 1].end) {
        record.openPeriods[record.openPeriods.length - 1].end = new Date();
    }

    // End any ongoing interruption
    for (let i = 0; i < record.interruptions.length; i++) {
        if (!record.interruptions[i].end) {
            record.interruptions[i].end = new Date();
        }
    }

    record.totalOpenMinutes = calcTotalOpenMinutes(record.openPeriods, new Date());
    record.status = 'completed';
    await record.save();
};

// API: Get operating hours for a date range
exports.getOperatingHours = async (req, res) => {
    try {
        const { restaurantId } = req.params;
        const { from, to } = req.query;
        const fromDate = from ? new Date(from) : DateTime.now().minus({ days: 7 }).toJSDate();
        const toDate = to ? new Date(to) : new Date();

        const records = await RestaurantOperatingHours.find({
            restaurantId,
            date: { $gte: fromDate, $lte: toDate }
        }).sort({ date: -1 });

        res.json(records);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};