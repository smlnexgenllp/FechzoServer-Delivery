const StoreOffer = require("../../models/MarketPlace/StoreOffers"); // adjust path
const mongoose = require("mongoose");

/* =====================================================
   HELPERS
===================================================== */
const toObjectId = (id) => {
  if (!id) return null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    return new mongoose.Types.ObjectId(id);
  }
  return null;
};

const isOfferValidNow = (offer, now = new Date()) => {
  if (!offer?.isActive) return false;
  if (offer.startDate && new Date(offer.startDate) > now) return false;
  if (offer.endDate && new Date(offer.endDate) < now) return false;
  if (offer.usageLimit != null && offer.usedCount >= offer.usageLimit) return false;
  return true;
};

/**
 * Calculate discount for one offer
 */
const calculateDiscount = (offer, subtotal) => {
  if (!offer || subtotal <= 0) {
    return { discountAmount: 0, freeDelivery: false };
  }

  if (subtotal < (offer.minOrderValue || 0)) {
    return { discountAmount: 0, freeDelivery: false };
  }

  if (offer.offerType === "free_delivery") {
    return { discountAmount: 0, freeDelivery: true };
  }

  let discountAmount = 0;

  if (offer.offerType === "percentage") {
    discountAmount = (subtotal * Number(offer.discountValue)) / 100;
    if (offer.maxDiscount != null) {
      discountAmount = Math.min(discountAmount, Number(offer.maxDiscount));
    }
  } else if (offer.offerType === "flat") {
    discountAmount = Number(offer.discountValue) || 0;
  }

  // Cannot exceed subtotal
  discountAmount = Math.min(discountAmount, subtotal);
  discountAmount = Math.round(discountAmount * 100) / 100; // 2 decimals

  return { discountAmount, freeDelivery: false };
};

/**
 * Pick best offer (highest discount; free delivery as secondary)
 */
const pickBestOffer = (offers, subtotal) => {
  let best = null;
  let bestDiscount = 0;
  let bestFreeDelivery = false;

  for (const offer of offers) {
    const { discountAmount, freeDelivery } = calculateDiscount(offer, subtotal);

    // Prefer higher money discount
    if (discountAmount > bestDiscount) {
      best = offer;
      bestDiscount = discountAmount;
      bestFreeDelivery = freeDelivery;
    } else if (
      discountAmount === bestDiscount &&
      freeDelivery &&
      !bestFreeDelivery
    ) {
      best = offer;
      bestFreeDelivery = true;
    }
  }

  if (!best) {
    return {
      offer: null,
      discountAmount: 0,
      freeDelivery: false,
    };
  }

  const result = calculateDiscount(best, subtotal);
  return {
    offer: best,
    discountAmount: result.discountAmount,
    freeDelivery: result.freeDelivery,
  };
};

/* =====================================================
   1. GET APPLICABLE OFFERS FOR CART
   POST /marketplace/offers/applicable
   Body: { storeId, subtotal, productIds?: [] }
===================================================== */
exports.getApplicableOffers = async (req, res) => {
  try {
    const { storeId, subtotal = 0, productIds = [] } = req.body;

    if (!storeId) {
      return res.status(400).json({
        success: false,
        message: "storeId is required",
      });
    }

    const storeObjectId = toObjectId(storeId);
    if (!storeObjectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid storeId",
      });
    }

    const now = new Date();
    const cartSubtotal = Number(subtotal) || 0;

    // Active offers for this store (auto + coupon listed)
    const offers = await StoreOffer.find({
      storeId: storeObjectId,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).lean();

    // Filter by product scope (empty productIds = whole store)
    const scoped = offers.filter((offer) => {
      if (!offer.productIds || offer.productIds.length === 0) return true;
      if (!productIds.length) return true;
      return offer.productIds.some((pid) =>
        productIds.map(String).includes(String(pid))
      );
    });

    const valid = scoped.filter((o) => isOfferValidNow(o, now));

    // Auto offers (no coupon) for best apply
    const autoOffers = valid.filter((o) => !o.isCoupon);

    const best = pickBestOffer(autoOffers, cartSubtotal);

    // All offers user can still see (including coupons not yet applied)
    const list = valid.map((o) => {
      const calc = calculateDiscount(o, cartSubtotal);
      return {
        _id: o._id,
        title: o.title,
        description: o.description,
        offerType: o.offerType,
        discountValue: o.discountValue,
        maxDiscount: o.maxDiscount,
        minOrderValue: o.minOrderValue,
        isCoupon: o.isCoupon,
        couponCode: o.isCoupon ? o.couponCode : null,
        badgeText: o.badgeText,
        eligible: cartSubtotal >= (o.minOrderValue || 0),
        estimatedDiscount: calc.discountAmount,
        freeDelivery: calc.freeDelivery,
      };
    });

    res.status(200).json({
      success: true,
      data: {
        subtotal: cartSubtotal,
        appliedOffer: best.offer
          ? {
              _id: best.offer._id,
              title: best.offer.title,
              offerType: best.offer.offerType,
              discountValue: best.offer.discountValue,
              maxDiscount: best.offer.maxDiscount,
              minOrderValue: best.offer.minOrderValue,
              badgeText: best.offer.badgeText,
              isCoupon: best.offer.isCoupon,
              couponCode: best.offer.couponCode,
            }
          : null,
        discountAmount: best.discountAmount,
        freeDelivery: best.freeDelivery,
        finalAmount: Math.max(0, cartSubtotal - best.discountAmount),
        availableOffers: list,
      },
    });
  } catch (error) {
    console.error("getApplicableOffers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get applicable offers",
    });
  }
};

/* =====================================================
   2. VALIDATE COUPON
   POST /marketplace/offers/validate-coupon
   Body: { storeId, couponCode, subtotal, productIds?: [] }
===================================================== */
exports.validateCoupon = async (req, res) => {
  try {
    const { storeId, couponCode, subtotal = 0, productIds = [] } = req.body;

    if (!storeId || !couponCode) {
      return res.status(400).json({
        success: false,
        message: "storeId and couponCode are required",
      });
    }

    const storeObjectId = toObjectId(storeId);
    if (!storeObjectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid storeId",
      });
    }

    const code = String(couponCode).toUpperCase().trim();
    const cartSubtotal = Number(subtotal) || 0;
    const now = new Date();

    const offer = await StoreOffer.findOne({
      storeId: storeObjectId,
      isCoupon: true,
      couponCode: code,
      isActive: true,
    }).lean();

    if (!offer) {
      return res.status(404).json({
        success: false,
        valid: false,
        message: "Invalid coupon code",
      });
    }

    if (!isOfferValidNow(offer, now)) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: "This coupon is expired or inactive",
      });
    }

    // Product scope
    if (offer.productIds?.length && productIds.length) {
      const match = offer.productIds.some((pid) =>
        productIds.map(String).includes(String(pid))
      );
      if (!match) {
        return res.status(400).json({
          success: false,
          valid: false,
          message: "Coupon not valid for products in cart",
        });
      }
    }

    if (cartSubtotal < (offer.minOrderValue || 0)) {
      return res.status(400).json({
        success: false,
        valid: false,
        message: `Minimum order value ₹${offer.minOrderValue} required`,
      });
    }

    const { discountAmount, freeDelivery } = calculateDiscount(
      offer,
      cartSubtotal
    );

    res.status(200).json({
      success: true,
      valid: true,
      message: freeDelivery
        ? "Free delivery applied"
        : `₹${discountAmount} discount applied`,
      data: {
        offer: {
          _id: offer._id,
          title: offer.title,
          offerType: offer.offerType,
          discountValue: offer.discountValue,
          maxDiscount: offer.maxDiscount,
          minOrderValue: offer.minOrderValue,
          badgeText: offer.badgeText,
          isCoupon: true,
          couponCode: offer.couponCode,
        },
        discountAmount,
        freeDelivery,
        finalAmount: Math.max(0, cartSubtotal - discountAmount),
      },
    });
  } catch (error) {
    console.error("validateCoupon error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to validate coupon",
    });
  }
};

/* =====================================================
   3. GET ACTIVE OFFERS FOR A STORE (badges / listing)
   GET /marketplace/offers/store/:storeId
===================================================== */
exports.getStoreActiveOffers = async (req, res) => {
  try {
    const storeObjectId = toObjectId(req.params.storeId);
    if (!storeObjectId) {
      return res.status(400).json({
        success: false,
        message: "Invalid storeId",
      });
    }

    const now = new Date();

    const offers = await StoreOffer.find({
      storeId: storeObjectId,
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .select(
        "title description offerType discountValue maxDiscount minOrderValue isCoupon couponCode badgeText endDate"
      )
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      data: offers,
    });
  } catch (error) {
    console.error("getStoreActiveOffers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch offers",
    });
  }
};