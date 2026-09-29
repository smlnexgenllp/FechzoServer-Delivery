const Offer = require("../../models/MarketPlace/StoreOffers");
const mongoose = require("mongoose");

/* =====================================================
   Get storeId (same pattern as payments)
===================================================== */
const getStoreId = (req) => {
  let storeId = null;

  if (req.store?._id) storeId = req.store._id;
  else if (req.query.storeId) storeId = req.query.storeId;
  else if (req.body?.storeId) storeId = req.body.storeId;
  else if (req.user?.storeId) storeId = req.user.storeId;
  else if (req.user?.store?._id) storeId = req.user.store._id;

  if (!storeId) return null;

  if (mongoose.Types.ObjectId.isValid(storeId)) {
    return new mongoose.Types.ObjectId(storeId);
  }
  return storeId;
};

/* =====================================================
   1. LIST OFFERS (Store)
===================================================== */
exports.getStoreOffers = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) {
      return res.status(401).json({
        success: false,
        message: "Store not authenticated / storeId missing",
      });
    }

    const { status, search } = req.query;
    const filter = { storeId };

    if (status === "active") filter.isActive = true;
    if (status === "inactive") filter.isActive = false;

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { couponCode: { $regex: search, $options: "i" } },
      ];
    }

    const offers = await Offer.find(filter).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      data: offers,
    });
  } catch (error) {
    console.error("getStoreOffers error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch offers" });
  }
};

/* =====================================================
   2. CREATE OFFER
===================================================== */
exports.createStoreOffer = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) {
      return res.status(401).json({
        success: false,
        message: "Store not authenticated / storeId missing",
      });
    }

    const {
      title,
      description,
      offerType,
      discountValue,
      maxDiscount,
      minOrderValue,
      couponCode,
      isCoupon,
      productIds,
      usageLimit,
      usagePerUser,
      startDate,
      endDate,
      badgeText,
    } = req.body;

    if (!title || !offerType || discountValue == null || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Title, offer type, discount value, start date and end date are required",
      });
    }

    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({
        success: false,
        message: "End date must be after start date",
      });
    }

    if (offerType === "percentage" && (discountValue <= 0 || discountValue > 100)) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 1 and 100",
      });
    }

    const payload = {
      title,
      description: description || "",
      offerType,
      discountValue: Number(discountValue),
      maxDiscount: maxDiscount != null ? Number(maxDiscount) : null,
      minOrderValue: Number(minOrderValue) || 0,
      couponCode: isCoupon && couponCode ? String(couponCode).toUpperCase().trim() : null,
      isCoupon: !!isCoupon,
      storeId,
      productIds: productIds || [],
      usageLimit: usageLimit != null ? Number(usageLimit) : null,
      usagePerUser: usagePerUser != null ? Number(usagePerUser) : 1,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      badgeText: badgeText || "",
      createdBy: "store",
      isActive: true,
    };

    const offer = await Offer.create(payload);

    res.status(201).json({
      success: true,
      message: "Offer created successfully",
      data: offer,
    });
  } catch (error) {
    console.error("createStoreOffer error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This coupon code already exists for your store",
      });
    }
    res.status(500).json({ success: false, message: "Failed to create offer" });
  }
};

/* =====================================================
   3. UPDATE OFFER
===================================================== */
exports.updateStoreOffer = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) {
      return res.status(401).json({
        success: false,
        message: "Store not authenticated / storeId missing",
      });
    }

    const { id } = req.params;
    const offer = await Offer.findOne({ _id: id, storeId });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    const allowed = [
      "title",
      "description",
      "offerType",
      "discountValue",
      "maxDiscount",
      "minOrderValue",
      "couponCode",
      "isCoupon",
      "productIds",
      "usageLimit",
      "usagePerUser",
      "startDate",
      "endDate",
      "badgeText",
      "isActive",
    ];

    allowed.forEach((key) => {
      if (req.body[key] !== undefined) {
        if (key === "couponCode" && req.body[key]) {
          offer[key] = String(req.body[key]).toUpperCase().trim();
        } else if (["discountValue", "maxDiscount", "minOrderValue", "usageLimit", "usagePerUser"].includes(key)) {
          offer[key] = req.body[key] == null ? null : Number(req.body[key]);
        } else if (key === "startDate" || key === "endDate") {
          offer[key] = new Date(req.body[key]);
        } else {
          offer[key] = req.body[key];
        }
      }
    });

    await offer.save();

    res.status(200).json({
      success: true,
      message: "Offer updated successfully",
      data: offer,
    });
  } catch (error) {
    console.error("updateStoreOffer error:", error);
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "This coupon code already exists for your store",
      });
    }
    res.status(500).json({ success: false, message: "Failed to update offer" });
  }
};

/* =====================================================
   4. TOGGLE ACTIVE
===================================================== */
exports.toggleStoreOffer = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) {
      return res.status(401).json({
        success: false,
        message: "Store not authenticated / storeId missing",
      });
    }

    const { id } = req.params;
    const offer = await Offer.findOne({ _id: id, storeId });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    offer.isActive = !offer.isActive;
    await offer.save();

    res.status(200).json({
      success: true,
      message: `Offer ${offer.isActive ? "activated" : "deactivated"}`,
      data: offer,
    });
  } catch (error) {
    console.error("toggleStoreOffer error:", error);
    res.status(500).json({ success: false, message: "Failed to toggle offer" });
  }
};

/* =====================================================
   5. DELETE OFFER
===================================================== */
exports.deleteStoreOffer = async (req, res) => {
  try {
    const storeId = getStoreId(req);
    if (!storeId) {
      return res.status(401).json({
        success: false,
        message: "Store not authenticated / storeId missing",
      });
    }

    const { id } = req.params;
    const offer = await Offer.findOneAndDelete({ _id: id, storeId });

    if (!offer) {
      return res.status(404).json({
        success: false,
        message: "Offer not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Offer deleted successfully",
    });
  } catch (error) {
    console.error("deleteStoreOffer error:", error);
    res.status(500).json({ success: false, message: "Failed to delete offer" });
  }
};