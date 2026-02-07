const mongoose = require('mongoose');
const Offer = require('../../models/offers/Offer');
const AdminOffer = require('../../models/offers/AdminOffer');
const Restaurant = require('../../models/restaurants/shops/RestaurantDetails');
const { scheduleOfferStatusUpdate, cancelOfferStatusJobs } = require('../../queues/offerStatusQueue');

// Helper to calculate status based on dates
const calculateStatus = (startDate, endDate) => {
  const now = new Date();
  if (now < new Date(startDate)) return 'Scheduled';
  if (now > new Date(endDate)) return 'Inactive';
  return 'Active';
};

exports.getAllCombinedOffers = async (req, res) => {
  try {
    // Fetch both admin offers and restaurant offers
    const adminOffers = await AdminOffer.find().sort({ createdAt: -1 });
    const restaurantOffers = await Offer.find().populate('restaurantId', 'restaurantName').sort({ createdAt: -1 });

    // Process admin offers to get restaurant names (similar to getAllOffers)
    const processedAdminOffers = await Promise.all(adminOffers.map(async offer => {
      const offerObj = offer.toObject();
      offerObj.isRestaurantOffer = false;

      // If not "All Restaurants", get restaurant names
      if (Array.isArray(offerObj.restaurants) &&
        !offerObj.restaurants.includes('All Restaurants') &&
        offerObj.restaurants.some(r => typeof r === 'object' || /^[0-9a-fA-F]{24}$/.test(r))) {

        const restaurantIds = offerObj.restaurants.map(r =>
          typeof r === 'object' ? r.toString() : r
        );

        const restaurants = await Restaurant.find({
          _id: { $in: restaurantIds }
        }, 'restaurantName');

        offerObj.restaurantNames = restaurants.map(r => r.restaurantName);
      } else {
        offerObj.restaurantNames = ['All Restaurants'];
      }

      return offerObj;
    }));

    // Format restaurant offers
    const formattedRestaurantOffers = restaurantOffers.map(offer => ({
      _id: offer._id,
      name: offer.promoCode || 'Restaurant Offer',
      type: offer.offerType || 'promo',
      discount: offer.discountType === 'percentage' ? `${offer.discountValue}%` : `₹${offer.discountValue}`,
      discountValue: offer.discountValue, // <-- ADD THIS
      discountType: offer.discountType,   // <-- AND THIS
      minOrderValue: offer.minOrderValue || null,
      maxDiscountCap: offer.maxDiscount || null,
      startDate: offer.validFrom || offer.startDate,
      endDate: offer.validTo || offer.endDate,
      status: offer.status.toLowerCase(),
      restaurants: offer.restaurantId ? [offer.restaurantId._id] : [],
      restaurantNames: offer.restaurantId ? [offer.restaurantId.restaurantName] : ['Unknown Restaurant'],
      promoCode: offer.promoCode || '',
      
      // Add specialized fields
      offerType: offer.offerType || 'promo',
      freeItem: offer.freeItem || null,
      bogoItem: offer.bogoItem || null,
      getFreeItem: offer.getFreeItem || null,
      comboItems: offer.comboItems || [],
      loyaltyMinOrders: offer.loyaltyMinOrders || null,
      loyaltyDiscountValue: offer.loyaltyDiscountValue || null,
      
      description: '',
      isRestaurantOffer: true,
      redemptions: 0,
      totalDiscount: 0
    }));

    // Combine both types of offers
    const combinedOffers = [...processedAdminOffers, ...formattedRestaurantOffers];

    res.status(200).json(combinedOffers);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch combined offers', error: error.message });
  }
};

exports.getAllOffers = async (req, res) => {
  try {
    const offers = await AdminOffer.find().sort({ createdAt: -1 });

    // Process each offer to convert restaurant IDs to names where needed
    const processedOffers = await Promise.all(offers.map(async offer => {
      const offerObj = offer.toObject();

      // If not "All Restaurants", get restaurant names
      if (Array.isArray(offerObj.restaurants) &&
        !offerObj.restaurants.includes('All Restaurants') &&
        offerObj.restaurants.some(r => typeof r === 'object' || /^[0-9a-fA-F]{24}$/.test(r))) {

        const restaurantIds = offerObj.restaurants.map(r =>
          typeof r === 'object' ? r.toString() : r
        );

        const restaurants = await Restaurant.find({
          _id: { $in: restaurantIds }
        }, 'restaurantName');

        offerObj.restaurantNames = restaurants.map(r => r.restaurantName);
      } else {
        offerObj.restaurantNames = ['All Restaurants'];
      }

      return offerObj;
    }));

    res.status(200).json(processedOffers);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch offers', error: error.message });
  }
};

exports.getOfferById = async (req, res) => {
  try {
    const offer = await AdminOffer.findById(req.params.id);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });
    res.status(200).json(offer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch offer', error: error.message });
  }
};

exports.createOffer = async (req, res) => {
  try {
    const { restaurants, ...offerData } = req.body;

    // Process discount formats
    let discountType = 'percentage';
    let discountValue = 0;

    if (offerData.discount) {
      if (offerData.discount.includes('%')) {
        discountType = 'percentage';
        discountValue = parseInt(offerData.discount.replace('%', ''), 10);
      } else if (offerData.discount.includes('₹')) {
        discountType = 'fixed';
        discountValue = parseInt(offerData.discount.replace('₹', ''), 10);
      }
    }

    // Calculate initial status based on dates
    const status = calculateStatus(req.body.startDate, req.body.endDate);

    // Handle restaurant selection - either specific restaurants or all
    let restaurantIds = [];
    if (restaurants && restaurants.length && !restaurants.includes('All Restaurants')) {
      // Get restaurant IDs if specific restaurants are selected
      const restaurantDocs = await Restaurant.find({
        restaurantName: { $in: restaurants }
      }, '_id');
      restaurantIds = restaurantDocs.map(doc => doc._id);
    }

    const offer = new AdminOffer({
      ...offerData,
      discountType,
      discountValue,
      restaurants: restaurants.includes('All Restaurants') ? ['All Restaurants'] : restaurantIds,
      status
    });

    await offer.save();

    // Schedule status updates if needed
    const now = new Date();
    if (status === 'upcoming') {
      await scheduleOfferStatusUpdate(offer._id, 'active', offer.startDate, true);
    }
    if (new Date(offer.endDate) > now) {
      await scheduleOfferStatusUpdate(offer._id, 'expired', offer.endDate, true);
    }

    res.status(201).json(offer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create offer', error: error.message });
  }
};

exports.updateOffer = async (req, res) => {
  try {
    const { id } = req.params;
    const { restaurants, ...updateData } = req.body;

    // Calculate status
    let status = updateData.status;
    if (updateData.startDate || updateData.endDate) {
      const offer = await AdminOffer.findById(id);
      if (!offer) return res.status(404).json({ message: 'Offer not found' });

      const startDate = updateData.startDate || offer.startDate;
      const endDate = updateData.endDate || offer.endDate;

      // Only update status if not manually paused
      if (offer.status !== 'paused') {
        status = calculateStatus(startDate, endDate);
      }
    }

    // Handle restaurant selection update
    let restaurantIds = [];
    if (restaurants && restaurants.length && !restaurants.includes('All Restaurants')) {
      // Get restaurant IDs if specific restaurants are selected
      const restaurantDocs = await Restaurant.find({
        restaurantName: { $in: restaurants }
      }, '_id');
      restaurantIds = restaurantDocs.map(doc => doc._id);
    }

    // Cancel existing scheduled jobs
    await cancelOfferStatusJobs(id, true);

    const updatedOffer = await AdminOffer.findByIdAndUpdate(
      id,
      {
        ...updateData,
        restaurants: restaurants?.includes('All Restaurants') ? ['All Restaurants'] : restaurantIds,
        status
      },
      { new: true }
    );

    if (!updatedOffer) return res.status(404).json({ message: 'Offer not found' });

    // Schedule new status updates
    const now = new Date();
    if (status === 'upcoming') {
      await scheduleOfferStatusUpdate(updatedOffer._id, 'active', updatedOffer.startDate, true);
    }
    if (new Date(updatedOffer.endDate) > now) {
      await scheduleOfferStatusUpdate(updatedOffer._id, 'expired', updatedOffer.endDate, true);
    }

    res.status(200).json(updatedOffer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to update offer', error: error.message });
  }
};

exports.toggleOfferStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const offer = await AdminOffer.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!offer) return res.status(404).json({ message: 'Offer not found' });

    // Cancel existing scheduled jobs if manually paused
    if (status === 'Inactive') {
      await cancelOfferStatusJobs(id, true);
    }
    // Re-schedule jobs if reactivated
    else if (status === 'active' || status === 'upcoming') {
      const now = new Date();
      if (status === 'upcoming' && new Date(offer.startDate) > now) {
        await scheduleOfferStatusUpdate(offer._id, 'active', offer.startDate, true);
      }
      if (new Date(offer.endDate) > now) {
        await scheduleOfferStatusUpdate(offer._id, 'expired', offer.endDate, true);
      }
    }

    res.status(200).json(offer);
  } catch (error) {
    res.status(500).json({ message: 'Failed to toggle offer status', error: error.message });
  }
};

exports.deleteOffer = async (req, res) => {
  try {
    const { id } = req.params;

    // Cancel any scheduled jobs first
    await cancelOfferStatusJobs(id, true);

    const offer = await AdminOffer.findByIdAndDelete(id);
    if (!offer) return res.status(404).json({ message: 'Offer not found' });

    res.status(200).json({ message: 'Offer deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete offer', error: error.message });
  }
};

exports.getOfferStats = async (req, res) => {
  try {
    const stats = {
      total: await AdminOffer.countDocuments(),
      active: await AdminOffer.countDocuments({ status: 'Active' }),
      scheduled: await AdminOffer.countDocuments({ status: 'Scheduled' }),
      inactive: await AdminOffer.countDocuments({ status: 'Inactive' }),
      // Remove separate counts for expired and paused
      redemptions: await AdminOffer.aggregate([
        { $group: { _id: null, total: { $sum: '$redemptions' } } }
      ]),
      totalDiscount: await AdminOffer.aggregate([
        { $group: { _id: null, total: { $sum: '$totalDiscount' } } }
      ])
    };

    // Format the aggregation results
    stats.redemptions = stats.redemptions.length > 0 ? stats.redemptions[0].total : 0;
    stats.totalDiscount = stats.totalDiscount.length > 0 ? stats.totalDiscount[0].total : 0;

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch offer statistics', error: error.message });
  }
};

exports.bulkUpdateOffers = async (req, res) => {
  try {
    const { action, offerIds } = req.body;

    if (!offerIds || !Array.isArray(offerIds) || offerIds.length === 0) {
      return res.status(400).json({ message: 'No offers selected for bulk action' });
    }

    if (!['activate', 'pause', 'delete'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action specified' });
    }

    if (action === 'delete') {
      // Delete multiple offers
      await AdminOffer.deleteMany({ _id: { $in: offerIds } });

      // Cancel scheduled jobs for all deleted offers
      for (const id of offerIds) {
        await cancelOfferStatusJobs(id, true);
      }

      return res.status(200).json({ message: `Successfully deleted ${offerIds.length} offers` });
    } else {
      // Update status for multiple offers
      const newStatus = action === 'activate' ? 'active' : 'paused';

      const updatePromises = offerIds.map(async (id) => {
        const offer = await AdminOffer.findByIdAndUpdate(
          id,
          { status: newStatus },
          { new: true }
        );

        if (!offer) return null;

        // Handle scheduled jobs
        if (newStatus === 'paused') {
          await cancelOfferStatusJobs(id, true);
        } else if (newStatus === 'active') {
          const now = new Date();
          if (new Date(offer.endDate) > now) {
            await scheduleOfferStatusUpdate(offer._id, 'expired', offer.endDate, true);
          }
        }

        return offer;
      });

      await Promise.all(updatePromises);

      return res.status(200).json({
        message: `Successfully ${action === 'activate' ? 'activated' : 'paused'} ${offerIds.length} offers`
      });
    }
  } catch (error) {
    res.status(500).json({ message: `Failed to perform bulk action: ${error.message}` });
  }
};