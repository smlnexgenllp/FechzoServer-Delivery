const Restaurant = require('../../models/restaurants/shops/RestaurantDetails');
const mongoose = require('mongoose');
const cloudinary = require('../../config/cloudinary');
// Import the createNotification function
const { createNotification } = require('../admin/NotificationController');

// Helper function to upload image buffer to Cloudinary
const uploadBufferToCloudinary = async (buffer, folder) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream({ folder }, (error, result) => {
      if (error) return reject(error);
      resolve(result.secure_url);
    }).end(buffer);
  });
};

const createRestaurant = async (req, res) => {
  try {
    console.log("🔔 [INFO] Restaurant registration request received");

    const parsedData = JSON.parse(req.body.restaurantData);

    const {
      restaurantId,
      restaurantName,
      ownerDetails,
      restaurantAddress,
      cuisines,
      timings,
      services,
      legalDetails,
      bankDetails,
      managerDetails,
      isBranch = false, // Default to false if not provided
      parentRestaurant,
    } = parsedData;

    // Validate restaurantAddress.state
    if (!restaurantAddress || !restaurantAddress.state) {
      throw new Error("Restaurant address state is required");
    }

    // Validate services
    if (!services || !Array.isArray(services) || services.length === 0) {
      throw new Error("At least one service type must be selected");
    }

    // NEW: Validate delivery implies takeaway rule
    if (services.includes("delivery") && !services.includes("takeaway")) {
      throw new Error("Takeaway service is required when delivery service is enabled");
    }

    // NEW: Validate synchronized hours
    if (services.includes("delivery") && services.includes("takeaway")) {
      const deliveryTiming = timings.delivery;
      const takeawayTiming = timings.takeaway;

      if (deliveryTiming.openTime !== takeawayTiming.openTime ||
        deliveryTiming.closeTime !== takeawayTiming.closeTime ||
        JSON.stringify(deliveryTiming.days) !== JSON.stringify(takeawayTiming.days)) {

        // Auto-synchronize hours instead of throwing error
        timings.takeaway = {
          openTime: deliveryTiming.openTime,
          closeTime: deliveryTiming.closeTime,
          days: [...deliveryTiming.days]
        };

        console.log("ℹ️ [INFO] Takeaway hours synchronized with delivery hours");
      }
    }

    // Validate service-specific timings
    services.forEach(service => {
      if (
        !timings[service] ||
        !timings[service].schedule ||
        Object.values(timings[service].schedule).every(slots => !slots || slots.length === 0)
      ) {
        throw new Error(`Complete timings required for ${service} service`);
      }
    });
// Validate branch and parent restaurant
    let parentRestaurantDoc = null;
    if (isBranch) {
      if (!parentRestaurant) {
        throw new Error("Parent restaurant ID is required for branch restaurants");
      }
      if (!mongoose.Types.ObjectId.isValid(parentRestaurant)) {
        throw new Error("Invalid parent restaurant ID");
      }
      parentRestaurantDoc = await Restaurant.findById(parentRestaurant);
      if (!parentRestaurantDoc) {
        throw new Error("Parent restaurant not found");
      }
      // Optional: Prevent branches from being parents (uncomment if required)
      if (parentRestaurantDoc.isBranch) {
        throw new Error("Parent restaurant cannot be a branch itself");
      }
      if (parentRestaurantDoc.restaurantId === restaurantId) {
        throw new Error("A restaurant cannot be its own parent");
      }
    }
    const uploadedImages = {
      food: [],
      menu: [],
      profile: null,
      restaurant: null,
    };

    // Upload restaurant image
    if (req.files?.restaurantImage?.[0]) {
      uploadedImages.restaurant = await uploadBufferToCloudinary(
        req.files.restaurantImage[0].buffer,
        "restaurant_images"
      );
    }

    // Upload profile image
    if (req.files?.profileImage?.[0]) {
      uploadedImages.profile = await uploadBufferToCloudinary(
        req.files.profileImage[0].buffer,
        "restaurant_profiles"
      );
    }

    // Upload food images
    if (req.files?.foodImages?.length) {
      for (const file of req.files.foodImages) {
        const url = await uploadBufferToCloudinary(file.buffer, "restaurant_foods");
        uploadedImages.food.push(url);
      }
    }

    // Upload menu images
    if (req.files?.menuImages?.length) {
      for (const file of req.files.menuImages) {
        const url = await uploadBufferToCloudinary(file.buffer, "restaurant_menus");
        uploadedImages.menu.push(url);
      }
    }

    // Upload PAN card
    if (req.files?.uploadPanCard?.[0]) {
      legalDetails.uploadPanCardUrl = await uploadBufferToCloudinary(
        req.files.uploadPanCard[0].buffer,
        "restaurant_pan"
      );
    }

    // Upload FSSAI license
    if (req.files?.uploadFssaiLicense?.[0]) {
      legalDetails.uploadFssaiLicenseUrl = await uploadBufferToCloudinary(
        req.files.uploadFssaiLicense[0].buffer,
        "restaurant_fssai"
      );
    }

    // Filter timings to only include selected services
    const filteredTimings = {};
    services.forEach(service => {
      filteredTimings[service] = {
        schedule: timings[service].schedule,
        isActive: timings[service].isActive ?? true
      };
    });

    // Save to DB
    const newRestaurant = new Restaurant({
      restaurantId,
      restaurantName,
      ownerDetails,
      restaurantAddress,
      images: uploadedImages,
      cuisines,
      services,
      timings: filteredTimings,
      legalDetails,
      bankDetails,
      managerDetails,
      isBranch,
      parentRestaurant: isBranch ? parentRestaurant : null,
    });

    await newRestaurant.save();
// Create admin notification for new restaurant registration
    const notificationMessage = isBranch
      ? `New branch restaurant "${newRestaurant.restaurantName}" has registered under parent "${parentRestaurantDoc.restaurantName}" and is pending approval.`
      : `New restaurant "${newRestaurant.restaurantName}" has registered and is pending approval.`;

    const notificationDetails = isBranch
      ? `Restaurant ID: ${newRestaurant.restaurantId}\nParent Restaurant: ${parentRestaurantDoc.restaurantName} (ID: ${parentRestaurantDoc.restaurantId})\nOwner: ${ownerDetails.name}\nLocation: ${restaurantAddress.city}, ${restaurantAddress.state}\nCuisines: ${cuisines.join(', ')}\nServices: ${services.join(', ')}`
      : `Restaurant ID: ${newRestaurant.restaurantId}\nOwner: ${ownerDetails.name}\nLocation: ${restaurantAddress.city}, ${restaurantAddress.state}\nCuisines: ${cuisines.join(', ')}\nServices: ${services.join(', ')}`;
    // Create admin notification for new restaurant registration
    await createNotification({
      restaurantId: newRestaurant.restaurantId,
      restaurantName: newRestaurant.restaurantName,
      category: 'Registration',
      action: isBranch ? 'New Branch Registration' : 'New Restaurant Registration',
      message: `New restaurant "${newRestaurant.restaurantName}" has registered and is pending approval.`,
      details: `Restaurant ID: ${newRestaurant.restaurantId}\nOwner: ${ownerDetails.name}\nLocation: ${restaurantAddress.city}, ${restaurantAddress.state}\nCuisines: ${cuisines.join(', ')}\nServices: ${services.join(', ')}`,
      priority: 'High',
      status: 'Pending',
    });

    console.log("✅ [SUCCESS] Restaurant created:", newRestaurant.restaurantId);
    res.status(201).json({
      success: true,
      message: "Restaurant registered successfully",
      restaurant: newRestaurant,
    });
  } catch (err) {
    console.error("❌ [ERROR] Registration failed:", err.message);
    res.status(400).json({
      success: false,
      message: "Registration failed",
      error: err.message,
    });
  }
};

// New controller function to fetch restaurant details by ID
const getRestaurantById = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    console.log(`Fetching restaurant with ID: ${restaurantId}`);

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      console.log(`Invalid restaurantId format: ${restaurantId}`);
      return res.status(400).json({ error: 'Invalid restaurantId format' });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      console.log(`Restaurant not found for ID: ${restaurantId}`);
      return res.status(404).json({ error: 'Restaurant not found' });
    }

    console.log(`Restaurant found: ${restaurant.restaurantName}`);
    res.json({
      _id: restaurant._id,
      name: restaurant.restaurantName,
      status: restaurant.status || 'Active',
      isBranch: restaurant.isBranch,
      parentRestaurant: restaurant.parentRestaurant
        ? {
            id: restaurant.parentRestaurant.restaurantId,
            name: restaurant.parentRestaurant.restaurantName,
          }
        : null,
      analytics: {
        averageRating: restaurant.analytics?.averageRating || 4.5,
        totalOrders: restaurant.analytics?.totalOrders || 100,
        monthlyRevenue: restaurant.analytics?.monthlyRevenue || 5000,
      },
    });
  } catch (error) {
    console.error('Error fetching restaurant:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = { createRestaurant, getRestaurantById };
