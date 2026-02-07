const cron = require('node-cron');
const { DateTime } = require('luxon');
const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');
const RestaurantOperatingHours = require('../../../models/restaurants/logs/RestaurantOperatingHours');
const OperatingHoursController = require('./OperatingHoursController');

// Runs every minute
cron.schedule('* * * * *', async () => {
    try {
        const now = DateTime.now().setZone('Asia/Kolkata');
        const dayName = now.toFormat('cccc'); // e.g., "Monday"
        const todayDate = now.startOf('day').toJSDate();

        // Find all active restaurants
        const restaurants = await Restaurant.find({ globalStatus: 'active' });

        for (const restaurant of restaurants) {
            // Gather all slots for today from all active services
            const allSlots = [];
            ['delivery', 'dineIn', 'takeaway'].forEach(service => {
                const timings = restaurant.timings[service];
                if (timings && timings.isActive && timings.schedule[dayName]) {
                    timings.schedule[dayName].forEach(slot => {
                        if (slot.openTime && slot.closeTime) {
                            allSlots.push(slot);
                        }
                    });
                }
            });

            // For each slot, check if now is within the slot
            for (const slot of allSlots) {
                const slotOpen = DateTime.fromFormat(slot.openTime, 'H:mm', { zone: 'Asia/Kolkata' }).set({
                    year: now.year, month: now.month, day: now.day
                });
                const slotClose = DateTime.fromFormat(slot.closeTime, 'H:mm', { zone: 'Asia/Kolkata' }).set({
                    year: now.year, month: now.month, day: now.day
                });

                // --- AUTO-OPEN LOGIC (already present) ---
                if (now >= slotOpen && now < slotClose) {
                    // Check if there's an ongoing open period for today
                    let record = await RestaurantOperatingHours.findOne({
                        restaurantId: restaurant._id,
                        date: { $gte: todayDate, $lte: now.endOf('day').toJSDate() }
                    });

                    // If no record or no ongoing open period, start one
                    if (!record || !record.openPeriods.some(p => !p.end)) {
                        // Use earliest open and latest close for scheduledOpen/Close
                        const scheduledOpen = DateTime.fromFormat(
                            allSlots.map(s => s.openTime).sort()[0], 'H:mm', { zone: 'Asia/Kolkata' }
                        ).set({ year: now.year, month: now.month, day: now.day }).toJSDate();
                        const scheduledClose = DateTime.fromFormat(
                            allSlots.map(s => s.closeTime).sort().reverse()[0], 'H:mm', { zone: 'Asia/Kolkata' }
                        ).set({ year: now.year, month: now.month, day: now.day }).toJSDate();

                        await OperatingHoursController.startOperatingDay(
                            restaurant._id,
                            scheduledOpen,
                            scheduledClose
                        );
                        console.log(`[AutoOpen] Started operating day for restaurant ${restaurant._id} at ${now.toFormat('HH:mm')}`);
                    }
                    break; // Only need to open once per slot
                }

                // --- AUTO-CLOSE LOGIC (add this block) ---
                // If now is at or just after slotClose, close the open period if ongoing
                if (now >= slotClose && now < slotClose.plus({ minutes: 1 })) {
                    let record = await RestaurantOperatingHours.findOne({
                        restaurantId: restaurant._id,
                        date: { $gte: todayDate, $lte: now.endOf('day').toJSDate() }
                    });

                    if (record && record.openPeriods.length > 0 && !record.openPeriods[record.openPeriods.length - 1].end) {
                        record.openPeriods[record.openPeriods.length - 1].end = slotClose.toJSDate();
                        await record.save();
                        console.log(`[AutoClose] Closed open period for restaurant ${restaurant._id} at ${slotClose.toFormat('HH:mm')}`);
                    }
                }
            }
        }
    } catch (err) {
        console.error('[AutoOpen] Error in auto-open job:', err);
    }
});