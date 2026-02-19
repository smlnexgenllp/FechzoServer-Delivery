// controllers/deliveryPartner/payoutController.js

const cron = require('node-cron');
const DeliveryPartner = require('../../models/deliverypartner/DeliveryPartner');
const Payout = require('../../models/deliverypartner/Payout');
const PartnerPayoutRequest = require('../../models/deliverypartner/PartnerPayoutRequest');
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



// Partner requests withdrawal
exports.requestPayout = async (req, res) => {
  try {
    const partnerId = req.partner._id;
    const { amount } = req.body;

    if (!amount || amount < 500) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is ₹500',
      });
    }

    const partner = await DeliveryPartner.findById(partnerId);
    if (!partner) return res.status(404).json({ success: false, message: 'Partner not found' });

    if (partner.pendingBalance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${partner.pendingBalance}`,
      });
    }

    const request = new PartnerPayoutRequest({
      partnerId,
      amount,
      requestedAt: new Date(),
    });

    await request.save();

    // Reduce pending balance immediately (safe, since it's pending)
    partner.pendingBalance -= amount;
    await partner.save();

    res.status(200).json({
      success: true,
      message: 'Withdrawal request submitted successfully. Admin will process it within 1–3 days.',
      requestId: request._id,
    });
  } catch (err) {
    console.error('Payout request error:', err);
    res.status(500).json({ success: false, message: 'Server error', error: err.message });
  }
};

// Partner views their payout requests/history
exports.getMyPayoutRequests = async (req, res) => {
  try {
    const partnerId = req.partner._id;

    const requests = await PartnerPayoutRequest.find({ partnerId })
      .sort({ requestedAt: -1 })
      .lean();

    const partner = await DeliveryPartner.findById(partnerId).select('pendingBalance');

    res.json({
      success: true,
      requests,
      pendingBalance: partner?.pendingBalance || 0,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
// controllers/deliveryPartner/payoutController.js

exports.linkBankAccount = async (req, res) => {
  try {
    const partnerId = req.partner._id;
    const { accountHolderName, accountNumber, ifsc, bankName } = req.body;

    // Basic validation
    if (!accountHolderName || !accountNumber || !ifsc || !bankName) {
      return res.status(400).json({ success: false, message: "All bank fields required" });
    }

    const partner = await DeliveryPartner.findById(partnerId);
    if (!partner) return res.status(404).json({ success: false, message: "Partner not found" });

    // Step 1: Create Razorpay Contact (if not already)
    let contactId = partner.bankDetails?.contactId;
    if (!contactId) {
      const contact = await razorpay.contacts.create({
        name: accountHolderName || partner.fullName,
        email: partner.email || "noemail@fechzo.com",
        contact: partner.phone,
        type: "vendor",
        reference_id: `partner_${partnerId.toString()}`,
      });
      contactId = contact.id;
    }

    // Step 2: Create Fund Account
    const fundAccount = await razorpay.fund_accounts.create({
      contact_id: contactId,
      account_type: "bank_account",
      bank_account: {
        name: accountHolderName,
        account_number: accountNumber,
        ifsc: ifsc.toUpperCase(),
      },
    });

    // Save to partner
    await DeliveryPartner.findByIdAndUpdate(partnerId, {
      $set: {
        "bankDetails": {
          bankName: bankName.trim(),
          accountNumber: accountNumber.trim(),
          ifsc: ifsc.toUpperCase(),
          accountHolderName: accountHolderName.trim(),
          contactId,
          fundAccountId: fundAccount.id,
          verified: true, // or false until Razorpay confirms
        }
      }
    });

    res.json({
      success: true,
      message: "Bank account linked successfully",
      fundAccountId: fundAccount.id,
    });
  } catch (err) {
    console.error("Bank linking failed:", err);
    res.status(500).json({
      success: false,
      message: err.message || "Failed to link bank account",
    });
  }
};