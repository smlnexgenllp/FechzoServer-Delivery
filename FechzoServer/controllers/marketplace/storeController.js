const Store = require('../../models/marketplace/Store');
const asyncHandler = require('express-async-handler'); // or your own wrapper

const registerStore = asyncHandler(async (req, res) => {
  const {
    storeName,
    storeType,
    description,
    phone,
    email,
    address,
    documents,
    bankDetails,
    logo,
    banner,
    images,
    operatingHours,
  } = req.body;

  if (!storeName || !storeType || !phone || !email) {
    res.status(400);
    throw new Error("storeName, storeType, phone and email are required");
  }

  const store = await Store.create({
    // owner is optional for now (or you can later link it after login)
    storeName,
    storeType,
    description,
    phone,
    email,
    address,
    documents,
    bankDetails,
    logo,
    banner,
    images,
    operatingHours,
    status: "pending",
  });

  // Optional: notify admin
  const io = req.app.get("io");
  if (io) {
    io.to("admin-channel").emit("newStoreRegistration", {
      storeId: store._id,
      storeName: store.storeName,
      storeType: store.storeType,
    });
  }

  res.status(201).json({
    success: true,
    message: "Store registration submitted. Waiting for admin approval.",
    data: store,
  });
});

// @desc    Get my stores
// @route   GET /api/stores/my
// @access  Private
const getMyStores = asyncHandler(async (req, res) => {
  const stores = await Store.find({
    owner: req.user._id,
    isDeleted: false,
  }).sort({ createdAt: -1 });

  res.json({ success: true, data: stores });
});

// @desc    Get single store (owner or admin)
// @route   GET /api/stores/:id
// @access  Private
const getStoreById = asyncHandler(async (req, res) => {
  const store = await Store.findById(req.params.id).populate('owner', 'name email phone');

  if (!store || store.isDeleted) {
    res.status(404);
    throw new Error('Store not found');
  }

  // Owner or admin only
  if (
    store.owner._id.toString() !== req.user._id.toString() &&
    req.user.role !== 'admin'
  ) {
    res.status(403);
    throw new Error('Not authorized');
  }

  res.json({ success: true, data: store });
});

// @desc    Update store (owner can update only while pending / approved)
// @route   PUT /api/stores/:id
// @access  Private
const updateStore = asyncHandler(async (req, res) => {
  const store = await Store.findById(req.params.id);

  if (!store || store.isDeleted) {
    res.status(404);
    throw new Error('Store not found');
  }

  if (store.owner.toString() !== req.user._id.toString()) {
    res.status(403);
    throw new Error('Not authorized');
  }

  // Prevent changing critical fields after approval if you want
  const allowedUpdates = [
    'storeName', 'description', 'phone', 'email',
    'address', 'documents', 'bankDetails',
    'logo', 'banner', 'images', 'operatingHours', 'isOpen',
  ];

  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) {
      store[field] = req.body[field];
    }
  });

  // If previously rejected, reset to pending on re-submit
  if (store.status === 'rejected') {
    store.status = 'pending';
    store.rejectionReason = undefined;
  }

  await store.save();

  res.json({ success: true, message: 'Store updated', data: store });
});

// @desc    Admin – list all pending stores
// @route   GET /api/stores/admin/pending
// @access  Admin
const getPendingStores = asyncHandler(async (req, res) => {
  const stores = await Store.find({ status: 'pending', isDeleted: false })
    .populate('owner', 'name email phone')
    .sort({ createdAt: -1 });

  res.json({ success: true, data: stores });
});

// @desc    Admin – approve / reject / suspend
// @route   PATCH /api/stores/admin/:id/status
// @access  Admin
const updateStoreStatus = asyncHandler(async (req, res) => {
  const { status, reason } = req.body;

  if (!['approved', 'rejected', 'suspended', 'blocked'].includes(status)) {
    res.status(400);
    throw new Error('Invalid status');
  }

  const store = await Store.findById(req.params.id);
  if (!store) {
    res.status(404);
    throw new Error('Store not found');
  }

  store.status = status;
  if (status === 'rejected') store.rejectionReason = reason;
  if (status === 'suspended' || status === 'blocked') store.suspensionReason = reason;

  await store.save();

  // Notify the store owner via socket
  const io = req.app.get('io');
  if (io) {
    io.to(`partner_${store.owner}`).emit('storeStatusUpdated', {
      storeId: store._id,
      status,
      reason,
    });
  }

  res.json({ success: true, message: `Store ${status}`, data: store });
});

module.exports = {
  registerStore,
  getMyStores,
  getStoreById,
  updateStore,
  getPendingStores,
  updateStoreStatus,
};