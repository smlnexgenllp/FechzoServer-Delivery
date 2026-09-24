const Store = require("../../models/MarketPlace/Store");
const asyncHandler = require("express-async-handler");
const uploadToCloudinary = require("../../utils/uploadToCloudinary");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

// ============================================================
// HELPERS
// ============================================================

const parseJSON = (value, fallback = {}) => {
  try {
    return typeof value === "string"
      ? JSON.parse(value || "{}")
      : value ?? fallback;
  } catch {
    return fallback;
  }
};

const getFileUrl = async (
  files,
  fieldName,
  folder
) => {
  if (!files?.[fieldName]?.[0]) {
    return null;
  }

  return await uploadToCloudinary(
    files[fieldName][0].buffer,
    folder
  );
};

const getMultipleUrls = async (
  files,
  fieldName,
  folder
) => {
  if (!files?.[fieldName]?.length) {
    return [];
  }

  return Promise.all(
    files[fieldName].map((file) =>
      uploadToCloudinary(
        file.buffer,
        folder
      )
    )
  );
};

// ============================================================
// OPERATING HOURS HELPERS
// ============================================================

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const DEFAULT_OPEN = "09:00";
const DEFAULT_CLOSE = "21:00";

const normalizeOperatingHours = (
  value
) => {
  if (!value) {
    return DAYS.map((day) => ({
      day,
      open: DEFAULT_OPEN,
      close: DEFAULT_CLOSE,
      isClosed: day === "sunday",
    }));
  }

  const parsed =
    typeof value === "string"
      ? parseJSON(value, [])
      : value;

  if (!Array.isArray(parsed)) {
    throw new Error(
      "operatingHours must be an array"
    );
  }

  const map = new Map();

  parsed.forEach((item) => {
    if (!item || !item.day) {
      return;
    }

    const day =
      String(item.day)
        .toLowerCase()
        .trim();

    if (!DAYS.includes(day)) {
      throw new Error(
        `Invalid operating day: ${day}`
      );
    }

    if (map.has(day)) {
      throw new Error(
        `Duplicate operating day: ${day}`
      );
    }

    const isClosed =
      Boolean(item.isClosed);

    const open =
      item.open || DEFAULT_OPEN;

    const close =
      item.close || DEFAULT_CLOSE;

    if (
      !isClosed &&
      (!/^\d{2}:\d{2}$/.test(open) ||
        !/^\d{2}:\d{2}$/.test(close))
    ) {
      throw new Error(
        `Invalid time format for ${day}. Use HH:mm`
      );
    }

    if (!isClosed) {
      const [openHour, openMinute] =
        open.split(":").map(Number);

      const [closeHour, closeMinute] =
        close.split(":").map(Number);

      const openMinutes =
        openHour * 60 + openMinute;

      const closeMinutes =
        closeHour * 60 + closeMinute;

      if (
        closeMinutes <=
        openMinutes
      ) {
        throw new Error(
          `Closing time must be after opening time for ${day}`
        );
      }
    }

    map.set(day, {
      day,
      open,
      close,
      isClosed,
    });
  });

  return DAYS.map((day) => {
    return (
      map.get(day) || {
        day,
        open: DEFAULT_OPEN,
        close: DEFAULT_CLOSE,
        isClosed: day === "sunday",
      }
    );
  });
};

// ============================================================
// REGISTER STORE
// ============================================================

const registerStore =
  asyncHandler(async (req, res) => {
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

    if (username.trim().length < 4) {
      res.status(400);

      throw new Error(
        "Username must be at least 4 characters"
      );
    }

    if (password.length < 6) {
      res.status(400);

      throw new Error(
        "Password must be at least 6 characters"
      );
    }

    const normalizedUsername =
      username.toLowerCase().trim();

    // ======================
    // DUPLICATE STORE
    // ======================

    if (userId) {
      const existing =
        await Store.findOne({
          owner: userId,
          storeName:
            storeName.trim(),
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
    // DUPLICATE USERNAME
    // ======================

    const existingUsername =
      await Store.findOne({
        "loginCredentials.username":
          normalizedUsername,
        isDeleted: false,
      });

    if (existingUsername) {
      res.status(400);

      throw new Error(
        "Username already exists"
      );
    }

    // ======================
    // OPERATING HOURS
    // ======================

    let normalizedOperatingHours;

    try {
      normalizedOperatingHours =
        normalizeOperatingHours(
          operatingHours
        );
    } catch (error) {
      res.status(400);

      throw new Error(
        error.message
      );
    }

    // ======================
    // FILES
    // ======================

    const files = req.files || {};

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
      getFileUrl(
        files,
        "logo",
        "stores/logo"
      ),

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

    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );

    // ======================
    // CREATE STORE
    // ======================

    const store =
      await Store.create({
        owner: userId,

        storeName:
          storeName.trim(),

        loginCredentials: {
          username:
            normalizedUsername,
          password:
            hashedPassword,
        },

        storeType,

        description,

        phone,

        email:
          email.toLowerCase().trim(),

        address:
          parseJSON(address),

        documents: {
          ...parseJSON(
            documents
          ),

          gstCertificate,
          panCard,
          aadhaarCard,
          shopLicense,
          fssaiCertificate,
          cancelledCheque,
          addressProof,
        },

        bankDetails:
          parseJSON(
            bankDetails
          ),

        logo,

        banner,

        storefrontImage,

        interiorImages,

        kitchenImages,

        packagingImages,

        images,

        operatingHours:
          normalizedOperatingHours,

        ownerDetails:
          parseJSON(
            ownerDetails
          ),

        deliveryRadius:
          Number(
            deliveryRadius
          ) || 5,

        minOrderValue:
          Number(
            minOrderValue
          ) || 0,

        status: "pending",
      });

    // ======================
    // NOTIFY ADMIN
    // ======================

    const io =
      req.app.get("io");

    if (io) {
      io.to(
        "admin-channel"
      ).emit(
        "newStoreRegistration",
        {
          storeId:
            store._id,

          storeName:
            store.storeName,

          storeType:
            store.storeType,

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

        storeName:
          store.storeName,

        storeType:
          store.storeType,

        username:
          store.loginCredentials
            .username,

        status:
          store.status,

        operatingHours:
          store.operatingHours,
      },
    });
  });

// ============================================================
// STORE LOGIN
// ============================================================

const storeLogin =
  asyncHandler(
    async (req, res) => {
      const {
        username,
        password,
      } = req.body;

      if (
        !username ||
        !password
      ) {
        res.status(400);

        throw new Error(
          "Username and password are required"
        );
      }

      const normalizedUsername =
        username.toLowerCase().trim();

      const store =
        await Store.findOne({
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

      const isPasswordMatch =
        await bcrypt.compare(
          password,
          store.loginCredentials
            .password
        );

      if (!isPasswordMatch) {
        res.status(401);

        throw new Error(
          "Invalid username or password"
        );
      }

      if (
        store.status !==
        "approved"
      ) {
        res.status(403);

        if (
          store.status ===
          "pending"
        ) {
          throw new Error(
            "Your store is waiting for admin approval"
          );
        }

        if (
          store.status ===
          "rejected"
        ) {
          throw new Error(
            `Your store has been rejected. ${
              store.rejectionReason ||
              "Please contact admin."
            }`
          );
        }

        if (
          store.status ===
          "suspended"
        ) {
          throw new Error(
            `Your store has been suspended. ${
              store.suspensionReason ||
              "Please contact admin."
            }`
          );
        }

        if (
          store.status ===
          "blocked"
        ) {
          throw new Error(
            "Your store has been blocked"
          );
        }

        throw new Error(
          "Store is not approved"
        );
      }

      const token =
        jwt.sign(
          {
            storeId:
              store._id.toString(),

            username:
              store
                .loginCredentials
                .username,

            type: "store",
          },

          process.env.JWT_SECRET,

          {
            expiresIn: "7d",
          }
        );

      res.json({
        success: true,

        message:
          "Store login successful",

        token,

        store: {
          id: store._id,

          storeName:
            store.storeName,

          storeType:
            store.storeType,

          username:
            store
              .loginCredentials
              .username,

          status:
            store.status,

          logo:
            store.logo || null,

          operatingHours:
            store.operatingHours,
        },
      });
    }
  );

// ============================================================
// GET MY STORES
// ============================================================

const getMyStores =
  asyncHandler(
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

// ============================================================
// GET STORE BY ID
// ============================================================

const getStoreById = asyncHandler(async (req, res) => {
  const store = await Store.findById(req.params.id)
    .select("-loginCredentials.password")
    .populate("owner", "name email phone");

  if (!store || store.isDeleted) {
    res.status(404);
    throw new Error("Store not found");
  }

  const requestedStoreId =
    store._id.toString();

  const authenticatedStoreId =
    req.store?._id?.toString();

  const isStoreOwner =
    authenticatedStoreId === requestedStoreId;

  console.log(
    "========== STORE FETCH AUTH =========="
  );

  console.log(
    "Requested Store:",
    requestedStoreId
  );

  console.log(
    "Authenticated Store:",
    authenticatedStoreId
  );

  console.log(
    "req.store exists:",
    !!req.store
  );

  console.log(
    "Is Store Owner:",
    isStoreOwner
  );

  console.log(
    "======================================="
  );

  if (!isStoreOwner) {
    res.status(403);
    throw new Error("Not authorized");
  }

  res.json({
    success: true,
    data: store,
  });
});
// ============================================================
// UPDATE STORE
// ============================================================

const updateStore = asyncHandler(async (req, res) => {

  const store = await Store.findById(
    req.params.id
  );

  if (!store || store.isDeleted) {
    res.status(404);
    throw new Error("Store not found");
  }

  // ============================================================
  // STORE AUTHORIZATION
  // ============================================================

  const requestedStoreId =
    store._id.toString();

  const authenticatedStoreId =
    req.store?._id?.toString();

  const isStoreOwner =
    authenticatedStoreId === requestedStoreId;

  console.log(
    "========== STORE UPDATE AUTH =========="
  );

  console.log(
    "Requested Store:",
    requestedStoreId
  );

  console.log(
    "Authenticated Store:",
    authenticatedStoreId
  );

  console.log(
    "req.store exists:",
    !!req.store
  );

  console.log(
    "Is Store Owner:",
    isStoreOwner
  );

  console.log(
    "========================================"
  );

  if (!isStoreOwner) {
    res.status(403);
    throw new Error("Not authorized");
  }

  // ============================================================
  // GET BODY
  // ============================================================

  const {
    storeName,
    description,
    phone,
    email,
    address,
    operatingHours,
    deliveryRadius,
    minOrderValue,
    isOpen,
  } = req.body;

  // ============================================================
  // UPDATE BASIC DETAILS
  // ============================================================

  if (storeName !== undefined) {
    store.storeName =
      storeName.trim();
  }

  if (description !== undefined) {
    store.description =
      description;
  }

  if (phone !== undefined) {
    store.phone =
      phone;
  }

  if (email !== undefined) {
    store.email =
      email.toLowerCase().trim();
  }

  // ============================================================
  // ADDRESS
  // ============================================================

  if (address !== undefined) {
    store.address =
      parseJSON(address, store.address || {});
  }

  // ============================================================
  // OPERATING HOURS
  // ============================================================

  if (operatingHours !== undefined) {

    try {

      store.operatingHours =
        normalizeOperatingHours(
          operatingHours
        );

    } catch (error) {

      res.status(400);

      throw new Error(
        error.message
      );
    }
  }

  // ============================================================
  // DELIVERY SETTINGS
  // ============================================================

  if (deliveryRadius !== undefined) {
    store.deliveryRadius =
      Number(deliveryRadius);
  }

  if (minOrderValue !== undefined) {
    store.minOrderValue =
      Number(minOrderValue);
  }

  if (isOpen !== undefined) {
    store.isOpen =
      Boolean(isOpen);
  }

  // ============================================================
  // LOGO / BANNER
  // ============================================================

  const files =
    req.files || {};

  if (files.logo?.[0]) {

    store.logo =
      await uploadToCloudinary(
        files.logo[0].buffer,
        "stores/logo"
      );
  }

  if (files.banner?.[0]) {

    store.banner =
      await uploadToCloudinary(
        files.banner[0].buffer,
        "stores/banner"
      );
  }

  // ============================================================
  // SAVE
  // ============================================================

  await store.save();

  // ============================================================
  // RESPONSE
  // ============================================================

  const updatedStore =
    await Store.findById(store._id)
      .select(
        "-loginCredentials.password"
      )
      .populate(
        "owner",
        "name email phone"
      );

  res.json({
    success: true,

    message:
      "Store updated successfully",

    data: updatedStore,
  });
});
// ============================================================
// ADMIN – PENDING STORES
// ============================================================

const getPendingStores =
  asyncHandler(
    async (req, res) => {
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
    }
  );

// ============================================================
// ADMIN – ALL STORES
// ============================================================

const getAllStores =
  asyncHandler(
    async (req, res) => {
      const {
        status,
        storeType,
      } = req.query;

      const filter = {
        isDeleted: false,
      };

      if (status) {
        filter.status =
          status;
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
    }
  );

// ============================================================
// ADMIN – UPDATE STATUS
// ============================================================

const updateStoreStatus =
  asyncHandler(
    async (req, res) => {
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

      if (
        !store ||
        store.isDeleted
      ) {
        res.status(404);

        throw new Error(
          "Store not found"
        );
      }

      store.status = status;

      if (
        status ===
        "rejected"
      ) {
        store.rejectionReason =
          reason ||
          "No reason provided";
      }

      if (
        status ===
          "suspended" ||
        status === "blocked"
      ) {
        store.suspensionReason =
          reason ||
          "No reason provided";
      }

      if (
        status ===
        "approved"
      ) {
        store.rejectionReason =
          "";

        store.suspensionReason =
          "";
      }

      await store.save();

      const io =
        req.app.get("io");

      if (
        io &&
        store.owner
      ) {
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
    }
  );

// ============================================================
// EXPORTS
// ============================================================

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