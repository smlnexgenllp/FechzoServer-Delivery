const StoreAd = require("../../models/MarketPlace/StoreAd");

// ===================== CREATE AD =====================
exports.createAd = async (req, res) => {
  try {
    const ad = await StoreAd.create(req.body);
    res.status(201).json({
      success: true,
      message: "Ad created successfully",
      ad,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to create ad",
      error: error.message,
    });
  }
};

// ===================== GET ALL ADS =====================
exports.getAllAds = async (req, res) => {
  try {
    const ads = await StoreAd.find().sort({ priority: -1, createdAt: -1 });
    res.status(200).json({
      success: true,
      count: ads.length,
      ads,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch ads",
      error: error.message,
    });
  }
};

// ===================== GET ADS BY POSITION =====================
exports.getAdsByPosition = async (req, res) => {
  try {
    const { position } = req.params;
    const now = new Date();

    const ads = await StoreAd.find({
      position,
      isActive: true,
      $or: [
        { startDate: { $lte: now }, endDate: { $gte: now } },
        { startDate: { $lte: now }, endDate: null },
        { startDate: null, endDate: null },
      ],
    })
      .sort({ priority: -1 })
      .limit(position === "home-hero" ? 5 : 12);

    res.status(200).json({
      success: true,
      count: ads.length,
      ads,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch ads",
      error: error.message,
    });
  }
};

// ===================== GET SINGLE AD =====================
exports.getAdById = async (req, res) => {
  try {
    const ad = await StoreAd.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }
    res.status(200).json({ success: true, ad });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch ad",
      error: error.message,
    });
  }
};

// ===================== UPDATE AD =====================
exports.updateAd = async (req, res) => {
  try {
    const ad = await StoreAd.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    res.status(200).json({
      success: true,
      message: "Ad updated successfully",
      ad,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update ad",
      error: error.message,
    });
  }
};

// ===================== DELETE AD =====================
exports.deleteAd = async (req, res) => {
  try {
    const ad = await StoreAd.findByIdAndDelete(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }
    res.status(200).json({
      success: true,
      message: "Ad deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete ad",
      error: error.message,
    });
  }
};

// ===================== TOGGLE STATUS =====================
exports.toggleAdStatus = async (req, res) => {
  try {
    const ad = await StoreAd.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, message: "Ad not found" });
    }

    ad.isActive = !ad.isActive;
    await ad.save();

    res.status(200).json({
      success: true,
      message: `Ad ${ad.isActive ? "activated" : "deactivated"}`,
      ad,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to toggle status",
      error: error.message,
    });
  }
};