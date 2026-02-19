// controllers/deliveryPartner/payoutController.js

const cron = require('node-cron');
const DeliveryPartner = require('../../models/deliverypartner/DeliveryPartner');
const Payout = require('../../models/deliverypartner/Payout');
const razorpay = require('razorpay'); // your instance

// Run every Monday at 00:30 IST
cron.schedule('30 0 * * 1', async () => {
  console.log('Starting weekly payout batch...');

  const startOfLastWeek = new Date();
  startOfLastWeek.setDate(startOfLastWeek.getDate() - 7);
  startOfLastWeek.setHours(0, 0, 0, 0);

  const partners = await DeliveryPartner.find({ isActive: true });

  for (const partner of partners) {
    try {
      const earnings = await exports.calculateWeeklyEarnings(partner._id, startOfLastWeek);

      if (earnings.netPayable < 500) {
        // Carry forward
        partner.pendingBalance += earnings.netPayable;
        await partner.save();
        continue;
      }

      // Add pending balance if any
      const finalAmount = earnings.netPayable + (partner.pendingBalance || 0);

      // Create payout record
      const payout = new Payout({
        partnerId: partner._id,
        amount: finalAmount,
        periodStart: startOfLastWeek,
        periodEnd: new Date(),
        status: 'processing',
      });
      await payout.save();

      // Razorpay payout (real transfer)
      const razorpayPayout = await razorpay.payouts.create({
        account_number: process.env.RAZORPAY_ACCOUNT_NUMBER, // your business account
        fund_account_id: partner.fundAccountId, // saved during onboarding
        amount: finalAmount * 100, // in paise
        currency: "INR",
        mode: "IMPS", // or NEFT/RTGS
        purpose: "payout",
        queue_if_low_balance: true,
        reference_id: payout._id.toString(),
        narration: `Weekly payout for ${partner.fullName}`,
      });

      payout.razorpayPayoutId = razorpayPayout.id;
      payout.status = 'completed';
      payout.processedAt = new Date();
      await payout.save();

      // Reset pending balance
      partner.pendingBalance = 0;
      partner.lastPayoutDate = new Date();
      await partner.save();

      console.log(`Payout ₹${finalAmount} processed for ${partner.fullName}`);

    } catch (err) {
      console.error(`Payout failed for partner ${partner._id}:`, err);
      // Optionally mark failed and notify admin
    }
  }

  console.log('Weekly payout batch completed.');
});
// GET /api/delivery-partner/payouts
exports.getPayoutHistory = async (req, res) => {
  try {
    const partnerId = req.partner._id;
    const payouts = await Payout.find({ partnerId })
      .sort({ processedAt: -1 })
      .lean();

    res.json({
      success: true,
      payouts,
      pendingBalance: (await DeliveryPartner.findById(partnerId)).pendingBalance || 0,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};