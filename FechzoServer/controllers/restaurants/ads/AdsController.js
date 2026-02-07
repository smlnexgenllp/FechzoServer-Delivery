const Ad = require('../../../models/restaurants/ads/ads');
const cloudinary = require("../../../config/cloudinary");
const mongoose = require("mongoose");
const { validateFoodImage } = require('../../restaurants/outlet/ImageController');
const Razorpay = require('razorpay');
const crypto = require('crypto');

const COST_PER_IMPRESSION = 0.50; // ₹0.50 per impression
const COST_PER_CLICK = 10.00;

// Initialize Razorpay
const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Get Razorpay API key
const getRazorpayKey = (req, res) => {
  res.status(200).json({
    key: process.env.RAZORPAY_KEY_ID
  });
};

const createAd = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { itemId } = req.body;

    // Validate restaurantId exists
    const restaurant = await mongoose.model('Restaurant').findOne({ restaurantId });
    if (!restaurant) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID'
      });
    }

    const foodItem = await mongoose.model('Food').findById(itemId);
    if (!foodItem) {
      return res.status(400).json({
        success: false,
        message: 'Selected food item does not exist'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Ad image is required'
      });
    }

    const validExtensions = ['jpg', 'jpeg', 'png'];
    const extension = req.file.originalname.split('.').pop().toLowerCase();
    if (!validExtensions.includes(extension)) {
      return res.status(400).json({
        success: false,
        message: 'Only JPG, JPEG, and PNG images are allowed'
      });
    }

    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const folderPath = `restaurants/${restaurantId}/ads`;
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: folderPath,
      resource_type: 'image',
    });

    const newAd = new Ad({
      restaurantId,
      title: req.body.title,
      description: req.body.description,
      itemId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      budget: req.body.budget,
      isPopupAd: req.body.isPopupAd === 'true',
      popupBudget: req.body.popupBudget,
      discountPercentage: req.body.discountPercentage,
      pendingApproval: [{
        id: result.public_id,
        url: result.secure_url,
        name: req.file.originalname
      }]
    });

    await newAd.save();

    const populatedAd = await Ad.findById(newAd._id).populate('itemId', 'name price category');

    res.status(201).json({
      success: true,
      data: {
        ...populatedAd.toObject(),
        restaurantName: restaurant.restaurantName
      }
    });
  } catch (error) {
    console.error('Error creating ad:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// In the getRestaurantAds function:

const getRestaurantAds = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID is required'
      });
    }

    // Find all ads for the restaurant and populate the itemId field
    const ads = await Ad.find({ restaurantId })
      .populate('itemId', 'name price category')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: ads
    });
  } catch (error) {
    console.error('Error fetching restaurant ads:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch restaurant ads'
    });
  }
};

const getPendingAdImages = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const ads = await Ad.find({ 
      restaurantId,
      'pendingApproval.0': { $exists: true }
    }).select('pendingApproval');

    const pendingImages = ads.flatMap(ad => 
      ad.pendingApproval.map(img => ({
        id: img.id,
        url: img.url,
        name: img.name,
        uploadedAt: img.uploadedAt,
        adId: ad._id
      }))
    );

    res.json({
      success: true,
      data: pendingImages
    });
  } catch (error) {
    console.error('Error fetching pending ad images:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const updateAdStatus = async (req, res) => {
  try {
    const { adId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({ success: false, message: 'Invalid ad ID' });
    }

    const { status, validationNotes, rejectionReason } = req.body;

    if (!['pending', 'active', 'rejected', 'completed', 'paused'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const updateData = { status };

    const userId = req.user ? req.user._id : null;

    if (status === 'active') {
      updateData.validationStatus = 'approved';
      updateData.approvedBy = userId;
      updateData.approvedAt = new Date();
      updateData.validatedBy = userId;
      updateData.validatedAt = new Date();
      const ad = await Ad.findById(adId);
      if (!ad) {
        return res.status(404).json({ success: false, message: 'Ad not found' });
      }
      if (ad.pendingApproval.length > 0) {
        updateData.image = ad.pendingApproval[0].url;
        updateData.pendingApproval = [];
      }
    } else if (status === 'rejected') {
      updateData.validationStatus = 'rejected';
      updateData.rejectionReason = rejectionReason || 'No reason provided';
      updateData.validatedBy = userId;
      updateData.validatedAt = new Date();
      const ad = await Ad.findById(adId);
      if (!ad) {
        return res.status(404).json({ success: false, message: 'Ad not found' });
      }
      if (ad.pendingApproval.length > 0) {
        if (!ad.image) {
          updateData.image = ad.pendingApproval[0].url;
        }
        updateData.pendingApproval = [];
      }
    }

    if (validationNotes) {
      updateData.validationNotes = validationNotes;
    }

    const updatedAd = await Ad.findByIdAndUpdate(
      adId,
      updateData,
      { new: true }
    ).populate('itemId', 'name price category');

    if (!updatedAd) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    // Fetch restaurant name - MODIFIED THIS SECTION
    let restaurantName = 'Unknown Restaurant';
    try {
      const restaurant = await mongoose.model('Restaurant').findOne({
        $or: [
          { restaurantId: updatedAd.restaurantId },
          { _id: mongoose.Types.ObjectId.isValid(updatedAd.restaurantId) ? updatedAd.restaurantId : null }
        ]
      });
      
      if (restaurant) {
        restaurantName = restaurant.restaurantName;
      }
    } catch (err) {
      console.error('Error fetching restaurant name:', err);
    }

    res.json({
      success: true,
      data: {
        ...updatedAd.toObject(),
        restaurantName
      }
    });
  } catch (error) {
    console.error('Error updating ad status:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const getAllAds = async (req, res) => {
  try {
    const ads = await Ad.find()
      .populate({
        path: 'itemId',
        select: 'name price category',
        model: 'Food'
      })
      .sort({ createdAt: -1 });

    // Fetch restaurant names - MODIFIED THIS SECTION
    const restaurantIds = [...new Set(ads.map(ad => ad.restaurantId))];
    
    // Find restaurants by both restaurantId field and _id field to cover all cases
    const restaurants = await mongoose.model('Restaurant').find({
      $or: [
        { restaurantId: { $in: restaurantIds } },
        { _id: { $in: restaurantIds.filter(id => mongoose.Types.ObjectId.isValid(id)) } }
      ]
    });
    
    // Create a map with both _id and restaurantId as keys
    const restaurantMap = {};
    restaurants.forEach(r => {
      if (r.restaurantId) restaurantMap[r.restaurantId] = r.restaurantName;
      if (r._id) restaurantMap[r._id.toString()] = r.restaurantName;
    });

    const adsWithRestaurantName = ads.map(ad => ({
      ...ad.toObject(),
      restaurantName: restaurantMap[ad.restaurantId] || 'Unknown Restaurant'
    }));

    return res.status(200).json({ success: true, data: adsWithRestaurantName });
  } catch (error) {
    console.error('Error fetching ads:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch advertisements'
    });
  }
};

// Update the getActiveAds function to ensure restaurant IDs are properly included
const getActiveAds = async (req, res) => {
  try {
    const activeAds = await Ad.find({
      status: 'active',
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    })
      .populate({
        path: 'itemId',
        select: 'name price category',
        model: 'Food',
      })
      .sort({ createdAt: -1 });

    // Fetch restaurant data
    const restaurantIds = [...new Set(activeAds.map(ad => ad.restaurantId))];
    
    // Find restaurants by both restaurantId field and _id field
    const restaurants = await mongoose.model('Restaurant').find({
      $or: [
        { restaurantId: { $in: restaurantIds } },
        { _id: { $in: restaurantIds.filter(id => mongoose.Types.ObjectId.isValid(id)) } }
      ]
    });
    
    // Create a map with both _id and restaurantId as keys
    const restaurantMap = {};
    restaurants.forEach(r => {
      if (r.restaurantId) restaurantMap[r.restaurantId] = {
        name: r.restaurantName,
        id: r._id.toString() // Ensure we have the MongoDB _id as a string
      };
      
      if (r._id) restaurantMap[r._id.toString()] = {
        name: r.restaurantName,
        id: r._id.toString()
      };
    });

    const adsWithRestaurantData = activeAds.map(ad => {
      // Make sure we have the item data properly structured
      const itemData = ad.itemId ? {
        id: ad.itemId._id,
        name: ad.itemId.name || 'Unknown Item',
        price: ad.itemId.price || 0,
        category: ad.itemId.category || 'Uncategorized'
      } : {
        id: 'unknown',
        name: 'Unknown Item',
        price: 0,
        category: 'Uncategorized'
      };

      // Get restaurant data from the map
      const restaurantData = restaurantMap[ad.restaurantId] || {
        name: 'Unknown Restaurant',
        id: null
      };

      return {
        ...ad.toObject(),
        restaurantName: restaurantData.name,
        restaurantId: ad.restaurantId, // Keep the original restaurantId
        restaurant: {
          id: restaurantData.id, // Include the MongoDB _id
          name: restaurantData.name,
          location: 'Unknown Location' // Add more fields as needed
        },
        item: itemData
      };
    });

    res.json({ success: true, data: adsWithRestaurantData });
  } catch (error) {
    console.error('Error fetching active ads:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active ads'
    });
  }
};

const getPendingAds = async (req, res) => {
  try {
    const ads = await Ad.find({ status: 'pending', validationStatus: 'pending' })
      .populate('itemId', 'name price category')
      .sort({ createdAt: -1 });

    // Fetch restaurant names - MODIFIED THIS SECTION
    const restaurantIds = [...new Set(ads.map(ad => ad.restaurantId))];
    
    // Find restaurants by both restaurantId field and _id field
    const restaurants = await mongoose.model('Restaurant').find({
      $or: [
        { restaurantId: { $in: restaurantIds } },
        { _id: { $in: restaurantIds.filter(id => mongoose.Types.ObjectId.isValid(id)) } }
      ]
    });
    
    // Create a map with both _id and restaurantId as keys
    const restaurantMap = {};
    restaurants.forEach(r => {
      if (r.restaurantId) restaurantMap[r.restaurantId] = r.restaurantName;
      if (r._id) restaurantMap[r._id.toString()] = r.restaurantName;
    });

    const adsWithRestaurantName = ads.map(ad => ({
      ...ad.toObject(),
      restaurantName: restaurantMap[ad.restaurantId] || 'Unknown Restaurant'
    }));

    res.json({
      success: true,
      data: adsWithRestaurantName
    });
  } catch (error) {
    console.error('Error fetching pending ads:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Update the trackAdMetrics function
const trackAdMetrics = async (req, res) => {
  try {
    const { adId } = req.params;
    const { type, timestamp, sessionId } = req.body;
    
    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ad ID format'
      });
    }

    const ad = await Ad.findById(adId);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Advertisement not found'
      });
    }

    let isNewImpression = true;
    
    // Check if this is a duplicate impression from the same session
    if (type === 'impression' && sessionId) {
      // Initialize trackedSessions array if it doesn't exist
      if (!ad.trackedSessions) {
        ad.trackedSessions = [];
      }
      
      // Check if this session has already been tracked
      if (ad.trackedSessions.includes(sessionId)) {
        isNewImpression = false;
        
        // Return early without incrementing impressions
        return res.status(200).json({
          success: true,
          message: 'Impression already tracked for this session',
          data: {
            impressions: ad.impressions,
            clicks: ad.clicks,
            spent: ad.spent,
            status: ad.status,
            isNewImpression: false
          }
        });
      } else {
        // Add this session to the tracked sessions
        ad.trackedSessions.push(sessionId);
      }
    }

    // Update metrics based on the type
    if (type === 'impression' && isNewImpression) {
      ad.impressions = (ad.impressions || 0) + 1;
      
      // Calculate cost for this impression
      const impressionCost = COST_PER_IMPRESSION;
      ad.spent = (ad.spent || 0) + impressionCost;
    } else if (type === 'click') {
      ad.clicks = (ad.clicks || 0) + 1;
      
      // Calculate cost for this click
      const clickCost = COST_PER_CLICK;
      ad.spent = (ad.spent || 0) + clickCost;
    }

    // Check if budget has been exceeded
    if (ad.spent >= ad.budget) {
      ad.status = 'completed';
    }

    await ad.save();

    res.status(200).json({
      success: true,
      message: `Ad ${type} tracked successfully`,
      data: {
        impressions: ad.impressions,
        clicks: ad.clicks,
        spent: ad.spent,
        status: ad.status,
        isNewImpression: isNewImpression
      }
    });
  } catch (error) {
    console.error(`Error tracking ad ${req.body.type}:`, error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const editAd = async (req, res) => {
  try {
    const { adId } = req.params;
    const { restaurantId } = req.body;

    // Validate restaurantId exists
    const restaurant = await mongoose.model('Restaurant').findOne({ restaurantId });
    if (!restaurant) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ad ID'
      });
    }

    const itemId = req.body.itemId;
    if (itemId && !mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid item ID'
      });
    }
    if (itemId) {
      const foodItem = await mongoose.model('Food').findById(itemId);
      if (!foodItem) {
        return res.status(400).json({
          success: false,
          message: 'Selected food item does not exist'
        });
      }
    }

    const updateData = {
      restaurantId,
      title: req.body.title,
      description: req.body.description,
      itemId: req.body.itemId,
      startDate: req.body.startDate,
      endDate: req.body.endDate,
      budget: req.body.budget,
      isPopupAd: req.body.isPopupAd === 'true',
      popupBudget: req.body.popupBudget,
      discountPercentage: req.body.discountPercentage,
      status: 'pending',
      validationStatus: 'pending',
      validatedAt: null,
      validatedBy: null,
      approvedAt: null,
      approvedBy: null,
      rejectionReason: null,
      validationNotes: null
    };

    if (req.file) {
      const validExtensions = ['jpg', 'jpeg', 'png'];
      const extension = req.file.originalname.split('.').pop().toLowerCase();
      if (!validExtensions.includes(extension)) {
        return res.status(400).json({
          success: false,
          message: 'Only JPG, JPEG, and PNG images are allowed'
        });
      }

      const b64 = Buffer.from(req.file.buffer).toString('base64');
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;

      const folderPath = `restaurants/${restaurantId}/ads`;
      const result = await cloudinary.uploader.upload(dataURI, {
        folder: folderPath,
        resource_type: 'image',
      });

      updateData.pendingApproval = [{
        id: result.public_id,
        url: result.secure_url,
        name: req.file.originalname
      }];
    }

    const ad = await Ad.findByIdAndUpdate(
      adId,
      updateData,
      { new: true }
    ).populate('itemId', 'name price category');

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...ad.toObject(),
        restaurantName: restaurant.restaurantName
      }
    });
  } catch (error) {
    console.error('Error editing ad:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const cancelAd = async (req, res) => {
  try {
    const { restaurantId, adId } = req.params;

    // Validate restaurantId exists
    const restaurant = await mongoose.model('Restaurant').findOne({ restaurantId });
    if (!restaurant) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant not found'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ad ID'
      });
    }

    const ad = await Ad.findOne({ _id: adId, restaurantId });
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    if (ad.pendingApproval.length > 0) {
      try {
        await cloudinary.uploader.destroy(ad.pendingApproval[0].id);
      } catch (cloudinaryError) {
        console.error('Failed to delete image from Cloudinary:', cloudinaryError);
      }
    }

    await Ad.deleteOne({ _id: adId });

    res.json({
      success: true,
      message: 'Ad cancelled and deleted successfully'
    });
  } catch (error) {
    console.error('Error cancelling ad:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const createAdPayment = async (req, res) => {
  try {
    console.log('createAdPayment called', req.body);
    const { amount, adDetails } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }

    const options = {
      amount: amount * 100,
      currency: 'INR',
      receipt: `ad_${Date.now()}`,
      payment_capture: 1
    };

    const order = await razorpayInstance.orders.create(options);

    res.status(200).json({
      success: true,
      orderId: order.id,
      amount: amount,
      currency: 'INR'
    });
  } catch (error) {
    console.error('Error creating ad payment:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create payment order'
    });
  }
};


// In verifyAdPayment function
const verifyAdPayment = async (req, res) => {
  try {
    const { 
      razorpayOrderId, 
      razorpayPaymentId, 
      razorpaySignature,
      adDetails,
      restaurantId 
    } = req.body;

    console.log('Received restaurantId:', restaurantId); // Add debug log
    
    // Validate restaurantId
    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'restaurantId is required'
      });
    }

    // Verify restaurant exists - make sure you're using the right field
    const restaurant = await mongoose.model('Restaurant').findOne({ 
      $or: [
        { restaurantId: restaurantId },
        { _id: mongoose.Types.ObjectId.isValid(restaurantId) ? restaurantId : null }
      ]
    });
    
    console.log('Found restaurant:', restaurant ? 'Yes' : 'No');
    
    if (!restaurant) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant not found'
      });
    }
    
    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

    // Process the ad creation with the uploaded image
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Ad image is required'
      });
    }

    // Process image upload to Cloudinary
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;


    const folderPath = `restaurants/${restaurantId}/ads`;
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: folderPath,
      resource_type: 'image',
    });

    // Parse adDetails if it's a string
    const parsedAdDetails = typeof adDetails === 'string' 
      ? JSON.parse(adDetails) 
      : adDetails;

    // Validate parsed adDetails
    if (!parsedAdDetails.title || !parsedAdDetails.description || !parsedAdDetails.targetItem) {
      return res.status(400).json({
        success: false,
        message: 'Missing required ad details (title, description, or targetItem)'
      });
    }

    // Validate targetItem is a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(parsedAdDetails.targetItem)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid targetItem ID'
      });
    }

    // Verify food item exists
    const foodItem = await mongoose.model('Food').findById(parsedAdDetails.targetItem);
    if (!foodItem) {
      return res.status(400).json({
        success: false,
        message: 'Selected food item does not exist'
      });
    }

    // Create new ad with payment details
    const newAd = new Ad({
      restaurantId,
      title: parsedAdDetails.title,
      description: parsedAdDetails.description,
      itemId: parsedAdDetails.targetItem,
      startDate: parsedAdDetails.startDate,
      endDate: parsedAdDetails.endDate,
      budget: parsedAdDetails.budget,
      isPopupAd: parsedAdDetails.promotionalPopup,
      popupBudget: parsedAdDetails.popupBudget || 0,
      discountPercentage: parsedAdDetails.discountPercentage || 0,
      pendingApproval: [{
        id: result.public_id,
        url: result.secure_url,
        name: req.file.originalname,
        uploadedAt: new Date()
      }],
      paymentStatus: 'completed',
      paymentId: razorpayPaymentId,
      orderId: razorpayOrderId,
      status: 'pending', // Ensure this is set to 'pending'
      validationStatus: 'pending' // Explicitly set
    });

    await newAd.save();

    const populatedAd = await Ad.findById(newAd._id)
      .populate('itemId', 'name price category');

    // Manually add restaurant name
    const adWithRestaurantName = {
      ...populatedAd.toObject(),
      restaurantName: restaurant.restaurantName
    };

    res.status(201).json({
      success: true,
      message: 'Payment verified and ad created successfully',
      data: adWithRestaurantName
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({
      success: false,
      message: `Ad validation failed: ${error.message}`
    });
  }
};

const getAdPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required'
      });
    }

    const payment = await razorpayInstance.payments.fetch(paymentId);

    res.status(200).json({
      success: true,
      data: payment
    });

  } catch (error) {
    console.error('Error fetching payment details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch payment details'
    });
  }
};

const processAdRefund = async (req, res) => {
  try {
    const { adId } = req.params;
    const { amount, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(adId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ad ID'
      });
    }

    const ad = await Ad.findById(adId);

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'Ad not found'
      });
    }

    if (!ad.paymentId) {
      return res.status(400).json({
        success: false,
        message: 'No payment found for this ad'
      });
    }

    const refund = await razorpayInstance.payments.refund(ad.paymentId, {
      amount: amount * 100,
      notes: {
        reason: reason || 'Ad cancelled or rejected'
      }
    });

    ad.refundStatus = 'completed';
    ad.refundAmount = amount;
    ad.refundReason = reason;

    await ad.save();

    res.status(200).json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        refundId: refund.id,
        amount: refund.amount / 100,
        status: refund.status
      }
    });

  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to process refund'
    });
  }
};

module.exports = {
  createAd,
  getRestaurantAds,
  getPendingAdImages,
  editAd,
  cancelAd,
  updateAdStatus,
  getActiveAds,
  trackAdMetrics,
  getAllAds,
  getRazorpayKey,
  createAdPayment,
  verifyAdPayment,
  getAdPaymentDetails,
  processAdRefund
};

