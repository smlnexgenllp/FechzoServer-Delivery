const mongoose = require('mongoose');
const Offer = require('../../models/offers/Offer');
const AdminOffer = require('../../models/offers/AdminOffer');
const User = require('../../models/User/User');
const createError = require('http-errors');
// Helper function to format date and time
const formatDateTime = (date) => {
  if (!date) return '';
  return {
    date: date.toISOString().split('T')[0], // YYYY-MM-DD
    time: date.toTimeString().split(' ')[0].slice(0, 5), // HH:MM
  };
};

// Helper function to generate offer description
const generateDescription = (offer) => {
  switch (offer.offerType) {
    case 'promo':
      return offer.discountType === 'percentage'
        ? `${offer.discountValue}% off on your order`
        : `₹${offer.discountValue} off on your order`;
    case 'freebie':
      return `Get a free ${offer.freeItem} with your order`;
    case 'bogo':
      return `Buy one ${offer.bogoItem}, get ${offer.getFreeItem} free`;
    case 'combo':
      return `Special combo deal: ${offer.comboItems.join(', ')}`;
    case 'loyalty':
      return `${offer.loyaltyDiscountValue}% off for loyal customers after ${offer.loyaltyMinOrders} orders`;
    default:
      return 'Special offer';
  }
};

exports.getOffers = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    // Validate restaurantId
    if (!restaurantId) {
      return res.status(400).json({ message: 'Restaurant ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: 'Invalid restaurant ID format' });
    }

    // Check if restaurant exists
    const restaurant = await mongoose.model('Restaurant').findById(restaurantId).select('restaurantName').lean();
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // Query active offers
    const offers = await Offer.find({
      restaurantId: new mongoose.Types.ObjectId(restaurantId),
      status: 'Active',
    })
      .populate({
        path: 'restaurantId',
        select: 'restaurantName',
        strictPopulate: false,
      })
      .lean();

    // Format offers
    const formattedOffers = offers.map((offer) => {
      const formatted = {
        ...offer,
        _id: offer._id.toString(),
        restaurantId: {
          _id: offer.restaurantId?._id?.toString() || restaurantId,
          name: offer.restaurantId?.restaurantName || restaurant.restaurantName || 'Unknown Restaurant',
        },
        description: generateDescription(offer),
        validFrom: formatDateTime(offer.validFrom),
        validTo: formatDateTime(offer.validTo),
        status: offer.status || 'Active',
      };
      return formatted;
    });

    res.status(200).json({
      restaurant: formattedOffers,
      restaurantName: restaurant.restaurantName || 'Unknown Restaurant',
    });
  } catch (error) {
    console.error('[GET /offers] Error fetching offers:', {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ message: 'Failed to fetch offers' });
  }
};

exports.getAdminOffers = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    if (!restaurantId) {
      return res.status(400).json({ message: 'Restaurant ID is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: 'Invalid restaurant ID format' });
    }

    const offers = await AdminOffer.find({
      restaurants: { $in: [new mongoose.Types.ObjectId(restaurantId), 'All Restaurants'] },
    })
      .populate({
        path: 'restaurants',
        select: 'restaurantName',
        strictPopulate: false,
      })
      .lean();

    const formattedOffers = offers.map((offer) => {
      let restaurants = [];

      if (
        offer.restaurants &&
        offer.restaurants.length === 1 &&
        offer.restaurants[0] === 'All Restaurants'
      ) {
        restaurants = [{ name: 'All Restaurants' }];
      } else {
        restaurants = offer.restaurants
          ? offer.restaurants.map((r) => ({
              _id: r._id ? r._id.toString() : null,
              name: r.restaurantName || 'Unknown Restaurant',
            }))
          : [{ name: 'Unknown Restaurant' }];
      }

      return {
        _id: offer._id.toString(),
        code: offer.promoCode || 'N/A',
        name: offer.name || 'Unnamed Offer',
        type: offer.type || 'N/A',
        offerType: offer.offerType || 'promo',
        discountType: offer.discountType || 'N/A',
        discountValue: offer.discountValue || 0,
        discount: offer.discount || 'N/A',
        minOrderValue: offer.minOrderValue || 0,
        maxDiscountCap: offer.maxDiscountCap || 0,
        usageLimit: offer.usageLimit || 0,
        validFrom: formatDateTime(offer.startDate),
        validUntil: formatDateTime(offer.endDate),
        restaurants,
        description: offer.description || generateDescription(offer),
        status: offer.status || 'Scheduled',
        freeItem: offer.freeItem || null,
        bogoItem: offer.bogoItem || null,
        getFreeItem: offer.getFreeItem || null,
        comboItems: offer.comboItems || [],
        loyaltyMinOrders: offer.loyaltyMinOrders || 0,
        loyaltyDiscountValue: offer.loyaltyDiscountValue || 0,
        redemptions: offer.redemptions || 0,
        totalDiscount: offer.totalDiscount || 0,
        createdAt: formatDateTime(offer.createdAt),
        updatedAt: formatDateTime(offer.updatedAt),
      };
    });

    res.status(200).json({ restaurant: formattedOffers });
  } catch (error) {
    console.error('Error fetching admin offers:', error);
    return res.status(500).json({ message: `Failed to fetch admin offers: ${error.message}` });
  }
};

exports.getAdminPromoCodes = async (req, res) => {
  try {
    const { restaurantId, userId } = req.query;

    console.log('Fetching promo codes with:', { restaurantId, userId });

    // Fetch active admin promo codes
    const adminPromoCodes = await AdminOffer.find({
      status: 'Active',
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    })
      .populate({
        path: 'restaurants',
        select: 'restaurantName',
        strictPopulate: false,
      })
      .lean()
      .exec();

    console.log('Admin promo codes found:', adminPromoCodes.length);

    // Fetch active restaurant-specific offers only if restaurantId is provided
    let restaurantOffers = [];
    if (restaurantId) {
      restaurantOffers = await Offer.find({
        restaurantId,
        status: 'Active',
        validFrom: { $lte: new Date() },
        validTo: { $gte: new Date() },
      })
        .populate({
          path: 'restaurantId',
          select: 'restaurantName',
        })
        .lean()
        .exec();
    }

    console.log('Restaurant offers found:', restaurantOffers.length);

    // Format admin promo codes
    const formattedAdminPromoCodes = adminPromoCodes.map((promo) => {
      let restaurants = [];
      if (promo.restaurants?.length === 1 && promo.restaurants[0] === 'All Restaurants') {
        restaurants = [{ name: 'All Restaurants' }];
      } else {
        restaurants = promo.restaurants?.length
          ? promo.restaurants.map((r) => ({
              _id: r._id ? r._id.toString() : null,
              name: r.restaurantName || 'Unknown Restaurant',
            }))
          : [{ name: 'Unknown Restaurant' }];
      }

      // Generate description based on available fields
      const description =
        promo.description ||
        (promo.discountValue && promo.discountType
          ? `Get ${promo.discountValue}${promo.discountType === 'percentage' ? '%' : '₹'} off`
          : 'Special offer');

      return {
        _id: promo._id?.toString() || 'unknown',
        code: promo.promoCode,
        offerType: promo.offerType || 'promo',
        discountType: promo.discountType || 'unknown',
        discountValue: promo.discountValue || 0,
        maxDiscountCap: promo.maxDiscountCap || 0,
        minOrderValue: promo.minOrderValue || 0,
        applicableFor: promo.applicableFor || 'all', // <-- ADD THIS
        validFrom: new Date(promo.startDate).toLocaleDateString(),
        validUntil: new Date(promo.endDate).toLocaleDateString(),
        description,
        restaurants,
        source: 'admin',
      };
    });

    // Format restaurant offers
    const formattedRestaurantOffers = restaurantOffers.map((offer) => ({
      _id: offer._id?.toString() || 'unknown',
      code: offer.promoCode,
      offerType: offer.offerType || 'promo',
      discountType: offer.discountType || 'unknown',
      discountValue: offer.discountValue || 0,
      maxDiscountCap: offer.maxDiscount || 0,
      minOrderValue: offer.minOrderValue || 0,
      applicableFor: offer.applicableFor || 'all', // <-- ADD THIS
      validFrom: new Date(offer.validFrom).toLocaleDateString(),
      validUntil: new Date(offer.validTo).toLocaleDateString(),
      description:
        offer.description ||
        (offer.discountValue && offer.discountType
          ? `Get ${offer.discountValue}${offer.discountType === 'percentage' ? '%' : '₹'} off`
          : 'Restaurant special offer'),
      restaurants: [
        {
          _id: offer.restaurantId?._id?.toString() || 'unknown',
          name: offer.restaurantId?.restaurantName || 'Unknown Restaurant',
        },
      ],
      source: 'restaurant',
    }));

    const allPromoCodes = [...formattedAdminPromoCodes, ...formattedRestaurantOffers];

    console.log('Total promo codes:', allPromoCodes.length);

    if (!allPromoCodes.length) {
      return res.status(200).json({
        message: 'No active promo codes available at this time',
        promoCodes: [],
      });
    }

    return res.status(200).json({ promoCodes: allPromoCodes });
  } catch (error) {
    console.error('Error fetching promo codes:', {
      message: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      message: `Failed to fetch promo codes: ${error.message}`,
    });
  }
};