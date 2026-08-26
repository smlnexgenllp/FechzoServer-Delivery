const Store = require("../../models/MarketPlace/Store");
const asyncHandler = require("express-async-handler");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ====================== HELPERS ======================

const parseJSON = (value, fallback = {}) => {
  try {
    return typeof value === "string"
      ? JSON.parse(value || "{}")
      : value || fallback;
  } catch {
    return fallback;
  }
};

const getFileUrl = async (files, fieldName, folder) => {
  if (!files?.[fieldName]?.[0]) return null;

  return await uploadToCloudinary(
    files[fieldName][0].buffer,
    folder
  );
};

const getMultipleUrls = async (files, fieldName, folder) => {
  if (!files?.[fieldName]?.length) return [];

  return Promise.all(
    files[fieldName].map((file) =>
      uploadToCloudinary(file.buffer, folder)
    )
  );
};

// ====================== REGISTER STORE (PUBLIC) ======================
// @desc    Register a new store
// @route   POST /api/stores/register
// @access  Public

const registerStore = asyncHandler(async (req, res) => {
  // Safe – works even if user is not logged in
  const userId =
    req.user?._id ||
    req.user?.id ||
    req.user?.adminId ||
    null;

  const {
    storeName,
    storeType,
    description,
    phone,
    email,
    username,
    password,
    address,
    documents,
    bankDetails,
    operatingHours,
    ownerDetails,
    deliveryRadius,
    minOrderValue,
  } = req.body;

  // ======================
  // VALIDATION
  // ======================

  if (
    !storeName ||
    !storeType ||
    !phone ||
    !email ||
    !username ||
    !password
  ) {
    res.status(400);

    throw new Error(
      "storeName, storeType, phone, email, username and password are required"
    );
  }

  // Username minimum validation
  if (username.trim().length < 4) {
    res.status(400);
    throw new Error("Username must be at least 4 characters");
  }

  // Password minimum validation
  if (password.length < 6) {
    res.status(400);
    throw new Error("Password must be at least 6 characters");
  }

  const normalizedUsername = username
    .toLowerCase()
    .trim();

  // ======================
  // DUPLICATE STORE CHECK
  // ======================

  if (userId) {
    const existing = await Store.findOne({
      owner: userId,
      storeName: storeName.trim(),
      isDeleted: false,
    });

    if (existing) {
      res.status(400);
      throw new Error(
        "You already have a store with this name"
      );
    }
  }

  // ======================
  // DUPLICATE USERNAME CHECK
  // ======================

  const existingUsername = await Store.findOne({
    "loginCredentials.username": normalizedUsername,
    isDeleted: false,
  });

  if (existingUsername) {
    res.status(400);
    throw new Error("Username already exists");
  }

  // ======================
  // FILES
  // ======================

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

    getFileUrl(
      files,
      "banner",
      "stores/banner"
    ),

    getFileUrl(
      files,
      "storefrontImage",
      "stores/storefront"
    ),

    getMultipleUrls(
      files,
      "interiorImages",
      "stores/interior"
    ),

    getMultipleUrls(
      files,
      "kitchenImages",
      "stores/kitchen"
    ),

    getMultipleUrls(
      files,
      "packagingImages",
      "stores/packaging"
    ),

    getMultipleUrls(
      files,
      "images",
      "stores/gallery"
    ),

    getFileUrl(
      files,
      "gstCertificate",
      "stores/documents"
    ),

    getFileUrl(
      files,
      "panCard",
      "stores/documents"
    ),

    getFileUrl(
      files,
      "aadhaarCard",
      "stores/documents"
    ),

    getFileUrl(
      files,
      "shopLicense",
      "stores/documents"
    ),

    getFileUrl(
      files,
      "fssaiCertificate",
      "stores/documents"
    ),

    getFileUrl(
      files,
      "cancelledCheque",
      "stores/documents"
    ),

    getFileUrl(
      files,
      "addressProof",
      "stores/documents"
    ),
  ]);

  // ======================
  // HASH PASSWORD
  // ======================

  const hashedPassword = await bcrypt.hash(
    password,
    10
  );

  // ======================
  // CREATE STORE
  // ======================

  const store = await Store.create({
    owner: userId,

    storeName: storeName.trim(),

    loginCredentials: {
      username: normalizedUsername,
      password: hashedPassword,
    },

    storeType,

    description,

    phone,

    email: email.toLowerCase().trim(),

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

    operatingHours: parseJSON(
      operatingHours,
      []
    ),

    ownerDetails: parseJSON(
      ownerDetails
    ),

    deliveryRadius:
      Number(deliveryRadius) || 5,

    minOrderValue:
      Number(minOrderValue) || 0,

    // New stores always need admin approval
    status: "pending",
  });

  // ======================
  // NOTIFY ADMIN
  // ======================

  const io = req.app.get("io");

  if (io) {
    io.to("admin-channel").emit(
      "newStoreRegistration",
      {
        storeId: store._id,
        storeName: store.storeName,
        storeType: store.storeType,
        ownerId: userId,
      }
    );
  }

  // ======================
  // RESPONSE
  // ======================

  res.status(201).json({
    success: true,

    message:
      "Store registration submitted. Waiting for admin approval.",

    data: {
      _id: store._id,
      storeName: store.storeName,
      storeType: store.storeType,
      username:
        store.loginCredentials.username,
      status: store.status,
    },
  });
});

// ====================== STORE LOGIN ======================
// @desc    Store login using username/password
// @route   POST /api/stores/auth/login
// @access  Public

const storeLogin = asyncHandler(
  async (req, res) => {
    const { username, password } = req.body;

    // ======================
    // VALIDATION
    // ======================

    if (!username || !password) {
      res.status(400);

      throw new Error(
        "Username and password are required"
      );
    }

    const normalizedUsername =
      username.toLowerCase().trim();

    // ======================
    // FIND STORE
    // ======================

    const store = await Store.findOne({
      "loginCredentials.username":
        normalizedUsername,

      isDeleted: false,
    });

    if (!store) {
      res.status(401);

      throw new Error(
        "Invalid username or password"
      );
    }

    // ======================
    // PASSWORD CHECK
    // ======================

    const isPasswordMatch =
      await bcrypt.compare(
        password,
        store.loginCredentials.password
      );

    if (!isPasswordMatch) {
      res.status(401);

      throw new Error(
        "Invalid username or password"
      );
    }

    // ======================
    // STORE STATUS CHECK
    // ======================

    if (store.status !== "approved") {
      res.status(403);

      if (store.status === "pending") {
        throw new Error(
          "Your store is waiting for admin approval"
        );
      }

      if (store.status === "rejected") {
        throw new Error(
          `Your store has been rejected. ${
            store.rejectionReason ||
            "Please contact admin."
          }`
        );
      }

      if (store.status === "suspended") {
        throw new Error(
          `Your store has been suspended. ${
            store.suspensionReason ||
            "Please contact admin."
          }`
        );
      }

      if (store.status === "blocked") {
        throw new Error(
          "Your store has been blocked"
        );
      }

      throw new Error(
        "Store is not approved"
      );
    }

    // ======================
    // CREATE JWT
    // ======================

    const token = jwt.sign(
      {
        storeId: store._id.toString(),

        username:
          store.loginCredentials.username,

        type: "store",
      },

      process.env.JWT_SECRET,

      {
        expiresIn: "7d",
      }
    );

    // ======================
    // LOGIN RESPONSE
    // ======================

    res.json({
      success: true,

      message: "Store login successful",

      token,

      store: {
        id: store._id,

        storeName:
          store.storeName,

        storeType:
          store.storeType,

        username:
          store.loginCredentials.username,

        status:
          store.status,

        logo:
          store.logo || null,
      },
    });
  }
);

// ====================== GET MY STORES ======================

const getMyStores = asyncHandler(
  async (req, res) => {
    const userId =
      req.user?._id ||
      req.user?.id ||
      req.user?.adminId;

    if (!userId) {
      res.status(401);

      throw new Error(
        "Not authorized"
      );
    }

    const stores =
      await Store.find({
        owner: userId,
        isDeleted: false,
      }).sort({
        createdAt: -1,
      });

    res.json({
      success: true,
      count: stores.length,
      data: stores,
    });
  }
);

// ====================== GET STORE BY ID ======================

const getStoreById = asyncHandler(
  async (req, res) => {
    const store =
      await Store.findById(
        req.params.id
      )
        .select(
          "-loginCredentials.password"
        )
        .populate(
          "owner",
          "name email phone"
        );

    if (!store || store.isDeleted) {
      res.status(404);

      throw new Error(
        "Store not found"
      );
    }

    const userId = (
      req.user?._id ||
      req.user?.id ||
      req.user?.adminId
    )?.toString();

    const isOwner =
      store.owner &&
      store.owner._id?.toString() ===
        userId;

    const isAdmin =
      req.user?.role === "admin";

    if (!isOwner && !isAdmin) {
      res.status(403);

      throw new Error(
        "Not authorized"
      );
    }

    res.json({
      success: true,
      data: store,
    });
  }
);

// ====================== UPDATE STORE ======================

const updateStore = asyncHandler(
  async (req, res) => {
    const store =
      await Store.findById(
        req.params.id
      );

    if (!store || store.isDeleted) {
      res.status(404);

      throw new Error(
        "Store not found"
      );
    }

    const userId = (
      req.user?._id ||
      req.user?.id ||
      req.user?.adminId
    )?.toString();

    const isOwner =
      store.owner &&
      store.owner.toString() ===
        userId;

    const isAdmin =
      req.user?.role === "admin";

    if (!isOwner && !isAdmin) {
      res.status(403);

      throw new Error(
        "Not authorized"
      );
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

    allowedUpdates.forEach(
      (field) => {
        if (
          req.body[field] !==
          undefined
        ) {
          store[field] =
            req.body[field];
        }
      }
    );

    // If rejected store is updated,
    // send it back for approval
    if (
      store.status === "rejected"
    ) {
      store.status = "pending";

      store.rejectionReason =
        undefined;
    }

    await store.save();

    res.json({
      success: true,

      message:
        "Store updated",

      data: store,
    });
  }
);

// ====================== ADMIN – PENDING STORES ======================

const getPendingStores =
  asyncHandler(async (req, res) => {
    const stores =
      await Store.find({
        status: "pending",
        isDeleted: false,
      })
        .populate(
          "owner",
          "name email phone"
        )
        .select(
          "-loginCredentials.password"
        )
        .sort({
          createdAt: -1,
        });

    res.json({
      success: true,
      count: stores.length,
      data: stores,
    });
  });

// ====================== ADMIN – ALL STORES ======================

const getAllStores =
  asyncHandler(async (req, res) => {
    const {
      status,
      storeType,
    } = req.query;

    const filter = {
      isDeleted: false,
    };

    if (status) {
      filter.status = status;
    }

    if (storeType) {
      filter.storeType =
        storeType;
    }

    const stores =
      await Store.find(filter)
        .populate(
          "owner",
          "name email phone"
        )
        .select(
          "-loginCredentials.password"
        )
        .sort({
          createdAt: -1,
        });

    res.json({
      success: true,
      count: stores.length,
      data: stores,
    });
  });

// ====================== ADMIN – UPDATE STATUS ======================

const updateStoreStatus =
  asyncHandler(async (req, res) => {
    const {
      status,
      reason,
    } = req.body;

    if (
      ![
        "approved",
        "rejected",
        "suspended",
        "blocked",
      ].includes(status)
    ) {
      res.status(400);

      throw new Error(
        "Invalid status. Use: approved, rejected, suspended, blocked"
      );
    }

    const store =
      await Store.findById(
        req.params.id
      );

    if (!store || store.isDeleted) {
      res.status(404);

      throw new Error(
        "Store not found"
      );
    }

    store.status = status;

    // ======================
    // REJECTED
    // ======================

    if (status === "rejected") {
      store.rejectionReason =
        reason ||
        "No reason provided";
    }

    // ======================
    // SUSPENDED / BLOCKED
    // ======================

    if (
      status === "suspended" ||
      status === "blocked"
    ) {
      store.suspensionReason =
        reason ||
        "No reason provided";
    }

    // ======================
    // APPROVED
    // ======================

    if (status === "approved") {
      store.rejectionReason =
        undefined;

      store.suspensionReason =
        undefined;
    }

    await store.save();

    // ======================
    // SOCKET NOTIFICATION
    // ======================

    const io =
      req.app.get("io");

    if (io && store.owner) {
      io.to(
        `partner_${store.owner}`
      ).emit(
        "storeStatusUpdated",
        {
          storeId:
            store._id,

          status,

          reason,
        }
      );
    }

    if (io) {
      io.to(
        "admin-channel"
      ).emit(
        "storeStatusChanged",
        {
          storeId:
            store._id,

          storeName:
            store.storeName,

          status,
        }
      );
    }

    // ======================
    // RESPONSE
    // ======================

    res.json({
      success: true,

      message:
        `Store ${status} successfully`,

      data: {
        _id: store._id,

        storeName:
          store.storeName,

        storeType:
          store.storeType,

        username:
          store.loginCredentials
            ?.username,

        status:
          store.status,

        rejectionReason:
          store.rejectionReason,

        suspensionReason:
          store.suspensionReason,
      },
    });
  });

// ====================== EXPORTS ======================

module.exports = {
  registerStore,
  storeLogin,
  getMyStores,
  getStoreById,
  updateStore,
  getPendingStores,
  getAllStores,
  updateStoreStatus,
};