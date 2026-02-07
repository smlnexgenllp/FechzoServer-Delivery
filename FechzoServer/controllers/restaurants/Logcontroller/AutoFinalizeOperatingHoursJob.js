const cron = require('node-cron');
const { DateTime } = require('luxon');
const RestaurantOperatingHours = require('../../../models/restaurants/logs/RestaurantOperatingHours');
const OperatingHoursController = require('./OperatingHoursController');

// Runs every minute
cron.schedule('* * * * *', async () => {
    try {
        const now = new Date();

        // Find all ongoing records for today (status: 'ongoing')
        const todayStart = DateTime.now().startOf('day').toJSDate();
        const todayEnd = DateTime.now().endOf('day').toJSDate();

        const ongoingRecords = await RestaurantOperatingHours.find({
            status: 'ongoing',
            date: { $gte: todayStart, $lte: todayEnd }
        });

        for (const record of ongoingRecords) {
            // If now >= scheduledClose, finalize
            if (now >= record.scheduledClose) {
                await OperatingHoursController.finalizeOperatingDay(record.restaurantId, record.date);
                console.log(`[AutoFinalize] Finalized operating day for restaurant ${record.restaurantId} on ${record.date}`);
            }
        }
    } catch (err) {
        console.error('[AutoFinalize] Error in auto-finalize job:', err);
    }
});