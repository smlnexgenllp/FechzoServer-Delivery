const Store = require("../../models/marketplace/Store");
const asyncHandler = require("express-async-handler");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");

// ====================== HELPERS ======================
const parseJSON = (value, fallback = {}) => {
  try {
    return typeof value === "string" ? JSON.parse(value || "{}") : value || fallback;
  } catch {
    return fallback;
  }
};

const getFileUrl = async (files, fieldName, folder) => {
  if (!files?.[fieldName]?.[0]) return null;
  return await uploadToCloudinary(files[fieldName][0].buffer, folder);
};

const getMultipleUrls = async (files, fieldName, folder) => {
  if (!files?.[fieldName]?.length) return [];
  return Promise.all(
    files[fieldName].map((file) => uploadToCloudinary(file.buffer, folder))
  );
};

// ====================== REGISTER STORE (PUBLIC) ======================
// @desc    Register a new store (No login required)
// @route   POST /api/stores/register
// @access  Public
const registerStore = asyncHandler(async (req, res) => {
  // Safe – works even if user is not logged in
  const userId = req.user?._id || req.user?.id || req.user?.adminId || null;

  const {
    storeName,
    storeType,
    description,
    phone,
    email,
    address,
    documents,
    bankDetails,
    operatingHours,
    ownerDetails,
    deliveryRadius,
    minOrderValue,
  } = req.body;

  if (!storeName || !storeType || !phone || !email) {
    res.status(400);
    throw new Error("storeName, storeType, phone and email are required");
  }

  // Only check duplicate if user is logged in
  if (userId) {
    const existing = await Store.findOne({
      owner: userId,
      storeName: storeName.trim(),
      isDeleted: false,
    });
    if (existing) {
      res.status(400);
      throw new Error("You already have a store with this name");
    }
  }

  const files = req.files || {};

  // Upload all files in parallel
  const [
    logo,
    banner,
    storefrontImage,
    interiorImages,
    kitchenImages,
    packagingImages,
    images,
    gstCertificate,
    panCard,
    aadhaarCard,
    shopLicense,
    fssaiCertificate,
    cancelledCheque,
    addressProof,
  ] = await Promise.all([
    getFileUrl(files, "logo", "stores/logo"),
    getFileUrl(files, "banner", "stores/banner"),
    getFileUrl(files, "storefrontImage", "stores/storefront"),
    getMultipleUrls(files, "interiorImages", "stores/interior"),
    getMultipleUrls(files, "kitchenImages", "stores/kitchen"),
    getMultipleUrls(files, "packagingImages", "stores/packaging"),
    getMultipleUrls(files, "images", "stores/gallery"),
    getFileUrl(files, "gstCertificate", "stores/documents"),
    getFileUrl(files, "panCard", "stores/documents"),
    getFileUrl(files, "aadhaarCard", "stores/documents"),
    getFileUrl(files, "shopLicense", "stores/documents"),
    getFileUrl(files, "fssaiCertificate", "stores/documents"),
    getFileUrl(files, "cancelledCheque", "stores/documents"),
    getFileUrl(files, "addressProof", "stores/documents"),
  ]);

  const store = await Store.create({
    owner: userId, // null if not logged in
    storeName: storeName.trim(),
    storeType,
    description,
    phone,
    email: email.toLowerCase(),
    address: parseJSON(address),
    documents: {
      ...parseJSON(documents),
      gstCertificate,
      panCard,
      aadhaarCard,
      shopLicense,
      fssaiCertificate,
      cancelledCheque,
      addressProof,
    },
    bankDetails: parseJSON(bankDetails),
    logo,
    banner,
    storefrontImage,
    interiorImages,
    kitchenImages,
    packagingImages,
    images,
    operatingHours: parseJSON(operatingHours, []),
    ownerDetails: parseJSON(ownerDetails),
    deliveryRadius: Number(deliveryRadius) || 5,
    minOrderValue: Number(minOrderValue) || 0,
    status: "pending",
  });

  // Notify admin
  const io = req.app.get("io");
  if (io) {
    io.to("admin-channel").emit("newStoreRegistration", {
      storeId: store._id,
      storeName: store.storeName,
      storeType: store.storeType,
      ownerId: userId,
    });
  }

  res.status(201).json({
    success: true,
    message: "Store registration submitted. Waiting for admin approval.",
    data: store,
  });
});

// ====================== GET MY STORES ======================
const getMyStores = asyncHandler(async (req, res) => {
  const userId = req.user?._id || req.user?.id || req.user?.adminId;

  if (!userId) {
    res.status(401);
    throw new Error("Not authorized");
  }

  const stores = await Store.find({
    owner: userId,
    isDeleted: false,
  }).sort({ createdAt: -1 });

  res.json({ success: true, count: stores.length, data: stores });
});

// ====================== GET STORE BY ID ======================
const getStoreById = asyncHandler(async (req, res) => {
  const store = await Store.findById(req.params.id).populate(
    "owner",
    "name email phone"
  );

  if (!store || store.isDeleted) {
    res.status(404);
    throw new Error("Store not found");
  }

  const userId = (req.user?._id || req.user?.id || req.user?.adminId)?.toString();
  const isOwner = store.owner && store.owner._id?.toString() === userId;
  const isAdmin = req.user?.role === "admin";

  if (!isOwner && !isAdmin) {
    res.status(403);
    throw new Error("Not authorized");
  }

  res.json({ success: true, data: store });
});

// ====================== UPDATE STORE ======================
const updateStore = asyncHandler(async (req, res) => {
  const store = await Store.findById(req.params.id);

  if (!store || store.isDeleted) {
    res.status(404);
    throw new Error("Store not found");
  }

  const userId = (req.user?._id || req.user?.id || req.user?.adminId)?.toString();
  const isOwner = store.owner && store.owner.toString() === userId;
  const isAdmin = req.user?.role === "admin";

  if (!isOwner && !isAdmin) {
    res.status(403);
    throw new Error("Not authorized");
  }

  const allowedUpdates = [
    "storeName",
    "description",
    "phone",
    "email",
    "address",
    "documents",
    "bankDetails",
    "logo",
    "banner",
    "storefrontImage",
    "interiorImages",
    "kitchenImages",
    "packagingImages",
    "images",
    "operatingHours",
    "isOpen",
    "deliveryRadius",
    "minOrderValue",
    "ownerDetails",
  ];

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      store[field] = req.body[field];
    }
  });

  if (store.status === "rejected") {
    store.status = "pending";
    store.rejectionReason = undefined;
  }

  await store.save();

  res.json({ success: true, message: "Store updated", data: store });
});

// ====================== ADMIN – PENDING STORES ======================
const getPendingStores = asyncHandler(async (req, res) => {
  const stores = await Store.find({ status: "pending", isDeleted: false })
    .populate("owner", "name email phone")
    .sort({ createdAt: -1 });

  res.json({ success: true, count: stores.length, data: stores });
});

// ====================== ADMIN – ALL STORES ======================
const getAllStores = asyncHandler(async (req, res) => {
  const { status, storeType } = req.query;

  const filter = { isDeleted: false };
  if (status) filter.status = status;
  if (storeType) filter.storeType = storeType;

  const stores = await Store.find(filter)
    .populate("owner", "name email phone")
    .sort({ createdAt: -1 });

  res.json({ success: true, count: stores.length, data: stores });
});

// ====================== ADMIN – UPDATE STATUS ======================
const updateStoreStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;

  if (!["approved", "rejected", "suspended", "blocked"].includes(status)) {
    res.status(400);
    throw new Error("Invalid status. Use: approved, rejected, suspended, blocked");
  }

  const store = await Store.findById(req.params.id);
  if (!store || store.isDeleted) {
    res.status(404);
    throw new Error("Store not found");
  }

  store.status = status;

  if (status === "rejected") {
    store.rejectionReason = reason || "No reason provided";
  }
  if (status === "suspended" || status === "blocked") {
    store.suspensionReason = reason || "No reason provided";
  }
  if (status === "approved") {
    store.rejectionReason = undefined;
    store.suspensionReason = undefined;
  }

  await store.save();

  const io = req.app.get("io");
  if (io && store.owner) {
    io.to(`partner_${store.owner}`).emit("storeStatusUpdated", {
      storeId: store._id,
      status,
      reason,
    });
  }

  if (io) {
    io.to("admin-channel").emit("storeStatusChanged", {
      storeId: store._id,
      storeName: store.storeName,
      status,
    });
  }

  res.json({
    success: true,
    message: `Store ${status} successfully`,
    data: store,
  });
});

module.exports = {
  registerStore,
  getMyStores,
  getStoreById,
  updateStore,
  getPendingStores,
  getAllStores,
  updateStoreStatus,
};