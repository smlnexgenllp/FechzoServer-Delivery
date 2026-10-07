const asyncHandler = require("express-async-handler");
const Store = require("../../models/MarketPlace/Store");
const formatPublicStore = (store) => {
  if (!store) {
    return null;
  }
  return {
    _id: store._id,
    storeName: store.storeName,
    storeType: store.storeType,
    description: store.description || "",
    phone: store.phone || "",
    email: store.email || "",
    address: {
      street: store.address?.street || "",
      city: store.address?.city || "",
      state: store.address?.state || "",
      pincode: store.address?.pincode || "",
      landmark: store.address?.landmark || "",
      fullAddress:
        store.address?.fullAddress || "",
      coordinates:
        store.address?.coordinates || {
          type: "Point",
          coordinates: [0, 0],
        },
    },
    logo: store.logo || null,
    banner: store.banner || null,
    storefrontImage:
      store.storefrontImage || null,
    interiorImages:
      store.interiorImages || [],
    kitchenImages:
      store.kitchenImages || [],
    packagingImages:
      store.packagingImages || [],
    images:
      store.images || [],
    status: store.status,
    isOpen:
      store.isOpen === true,
    operatingHours:
      Array.isArray(store.operatingHours)
        ? store.operatingHours.map((item) => ({
            _id: item._id,
            day: item.day,
            open: item.open,
            close: item.close,
            isClosed:
              item.isClosed === true,
          }))
        : [],
    deliveryRadius:
      Number(store.deliveryRadius || 0),
    minOrderValue:
      Number(store.minOrderValue || 0),
    allowedCategories:
      store.allowedCategories || [],
    createdAt: store.createdAt,
    updatedAt: store.updatedAt,
  };
};
const getStoresByType =
  asyncHandler(async (req, res) => {
    const {
      storeType,
      city,
    } = req.query;
    
    const filter = {
      status: "approved",
      isDeleted: false,
    };
    if (storeType) {
      const normalizedType =
        String(storeType)
          .toLowerCase()
          .trim();
      if (
        normalizedType === "electronic"
      ) {
        filter.storeType =
          "electronics";
      } else {
        filter.storeType =
          normalizedType;
      }
    }
    if (city) {
      filter[
        "address.city"
      ] = new RegExp(
        `^${String(city).trim()}$`,
        "i"
      );
    }
    const stores =
      await Store.find(filter)
        .select(
          "-loginCredentials.password"
        )
        .sort({
          createdAt: -1,
        })
        .lean();
    const formattedStores =
      stores.map(
        formatPublicStore
      );
    res.json({
      success: true,
      count:
        formattedStores.length,
      data:
        formattedStores,
    });
  });
const getAllApprovedStores =
  asyncHandler(async (req, res) => {
    const stores =
      await Store.find({
        status: "approved",
        isDeleted: false,
      })
        .select(
          "-loginCredentials.password"
        )
        .sort({
          createdAt: -1,
        })
        .lean();
    const formattedStores =
      stores.map(
        formatPublicStore
      );
    res.json({
      success: true,
      count:
        formattedStores.length,
      data:
        formattedStores,
    });
  });
const getPublicStoreById =
  asyncHandler(async (req, res) => {
    const store =
      await Store.findOne({
        _id: req.params.id,
        status: "approved",
        isDeleted: false,
      })
        .select(
          "-loginCredentials.password"
        )
        .lean();
    if (!store) {
      res.status(404);
      throw new Error(
        "Store not found"
      );
    }
    const formattedStore =
      formatPublicStore(store);
    res.json({
      success: true,
      data:
        formattedStore,
    });
  });
module.exports = {
  getStoresByType,
  getStoreById:
  getPublicStoreById,
  getAllApprovedStores,
};