const mongoose = require("mongoose");
const Restaurant = require("../../../models/restaurants/shops/RestaurantDetails");
const cloudinary = require("../../../config/cloudinary");

const getRestaurantAbout = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[getRestaurantAbout] Fetching data for restaurantId: ${id}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.warn(`[getRestaurantAbout] Invalid restaurantId: ${id}`);
      return res.status(400).json({ message: "Invalid restaurant ID format" });
    }

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      console.warn(`[getRestaurantAbout] Restaurant not found: ${id}`);
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const aboutData = {
      restaurantId: restaurant.restaurantId || "",
      restaurantName: restaurant.restaurantName || "",
      restaurantAddress: {
        shopNumber: restaurant.restaurantAddress.shopNumber || "",
        area: restaurant.restaurantAddress.area || "",
        city: restaurant.restaurantAddress.city || "",
        postalCode: restaurant.restaurantAddress.postalCode || "",
        state: restaurant.restaurantAddress.state || "",
        landmark: restaurant.restaurantAddress.landmark || "",
      },
      cuisines: restaurant.cuisines || [],
      profileImage: restaurant.images?.profile || "",
      profileImageApprovalStatus: restaurant.profileImageApprovalStatus || "Pending",
      mapLink: restaurant.mapLink || "",
      specialties: restaurant.specialties || [],
      aboutUs: restaurant.aboutUs || "",
      ourStory: restaurant.ourStory || { title: "", description: "" },
      createdAt: restaurant.createdAt || "",
      requestedTitle: restaurant.requestedTitle || "",
      outletNameApprovalStatus: restaurant.outletNameApprovalStatus || "Pending",
      titleChangeRequests: restaurant.titleChangeRequests || [],
    };

    console.log(`[getRestaurantAbout] Successfully fetched data for restaurantId: ${id}`);
    res.status(200).json(aboutData);
  } catch (error) {
    console.error(`[getRestaurantAbout] Error: ${error.message}`, error.stack);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const updateRestaurantAbout = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[updateRestaurantAbout] Updating data for restaurantId: ${id}`);
    const {
      restaurantName,
      restaurantAddress,
      cuisines,
      mapLink,
      specialties,
      aboutUs,
      ourStory,
      createdAt,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.warn(`[updateRestaurantAbout] Invalid restaurantId: ${id}`);
      return res.status(400).json({ message: "Invalid restaurant ID format" });
    }

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      console.warn(`[updateRestaurantAbout] Restaurant not found: ${id}`);
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (restaurantName) restaurant.restaurantName = restaurantName;
    if (restaurantAddress) {
      if (
        !restaurantAddress.shopNumber ||
        !restaurantAddress.area ||
        !restaurantAddress.city ||
        !restaurantAddress.state ||
        !restaurantAddress.postalCode
      ) {
        console.warn("[updateRestaurantAbout] Incomplete address data");
        return res.status(400).json({
          message: "Address must include shopNumber, area, city, state, and postalCode",
        });
      }
      if (!/^\d{6}$/.test(restaurantAddress.postalCode)) {
        console.warn("[updateRestaurantAbout] Invalid postal code");
        return res.status(400).json({ message: "Postal code must be 6 digits" });
      }
      restaurant.restaurantAddress = {
        shopNumber: restaurantAddress.shopNumber,
        area: restaurantAddress.area,
        city: restaurantAddress.city,
        state: restaurantAddress.state,
        postalCode: restaurantAddress.postalCode,
        landmark: restaurantAddress.landmark || "",
      };
    }
    if (cuisines) restaurant.cuisines = cuisines;
    if (mapLink) restaurant.mapLink = mapLink;
    if (specialties) restaurant.specialties = specialties;
    if (aboutUs) restaurant.aboutUs = aboutUs;
    if (ourStory) restaurant.ourStory = ourStory;
    if (createdAt) restaurant.createdAt = createdAt;

    await restaurant.save();
    console.log(`[updateRestaurantAbout] Successfully updated restaurantId: ${id}`);

    const updatedData = {
      restaurantId: restaurant.restaurantId,
      restaurantName: restaurant.restaurantName,
      restaurantAddress: restaurant.restaurantAddress,
      cuisines: restaurant.cuisines,
      profileImage: restaurant.images?.profile,
      profileImageApprovalStatus: restaurant.profileImageApprovalStatus,
      mapLink: restaurant.mapLink,
      specialties: restaurant.specialties,
      aboutUs: restaurant.aboutUs,
      ourStory: restaurant.ourStory,
      createdAt: restaurant.createdAt,
      requestedTitle: restaurant.requestedTitle,
      outletNameApprovalStatus: restaurant.outletNameApprovalStatus,
      titleChangeRequests: restaurant.titleChangeRequests,
    };

    res.status(200).json(updatedData);
  } catch (error) {
    console.error(`[updateRestaurantAbout] Error: ${error.message}`, error.stack);
    res.status(400).json({ message: error.message });
  }
};

const uploadProfileImage = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    console.log(`[uploadProfileImage] Request received for restaurantId: ${id}`, {
      reason,
      file: req.file ? req.file.originalname : "No file",
      mimetype: req.file ? req.file.mimetype : "No mimetype",
      size: req.file ? req.file.size : "No size",
    });

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.warn(`[uploadProfileImage] Invalid restaurantId: ${id}`);
      return res.status(400).json({ message: "Invalid restaurant ID format" });
    }

    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      console.warn("[uploadProfileImage] Reason is missing or invalid");
      return res.status(400).json({ message: "Reason for image change is required" });
    }

    if (!req.file) {
      console.warn("[uploadProfileImage] No image file provided");
      return res.status(400).json({ message: "No image file provided" });
    }

    // Upload to Cloudinary using buffer
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: `restaurants/${id}/profile/pending`,
          public_id: `profile_${Date.now()}`,
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    const imageUrl = result.secure_url;
    console.log(`[uploadProfileImage] Image uploaded to Cloudinary: ${imageUrl}`);

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      console.warn(`[uploadProfileImage] Restaurant not found for ID: ${id}`);
      return res.status(404).json({ message: "Restaurant not found" });
    }
    const hasPendingImageRequest = restaurant.titleChangeRequests?.some(
      req => req.requestType === "profileImage" && req.status === "Pending"
    );

    if (hasPendingImageRequest) {
      return res.status(400).json({ 
        message: "A profile image change request is already pending. Please wait for admin approval." 
      });
    }

    restaurant.titleChangeRequests = restaurant.titleChangeRequests || [];
    restaurant.titleChangeRequests.push({
      requestType: "profileImage",
      imageUrl,
      reason: reason.trim(),
      status: "Pending",
      createdAt: new Date(),
    });
    restaurant.profileImageApprovalStatus = "Pending";

    await restaurant.save();
    console.log(`[uploadProfileImage] Title change request added for restaurantId: ${id}`);

    res.status(200).json({
      message: "Profile image request submitted successfully",
      imageUrl,
      profileImageApprovalStatus: restaurant.profileImageApprovalStatus,
      titleChangeRequests: restaurant.titleChangeRequests,
    });
  } catch (error) {
    console.error(`[uploadProfileImage] Error: ${error.message}`, error.stack);
    if (error.message === "Only image files are allowed") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({
      message: "Error uploading profile image",
      error: error.message,
    });
  }
};

const requestTitleChange = async (req, res) => {
  try {
    const { id } = req.params;
    const { newTitle, reason } = req.body;
    console.log(`[requestTitleChange] Request received for restaurantId: ${id}`, {
      newTitle,
      reason,
    });

    // Validate inputs
    if (!newTitle || typeof newTitle !== "string" || newTitle.trim() === "") {
      console.warn("[requestTitleChange] New title is missing or invalid");
      return res.status(400).json({ message: "New title is required" });
    }
    if (!reason || typeof reason !== "string" || reason.trim() === "") {
      console.warn("[requestTitleChange] Reason is missing or invalid");
      return res.status(400).json({ message: "Reason for title change is required" });
    }

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      console.warn(`[requestTitleChange] Restaurant not found: ${id}`);
      return res.status(404).json({ message: "Restaurant not found" });
    }
     // Check for pending title change requests
     const hasPendingTitleRequest = restaurant.titleChangeRequests?.some(
      req => req.requestType === "title" && req.status === "Pending"
    );

    if (hasPendingTitleRequest) {
      return res.status(400).json({ 
        message: "A title change request is already pending. Please wait for admin approval." 
      });
    }

    restaurant.titleChangeRequests = restaurant.titleChangeRequests || [];
    restaurant.titleChangeRequests.push({
      requestType: "title",
      newTitle: newTitle.trim(),
      reason: reason.trim(),
      status: "Pending",
      createdAt: new Date(),
    });
    restaurant.requestedTitle = newTitle.trim();
    restaurant.outletNameApprovalStatus = "Pending";

    await restaurant.save();
    console.log(`[requestTitleChange] Title change request added for restaurantId: ${id}`);

    res.status(200).json({
      message: "Title change request submitted successfully",
      requestedTitle: newTitle,
      outletNameApprovalStatus: restaurant.outletNameApprovalStatus,
      titleChangeRequests: restaurant.titleChangeRequests,
    });
  } catch (error) {
    console.error(`[requestTitleChange] Error: ${error.message}`, error.stack);
    res.status(500).json({
      message: "Error submitting title change request",
      error: error.message,
    });
  }
};

const handleAboutApproval = async (req, res) => {
  try {
    const { restaurantId, requestId, status, reason } = req.body;
    console.log(`[handleAboutApproval] Received:`, { restaurantId, requestId, status, reason });

    // Validate inputs
    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      console.warn(`[handleAboutApproval] Invalid restaurantId: ${restaurantId}`);
      return res.status(400).json({ message: "Invalid restaurant ID format" });
    }
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      console.warn(`[handleAboutApproval] Invalid requestId: ${requestId}`);
      return res.status(400).json({ message: "Invalid request ID format" });
    }
    if (!["Approved", "Rejected"].includes(status)) {
      console.warn(`[handleAboutApproval] Invalid status: ${status}`);
      return res.status(400).json({
        message: "Invalid status. Must be 'Approved' or 'Rejected'",
      });
    }
    if (status === "Rejected" && (!reason || reason.trim() === "")) {
      console.warn("[handleAboutApproval] Rejection reason missing");
      return res.status(400).json({ message: "Rejection reason is required" });
    }

    // Find restaurant
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      console.warn(`[handleAboutApproval] Restaurant not found: ${restaurantId}`);
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Find request
    const request = restaurant.titleChangeRequests.id(requestId);
    if (!request) {
      console.warn(`[handleAboutApproval] Request not found: ${requestId}`);
      return res.status(404).json({ message: "Request not found" });
    }

    // Update request
    request.status = status;
    if (status === "Rejected") {
      request.rejectionReason = reason;
    }

    // Update restaurant fields
    if (status === "Approved") {
      if (request.requestType === "title") {
        restaurant.restaurantName = request.newTitle;
        restaurant.requestedTitle = null;
        restaurant.outletNameApprovalStatus = "Approved";
      } else if (request.requestType === "profileImage") {
        restaurant.images = restaurant.images || {};
        restaurant.images.profile = request.imageUrl;
        restaurant.profileImageApprovalStatus = "Approved";
      }
    } else {
      if (request.requestType === "title") {
        restaurant.requestedTitle = null;
        restaurant.outletNameApprovalStatus = "Rejected";
      } else if (request.requestType === "profileImage") {
        restaurant.profileImageApprovalStatus = "Rejected";
      }
    }

    await restaurant.save();
    console.log(`[handleAboutApproval] Request ${status} for restaurantId: ${restaurantId}`);

    res.status(200).json({
      message: `${request.requestType} ${status.toLowerCase()} successfully`,
      status,
      reason: status === "Rejected" ? reason : null,
      restaurant: {
        restaurantName: restaurant.restaurantName,
        images: restaurant.images,
        outletNameApprovalStatus: restaurant.outletNameApprovalStatus,
        profileImageApprovalStatus: restaurant.profileImageApprovalStatus,
        titleChangeRequests: restaurant.titleChangeRequests,
      },
    });
  } catch (error) {
    console.error(`[handleAboutApproval] Error: ${error.message}`, error.stack);
    res.status(500).json({
      message: "Error processing approval",
      error: error.message,
    });
  }
};

module.exports = {
  getRestaurantAbout,
  updateRestaurantAbout,
  uploadProfileImage,
  requestTitleChange,
  handleAboutApproval,
};