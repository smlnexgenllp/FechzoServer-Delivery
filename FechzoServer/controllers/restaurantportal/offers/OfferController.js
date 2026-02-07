const Offer = require('../../../models/offers/Offer'); // Adjust the path as necessary
const { scheduleOfferStatusUpdate, cancelOfferStatusJobs } = require('../../../queues/offerStatusQueue');
const Order = require('../../../models/order/order'); // Adjust the path as necessary
const moment = require('moment');

exports.getOffersByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.query;
    const offers = await Offer.find({ restaurantId });
    
    // Add analytics to each offer
    const offersWithAnalytics = await Promise.all(
      offers.map(async (offer) => {
        const analytics = await getCampaignAnalyticsData(offer._id);
        return {
          ...offer.toObject(),
          analytics
        };
      })
    );
    
    res.status(200).json(offersWithAnalytics);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch offers', error: error.message });
  }
};

// Add a new endpoint to fetch food items for a restaurant
exports.getFoodItemsByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.query;
    const foodItems = await require('../../../models/restaurants/FoodItemDetails')
      .find({ restaurant_id: restaurantId, available_status: true })
      .select('_id name price food_type image');
    
    res.status(200).json(foodItems);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch food items', error: error.message });
  }
};

exports.createOffer = async (req, res) => {
  try {
    const { validFrom, validTo, ...offerData } = req.body;
    const now = new Date();

    console.log("Received offer data:", req.body);

    // Determine the status based on validFrom and validTo
    let status;
    if (new Date(validFrom) <= now && new Date(validTo) >= now) {
      status = 'Active';
    } else if (new Date(validFrom) > now) {
      status = 'Scheduled';
    } else if (new Date(validTo) < now) {
      status = 'Inactive';
    }

    // Ensure proper structure for special fields
    if (offerData.freeItemId && typeof offerData.freeItemId !== 'string') {
      console.log("Converting freeItemId to string");
      offerData.freeItemId = String(offerData.freeItemId);
    }
    
    if (offerData.bogoItemId && typeof offerData.bogoItemId !== 'string') {
      console.log("Converting bogoItemId to string");
      offerData.bogoItemId = String(offerData.bogoItemId);
    }
    
    if (offerData.getFreeItemId && typeof offerData.getFreeItemId !== 'string') {
      console.log("Converting getFreeItemId to string");
      offerData.getFreeItemId = String(offerData.getFreeItemId);
    }
    
    if (offerData.comboItemIds && Array.isArray(offerData.comboItemIds)) {
      console.log("Processing comboItemIds array");
      offerData.comboItemIds = offerData.comboItemIds.map(id => 
        typeof id !== 'string' ? String(id) : id);
    }

    // Create offer with updated data
    const offer = new Offer({
      ...offerData,
      validFrom,
      validTo,
      status,
    });

    await offer.save();
    
    // Emit WebSocket event for immediate status (e.g., if status is Active or Inactive right away)
    const io = req.app.get('io');
    if (io) {
      io.to(offer.restaurantId.toString()).emit('offerStatusUpdate', {
        offerId: offer._id,
        status: offer.status,
      });
      console.log(`Emitted offerStatusUpdate for offer ${offer._id} to restaurant ${offer.restaurantId} (create)`);
    } else {
      console.error('Socket.io instance not found in createOffer');
    }

    // Schedule status updates
    try {
  if (status === 'Scheduled') {
    await scheduleOfferStatusUpdate(offer._id, 'Active', validFrom);
  }

  if (new Date(validTo) > now) {
    await scheduleOfferStatusUpdate(offer._id, 'Inactive', validTo);
  }
} catch (err) {
  console.error('⚠️ Offer scheduling failed:', err.message);
  // DO NOT throw error
}


    res.status(201).json(offer);
  } catch (error) {
    console.error('Failed to create offer:', error);
    res.status(500).json({ 
      message: 'Failed to create offer', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

exports.updateOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { validFrom, validTo, ...updateData } = req.body;
    const now = new Date();

    // Determine the status based on validFrom and validTo
    let status;
    if (new Date(validFrom) <= now && new Date(validTo) >= now) {
      status = 'Active';
    } else if (new Date(validFrom) > now) {
      status = 'Scheduled';
    } else if (new Date(validTo) < now) {
      status = 'Inactive';
    }

    // Cancel existing jobs for this offer
    await cancelOfferStatusJobs(offerId);

    const offer = await Offer.findByIdAndUpdate(
      offerId,
      { ...updateData, validFrom, validTo, status },
      { new: true }
    );

    if (!offer) return res.status(404).json({ message: 'Offer not found' });

    // Emit WebSocket event for immediate status
    const io = req.app.get('io');
    if (io) {
      io.to(offer.restaurantId.toString()).emit('offerStatusUpdate', {
        offerId: offer._id,
        status: offer.status,
      });
      console.log(`Emitted offerStatusUpdate for offer ${offer._id} to restaurant ${offer.restaurantId} (update)`);
    } else {
      console.error('Socket.io instance not found in updateOffer');
    }

    // Schedule new status updates
    if (status === 'Scheduled') {
      await scheduleOfferStatusUpdate(offer._id, 'Active', validFrom);
    }
    if (new Date(validTo) > now) {
      await scheduleOfferStatusUpdate(offer._id, 'Inactive', validTo);
    }

    res.status(200).json(offer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update offer', error: error.message });
  }
};

exports.toggleOfferStatus = async (req, res) => {
  try {
    const { offerId } = req.params;
    const { status } = req.body;
    const offer = await Offer.findById(offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    offer.status = status;
    await offer.save();

    // Emit WebSocket event for manual status change
    const io = req.app.get('io');
    if (io) {
      io.to(offer.restaurantId.toString()).emit('offerStatusUpdate', {
        offerId: offer._id,
        status: offer.status,
      });
      console.log(`Emitted offerStatusUpdate for offer ${offer._id} to restaurant ${offer.restaurantId} (toggle)`);
    } else {
      console.error('Socket.io instance not found in toggleOfferStatus');
    }

    res.status(200).json(offer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to toggle offer status', error: error.message });
  }
};

exports.deleteOffer = async (req, res) => {
  try {
    const { offerId } = req.params;
    const offer = await Offer.findByIdAndDelete(offerId);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });

    // Optionally emit an event for deletion (if the frontend needs to handle deletions in real-time)
    const io = req.app.get('io');
    if (io) {
      io.to(offer.restaurantId.toString()).emit('offerDeleted', {
        offerId: offer._id,
      });
      console.log(`Emitted offerDeleted for offer ${offer._id} to restaurant ${offer.restaurantId}`);
    }

    res.status(200).json({ message: 'Offer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete offer', error: error.message });
  }
};

// Add this new function to OfferController.js

exports.getCampaignAnalytics = async (req, res) => {
  try {
    const { campaignId } = req.params;
    const { timeFilter = 'all' } = req.query;

    // Find the offer/campaign
    const offer = await Offer.findById(campaignId);
    if (!offer) {
      return res.status(404).json({ message: 'Campaign not found' });
    }

    // Calculate date range for analytics
    let dateFilter = {};
    if (timeFilter !== 'all') {
      const { currentPeriod } = calculateDateRanges(timeFilter);
      dateFilter = { createdAt: { $gte: currentPeriod.start, $lte: currentPeriod.end } };
    }

    // Find payments that used this offer (using payment.appliedOffers)
    const Payment = require('../../../models/order/payment');
    const paymentsWithOffer = await Payment.find({
      ...dateFilter,
      $or: [
        { 'appliedOffers.offerId': campaignId },
        { 'appliedOffers.promoCode': offer.promoCode }
      ]
    });

    // Get corresponding orders
    const orderIds = paymentsWithOffer.map(payment => payment.orderId);
    const orders = await Order.find({
      orderId: { $in: orderIds },
      restaurantId: offer.restaurantId
    });

    // Calculate campaign metrics
    const analytics = calculateCampaignMetrics(orders, paymentsWithOffer, offer);

    res.status(200).json(analytics);
  } catch (error) {
    console.error('Error fetching campaign analytics:', error);
    res.status(500).json({ message: 'Failed to fetch campaign analytics', error: error.message });
  }
};

// Updated helper function to calculate campaign metrics based on offer type
const calculateCampaignMetrics = (orders, payments, offer) => {
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter(order => order.orderStatus === 'delivered');
  
  // Calculate gross sales from delivered orders
  const grossSales = deliveredOrders.reduce((sum, order) => sum + order.total, 0);
  
  // Base metrics for all offer types
  const baseMetrics = {
    grossSales: `₹${grossSales.toFixed(0)}`,
    ordersDelivered: deliveredOrders.length,
    totalOrders,
    conversionRate: totalOrders > 0 ? ((deliveredOrders.length / totalOrders) * 100).toFixed(1) : '0.0',
    averageOrderValue: deliveredOrders.length > 0 ? (grossSales / deliveredOrders.length).toFixed(0) : '0'
  };

  // Calculate offer-specific metrics based on offer type
  switch (offer.offerType) {
    case 'promo':
      // For promo codes: show discount given and effective discount
      const totalDiscount = payments.reduce((sum, payment) => {
        const appliedOffer = payment.appliedOffers?.find(applied => 
          applied.offerId?.toString() === offer._id.toString() || 
          applied.promoCode === offer.promoCode
        );
        return sum + (appliedOffer?.discountAmount || 0);
      }, 0);

      const effectiveDiscount = grossSales > 0 ? ((totalDiscount / grossSales) * 100).toFixed(1) : '0.0';

      return {
        ...baseMetrics,
        discountGiven: `₹${totalDiscount.toFixed(0)}`,
        effectiveDiscount: `${effectiveDiscount}%`,
        promoCodeUsage: payments.length,
        avgDiscountPerOrder: payments.length > 0 ? (totalDiscount / payments.length).toFixed(0) : '0'
      };

    case 'freebie':
      // For freebies: show free items given and value saved
      const freeItemsGiven = payments.reduce((sum, payment) => {
        const appliedOffer = payment.appliedOffers?.find(applied => 
          applied.offerId?.toString() === offer._id.toString()
        );
        return sum + (appliedOffer?.freeItems?.length || 0);
      }, 0);

      // Estimate value of free items (you might need to get item price from database)
      const estimatedFreeItemValue = freeItemsGiven * 50; // Placeholder - replace with actual item price

      return {
        ...baseMetrics,
        freeItemsGiven: freeItemsGiven,
        estimatedSavings: `₹${estimatedFreeItemValue.toFixed(0)}`,
        redemptionRate: totalOrders > 0 ? ((freeItemsGiven / totalOrders) * 100).toFixed(1) : '0.0',
        avgItemsPerOrder: totalOrders > 0 ? (freeItemsGiven / totalOrders).toFixed(1) : '0.0'
      };

    case 'bogo':
      // For BOGO: show free items given through BOGO
      const bogoItemsGiven = payments.reduce((sum, payment) => {
        const appliedOffer = payment.appliedOffers?.find(applied => 
          applied.offerId?.toString() === offer._id.toString()
        );
        return sum + (appliedOffer?.freeItems?.length || 0);
      }, 0);

      const estimatedBogoValue = bogoItemsGiven * 75; // Placeholder for BOGO item value

      return {
        ...baseMetrics,
        bogoItemsGiven: bogoItemsGiven,
        estimatedSavings: `₹${estimatedBogoValue.toFixed(0)}`,
        bogoRedemptionRate: totalOrders > 0 ? ((bogoItemsGiven / totalOrders) * 100).toFixed(1) : '0.0',
        avgBogoPerOrder: totalOrders > 0 ? (bogoItemsGiven / totalOrders).toFixed(1) : '0.0'
      };

    case 'combo':
      // For combo: show combo discount and combo orders
      const comboDiscount = payments.reduce((sum, payment) => {
        const appliedOffer = payment.appliedOffers?.find(applied => 
          applied.offerId?.toString() === offer._id.toString()
        );
        return sum + (appliedOffer?.discountAmount || 0);
      }, 0);

      const comboEffectiveDiscount = grossSales > 0 ? ((comboDiscount / grossSales) * 100).toFixed(1) : '0.0';

      return {
        ...baseMetrics,
        comboDiscount: `₹${comboDiscount.toFixed(0)}`,
        effectiveDiscount: `${comboEffectiveDiscount}%`,
        comboOrdersCount: payments.length,
        avgComboSavings: payments.length > 0 ? (comboDiscount / payments.length).toFixed(0) : '0'
      };

    case 'loyalty':
      // For loyalty: show loyalty discount and loyal customers
      const loyaltyDiscount = payments.reduce((sum, payment) => {
        const appliedOffer = payment.appliedOffers?.find(applied => 
          applied.offerId?.toString() === offer._id.toString()
        );
        return sum + (appliedOffer?.discountAmount || 0);
      }, 0);

      const loyaltyEffectiveDiscount = grossSales > 0 ? ((loyaltyDiscount / grossSales) * 100).toFixed(1) : '0.0';

      return {
        ...baseMetrics,
        loyaltyDiscount: `₹${loyaltyDiscount.toFixed(0)}`,
        effectiveDiscount: `${loyaltyEffectiveDiscount}%`,
        loyalCustomers: payments.length,
        avgLoyaltyReward: payments.length > 0 ? (loyaltyDiscount / payments.length).toFixed(0) : '0'
      };

    default:
      // Fallback for unknown offer types
      return {
        ...baseMetrics,
        discountGiven: '₹0',
        effectiveDiscount: '0.0%'
      };
  }
};

// Updated helper function to get analytics for a single campaign
const getCampaignAnalyticsData = async (offerId) => {
  try {
    const offer = await Offer.findById(offerId);
    if (!offer) return null;

    // Find payments that used this offer
    const Payment = require('../../../models/order/payment');
    const paymentsWithOffer = await Payment.find({
      $or: [
        { 'appliedOffers.offerId': offerId },
        { 'appliedOffers.promoCode': offer.promoCode }
      ]
    });

    // Get corresponding orders
    const orderIds = paymentsWithOffer.map(payment => payment.orderId);
    const orders = await Order.find({
      orderId: { $in: orderIds },
      restaurantId: offer.restaurantId
    });

    return calculateCampaignMetrics(orders, paymentsWithOffer, offer);
  } catch (error) {
    console.error('Error calculating analytics for offer:', offerId, error);
    return null;
  }
};

// Add date range helper function
const calculateDateRanges = (timeFilter) => {
  const now = moment();
  let currentStart, currentEnd, previousStart, previousEnd;

  switch (timeFilter) {
    case 'daily':
      currentStart = moment().startOf('day');
      currentEnd = moment().endOf('day');
      previousStart = moment().subtract(1, 'day').startOf('day');
      previousEnd = moment().subtract(1, 'day').endOf('day');
      break;
    case 'weekly':
      currentStart = moment().startOf('week');
      currentEnd = moment().endOf('week');
      previousStart = moment().subtract(1, 'week').startOf('week');
      previousEnd = moment().subtract(1, 'week').endOf('week');
      break;
    case 'monthly':
      currentStart = moment().startOf('month');
      currentEnd = moment().endOf('month');
      previousStart = moment().subtract(1, 'month').startOf('month');
      previousEnd = moment().subtract(1, 'month').endOf('month');
      break;
    default:
      throw new Error('Invalid timeFilter');
  }

  return {
    currentPeriod: { start: currentStart.toDate(), end: currentEnd.toDate() },
    previousPeriod: { start: previousStart.toDate(), end: previousEnd.toDate() }
  };
};