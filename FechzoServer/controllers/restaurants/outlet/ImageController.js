const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('../../../config/cloudinary');
const path = require('path');
const axios = require('axios'); // Make sure axios is installed
require('dotenv').config();

// Configure multer for file uploads
const storage = multer.memoryStorage();

const imageUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpeg, jpg, png) are allowed'));
  },
}).array('images', 10);

// Get restaurant or branch images
// Get restaurant or branch images - with improved ID generation
const getRestaurantImages = async (req, res) => {
  try {
    const { id, branchId } = req.params;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    let images, pendingApproval;
    if (branchId) {
      const branch = restaurant.branches.find((b) => b.branchId === branchId);
      if (!branch) {
        return res.status(404).json({ message: 'Branch not found' });
      }
      images = {
        foodImages: branch.images.food.map((url) => {
          // Generate a more reliable ID based on URL parts
          const urlParts = url.split('/');
          const filename = urlParts[urlParts.length - 1];
          const publicId = filename.split('.')[0]; // Remove extension
          
          return {
            id: `food_${publicId}_${branchId}`,
            url,
            name: `Food Image`,
            status: 'approved',
          };
        }),
        menuImages: branch.images.menu.map((url) => {
          const urlParts = url.split('/');
          const filename = urlParts[urlParts.length - 1];
          const publicId = filename.split('.')[0];
          
          return {
            id: `menu_${publicId}_${branchId}`,
            url,
            name: `Menu Image`,
            status: 'approved',
          };
        }),
        restaurantImages: branch.images.restaurant.map((url) => {
          const urlParts = url.split('/');
          const filename = urlParts[urlParts.length - 1];
          const publicId = filename.split('.')[0];
          
          return {
            id: `restaurant_${publicId}_${branchId}`,
            url,
            name: `Restaurant Image`,
            status: 'approved',
          };
        }),
      };
      pendingApproval = branch.pendingApproval || [];
    } else {
      images = {
        foodImages: restaurant.images.food.map((url) => {
          const urlParts = url.split('/');
          const filename = urlParts[urlParts.length - 1];
          const publicId = filename.split('.')[0];
          
          return {
            id: `food_${publicId}_${restaurant._id}`,
            url,
            name: `Food Image`,
            status: 'approved',
          };
        }),
        menuImages: restaurant.images.menu.map((url) => {
          const urlParts = url.split('/');
          const filename = urlParts[urlParts.length - 1];
          const publicId = filename.split('.')[0];
          
          return {
            id: `menu_${publicId}_${restaurant._id}`,
            url,
            name: `Menu Image`,
            status: 'approved',
          };
        }),
        restaurantImages: restaurant.images.restaurant.map((url) => {
          const urlParts = url.split('/');
          const filename = urlParts[urlParts.length - 1];
          const publicId = filename.split('.')[0];
          
          return {
            id: `restaurant_${publicId}_${restaurant._id}`,
            url,
            name: `Restaurant Image`,
            status: 'approved',
          };
        }),
      };
      pendingApproval = restaurant.pendingApproval || [];
    }

    res.status(200).json({ ...images, pendingApproval });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

async function validateFoodImage(base64Image) {
  try {
    const apiKey = process.env.CLARIFAI_API_KEY;
    const userId = process.env.CLARIFAI_USER_ID || 'clarifai';
    const appId = process.env.CLARIFAI_APP_ID || 'main';
    
    console.log('Validating food image...');
    
    if (!apiKey) {
      console.error('Clarifai API key missing');
      return false;
    }
    
    let cleanedBase64 = base64Image;
    if (base64Image.includes('base64,')) {
      cleanedBase64 = base64Image.split('base64,')[1];
    }
    
    const response = await axios({
      method: 'post',
      url: `https://api.clarifai.com/v2/users/${userId}/apps/${appId}/models/bd367be194cf45149e75f01d59f77ba7/outputs`,
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        "user_app_id": {
          "user_id": userId,
          "app_id": appId
        },
        "inputs": [{
          "data": {
            "image": {
              "base64": cleanedBase64
            }
          }
        }]
      },
      timeout: 15000
    });

    const concepts = response.data.outputs[0].data.concepts || [];
    console.log('Detected concepts:', concepts.slice(0, 5));

    const foodKeywords = [
      // Common food terms
      'food', 'dish', 'meal', 'cuisine', 'eating',
      // Meal types
      'breakfast', 'lunch', 'dinner', 'snack', 'appetizer', 'dessert',
      // Cooking methods
      'grilled', 'baked', 'fried', 'roasted', 'cooked',
      // Food categories
      'vegetable', 'meat', 'fruit', 'seafood', 'pastry', 'bread',
      // Specific foods
      'rice', 'noodles', 'pasta', 'pizza', 'burger', 'sandwich',
      'chicken', 'fish', 'beef', 'pork', 'curry', 'soup', 'salad',
      'cake', 'pancake', 'cookie', 'ice cream',
      // Restaurant items
      'plate', 'menu', 'restaurant', 'served'
    ];

    const nonFoodKeywords = [
      'person', 'face', 'building', 'landscape', 'vehicle',
      'furniture', 'animal', 'electronics', 'clothing', 'sky',
      'room', 'house', 'tree', 'car', 'phone', 'computer'
    ];

    const topConcepts = concepts.slice(0, 5);
    
    // Primary food check
    const hasFoodConcept = topConcepts.some(concept => 
      foodKeywords.some(keyword => concept.name.toLowerCase().includes(keyword)) &&
      concept.value > 0.80  // Lowered threshold
    );

    // Non-food check
    const hasNonFoodConcept = topConcepts.slice(0, 3).some(concept => 
      nonFoodKeywords.some(keyword => concept.name.toLowerCase().includes(keyword)) &&
      concept.value > 0.90  // Increased threshold for non-food rejection
    );

    // Calculate food relevance score
    const foodRelatedConcepts = topConcepts.filter(concept => 
      foodKeywords.some(keyword => concept.name.toLowerCase().includes(keyword))
    );

    const averageFoodScore = foodRelatedConcepts.length > 0
      ? foodRelatedConcepts.reduce((sum, concept) => sum + concept.value, 0) / foodRelatedConcepts.length
      : 0;

    console.log('Food validation metrics:', {
      hasFoodConcept,
      hasNonFoodConcept,
      averageFoodScore,
      topConcepts: topConcepts.map(c => `${c.name}:${c.value}`)
    });

    // Validation rules
    if (hasNonFoodConcept) {
      console.log('Rejected: Strong non-food content detected');
      return false;
    }

    if (!hasFoodConcept) {
      console.log('Rejected: No clear food content detected');
      return false;
    }

    if (averageFoodScore < 0.70) {
      console.log('Rejected: Low food confidence score:', averageFoodScore);
      return false;
    }

    console.log('Accepted: Valid food image detected');
    return true;

  } catch (error) {
    console.error('Validation error:', error.message);
    if (error.response?.data) {
      console.error('API response:', error.response.data);
    }
    return false;
  }
}
// Validate menu image using Clarifai
// Enhanced validateMenuImage function to accept layout/template style menus
async function validateMenuImage(base64Image) {
  try {
    const apiKey = process.env.CLARIFAI_API_KEY;
    const userId = process.env.CLARIFAI_USER_ID || 'clarifai';
    const appId = process.env.CLARIFAI_APP_ID || 'main';
    
    console.log('Validating menu image...');
    
    if (!apiKey) {
      console.error('Clarifai API key missing');
      return false;
    }
    
    let cleanedBase64 = base64Image;
    if (base64Image.includes('base64,')) {
      cleanedBase64 = base64Image.split('base64,')[1];
    }
    
    const response = await axios({
      method: 'post',
      url: `https://api.clarifai.com/v2/users/${userId}/apps/${appId}/models/aaa03c23b3724a16a56b629203edc62c/outputs`, // General model
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        "user_app_id": {
          "user_id": userId,
          "app_id": appId
        },
        "inputs": [{
          "data": {
            "image": {
              "base64": cleanedBase64
            }
          }
        }]
      },
      timeout: 15000
    });

    const concepts = response.data.outputs[0].data.concepts || [];
    console.log('Detected concepts for menu:', concepts.slice(0, 8));

    // Traditional menu-related concepts
    const menuKeywords = [
      'menu', 'food menu', 'restaurant menu', 'list', 'text', 'document',
      'dining', 'price', 'menu board', 'food list', 'meal', 'dish',
      'cuisine', 'appetizer', 'entree', 'dessert', 'drink', 'beverage',
      'specials', 'course', 'prix fixe', 'a la carte', 'brunch',
      'price list', 'cafe menu', 'bar menu', 'wine list'
    ];

    // Food-related concepts
    const foodKeywords = [
      'food', 'dish', 'meal', 'burger', 'pizza', 'sandwich', 'pasta',
      'rice', 'chicken', 'beef', 'pork', 'fish', 'salad', 'vegetable',
      'fruit', 'dessert', 'cake', 'ice cream', 'bread', 'appetizer',
      'steak', 'seafood', 'soup', 'beverage', 'coffee', 'tea'
    ];
    
    // Document/layout related concepts (common in menu designs)
    const layoutKeywords = [
      'template', 'layout', 'design', 'graphic', 'typography', 'print',
      'brochure', 'flyer', 'card', 'poster', 'advertisement', 'publication',
      'document', 'paper', 'page', 'business', 'corporate', 'information',
      'list', 'text', 'illustration', 'symbol', 'stripe', 'pattern',
      'presentation', 'web', 'internet', 'digital', 'modern', 'stylish'
    ];
    
    // Combine all valid keywords
    const validKeywords = [...menuKeywords, ...foodKeywords, ...layoutKeywords];

    // Non-food, non-menu concepts that should lead to rejection
    const rejectionKeywords = [
      'person', 'face', 'people', 'selfie', 'portrait', 'fashion', 'model',
      'landscape', 'beach', 'mountain', 'building exterior', 'car', 'vehicle',
      'medical', 'clothing', 'shoe', 'pet', 'dog', 'cat', 'sports equipment'
    ];

    // Examine top 8 concepts for better coverage
    const topConcepts = concepts.slice(0, 8);
    
    // Check for valid menu/food/layout concepts
    const hasValidConcept = topConcepts.some(concept => 
      validKeywords.some(keyword => concept.name.toLowerCase().includes(keyword.toLowerCase())) &&
      concept.value > 0.75
    );

    // Check for strong rejection concepts
    const hasRejectionConcept = topConcepts.slice(0, 3).some(concept => 
      rejectionKeywords.some(keyword => concept.name.toLowerCase().includes(keyword.toLowerCase())) &&
      concept.value > 0.92  // High threshold for rejection
    );

    // Check for design/template concepts which are common in menu designs
    const hasLayoutConcept = topConcepts.some(concept => 
      layoutKeywords.some(keyword => concept.name.toLowerCase().includes(keyword.toLowerCase())) &&
      concept.value > 0.90
    );

    // Calculate relevance scores for different categories
    const relevantConcepts = topConcepts.filter(concept => 
      validKeywords.some(keyword => concept.name.toLowerCase().includes(keyword.toLowerCase()))
    );

    const layoutConcepts = topConcepts.filter(concept => 
      layoutKeywords.some(keyword => concept.name.toLowerCase().includes(keyword.toLowerCase()))
    );

    const averageRelevanceScore = relevantConcepts.length > 0
      ? relevantConcepts.reduce((sum, concept) => sum + concept.value, 0) / relevantConcepts.length
      : 0;

    const layoutScore = layoutConcepts.length > 0
      ? layoutConcepts.reduce((sum, concept) => sum + concept.value, 0) / layoutConcepts.length
      : 0;

    console.log('Enhanced menu validation metrics:', {
      hasValidConcept,
      hasRejectionConcept,
      hasLayoutConcept,
      averageRelevanceScore,
      layoutScore,
      topConcepts: topConcepts.map(c => `${c.name}:${c.value}`)
    });

    // More permissive validation rules
    if (hasRejectionConcept) {
      console.log('Rejected: Strong non-menu/layout content detected');
      return false;
    }

    // Accept if it has menu/food concepts
    if (hasValidConcept) {
      console.log('Accepted: Valid menu/food content detected');
      return true;
    }
    
    // Accept if it has strong layout/template concepts
    if (hasLayoutConcept && layoutScore > 0.92) {
      console.log('Accepted: Menu template/layout detected');
      return true;
    }
    
    // Special check for web/digital menus
    if (topConcepts.some(c => 
        (c.name.includes('web') || c.name.includes('template') || c.name.includes('layout')) 
        && c.value > 0.95)) {
      console.log('Accepted: Digital menu format detected');
      return true;
    }

    console.log('Rejected: No clear menu, food, or layout content detected');
    return false;

  } catch (error) {
    console.error('Menu validation error:', error.message);
    if (error.response?.data) {
      console.error('API response:', error.response.data);
    }
    return false;
  }
}
// Validate restaurant image using Clarifai
async function validateRestaurantImage(base64Image) {
  try {
    const apiKey = process.env.CLARIFAI_API_KEY;
    const userId = process.env.CLARIFAI_USER_ID || 'clarifai';
    const appId = process.env.CLARIFAI_APP_ID || 'main';
    
    console.log('Validating restaurant image...');
    
    if (!apiKey) {
      console.error('Clarifai API key missing');
      return false;
    }
    
    let cleanedBase64 = base64Image;
    if (base64Image.includes('base64,')) {
      cleanedBase64 = base64Image.split('base64,')[1];
    }
    
    const response = await axios({
      method: 'post',
      url: `https://api.clarifai.com/v2/users/${userId}/apps/${appId}/models/aaa03c23b3724a16a56b629203edc62c/outputs`, // General model
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        "user_app_id": {
          "user_id": userId,
          "app_id": appId
        },
        "inputs": [{
          "data": {
            "image": {
              "base64": cleanedBase64
            }
          }
        }]
      },
      timeout: 15000
    });

    const concepts = response.data.outputs[0].data.concepts || [];
    console.log('Detected concepts for restaurant:', concepts.slice(0, 5));

    const restaurantKeywords = [
      // Restaurant related keywords
      'restaurant', 'cafe', 'dining', 'eatery', 'bistro', 'pub', 'bar',
      'cafeteria', 'diner', 'establishment', 'coffee shop', 'bakery',
      'interior', 'decor', 'seating', 'table', 'chair', 'booth', 'counter',
      'dining room', 'kitchen', 'lounge', 'patio', 'outdoor seating',
      'waiter', 'waitress', 'server', 'chef', 'cook', 'bartender',
      'store front', 'facade', 'entrance', 'sign', 'logo',
      'dinner', 'lunch', 'breakfast', 'meal', 'dining experience'
    ];

    const nonRestaurantKeywords = [
      'beach', 'mountain', 'forest', 'park', 'bedroom', 'bathroom',
      'office', 'classroom', 'laboratory', 'factory', 'warehouse',
      'airplane', 'ship', 'boat', 'train', 'car', 'traffic',
      'wilderness', 'desert', 'jungle'
    ];

    const topConcepts = concepts.slice(0, 5);
    
    // Restaurant check
    const hasRestaurantConcept = topConcepts.some(concept => 
      restaurantKeywords.some(keyword => concept.name.toLowerCase().includes(keyword.toLowerCase())) &&
      concept.value > 0.75
    );

    // Non-restaurant check
    const hasNonRestaurantConcept = topConcepts.slice(0, 3).some(concept => 
      nonRestaurantKeywords.some(keyword => concept.name.toLowerCase().includes(keyword.toLowerCase())) &&
      concept.value > 0.90
    );

    // Calculate restaurant relevance score
    const restaurantRelatedConcepts = topConcepts.filter(concept => 
      restaurantKeywords.some(keyword => concept.name.toLowerCase().includes(keyword.toLowerCase()))
    );

    const averageRestaurantScore = restaurantRelatedConcepts.length > 0
      ? restaurantRelatedConcepts.reduce((sum, concept) => sum + concept.value, 0) / restaurantRelatedConcepts.length
      : 0;

    console.log('Restaurant validation metrics:', {
      hasRestaurantConcept,
      hasNonRestaurantConcept,
      averageRestaurantScore,
      topConcepts: topConcepts.map(c => `${c.name}:${c.value}`)
    });

    // Validation rules
    if (hasNonRestaurantConcept) {
      console.log('Rejected: Strong non-restaurant content detected');
      return false;
    }

    if (!hasRestaurantConcept) {
      console.log('Rejected: No clear restaurant content detected');
      return false;
    }

    if (averageRestaurantScore < 0.65) {
      console.log('Rejected: Low restaurant confidence score:', averageRestaurantScore);
      return false;
    }

    console.log('Accepted: Valid restaurant image detected');
    return true;

  } catch (error) {
    console.error('Restaurant validation error:', error.message);
    if (error.response?.data) {
      console.error('API response:', error.response.data);
    }
    return false;
  }
}

// Enhanced uploadRestaurantImages function with improved validation
// Enhanced uploadRestaurantImages function with category-specific validation
const uploadRestaurantImages = async (req, res) => {
  try {
    const { id, branchId } = req.params;
    console.log('Received request body:', req.body);
    let { category } = req.body;

    // Validate category
    if (!['foodImages', 'menuImages', 'restaurantImages'].includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    // Log environment variables for debugging
    console.log('SKIP_IMAGE_VALIDATION:', process.env.SKIP_IMAGE_VALIDATION);
    console.log('CLARIFAI_API_KEY available:', !!process.env.CLARIFAI_API_KEY);

    const files = req.files;

    if (!files || files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // Determine folder path based on category
    const folderPath = `restaurants/${id}/${category.replace('Images', '')}`;

    // Upload to Cloudinary first
    const uploadPromises = files.map(async (file) => {
      const b64 = Buffer.from(file.buffer).toString('base64');
      const dataURI = `data:${file.mimetype};base64,${b64}`;
      
      try {
        const result = await cloudinary.uploader.upload(dataURI, {
          folder: folderPath,
          resource_type: 'image',
        });
        
        return {
          id: result.public_id,
          url: result.secure_url,
          name: file.originalname,
          buffer: b64
        };
      } catch (error) {
        throw new Error(`Failed to upload image to Cloudinary: ${error.message}`);
      }
    });

    const uploadedImages = await Promise.all(uploadPromises);
    
    // Skip validation only if explicitly set in environment
    const skipValidation = process.env.SKIP_IMAGE_VALIDATION === 'true';
    
    console.log('Skip validation:', skipValidation);
    
    // Track rejected images
    const rejectedImages = [];
    const validImages = [];
    
    // Always validate unless explicitly disabled
    if (!skipValidation) {
      console.log(`Performing ${category} validation with Clarifai`);
      
      // Validate each image individually based on category
      for (const image of uploadedImages) {
        try {
          let isValidImage = false;
          
          switch(category) {
            case 'foodImages':
              isValidImage = await validateFoodImage(image.buffer);
              break;
            case 'menuImages':
              isValidImage = await validateMenuImage(image.buffer);
              break;
            case 'restaurantImages':
              isValidImage = await validateRestaurantImage(image.buffer);
              break;
          }
          
          console.log(`Image ${image.name} ${category} validation result: ${isValidImage}`);
          
          if (isValidImage) {
            validImages.push(image);
          } else {
            // Delete rejected image from Cloudinary
            try {
              await cloudinary.uploader.destroy(image.id);
              console.log(`Deleted invalid ${category} image from Cloudinary: ${image.id}`);
            } catch (deleteError) {
              console.error(`Failed to delete image from Cloudinary: ${deleteError.message}`);
            }
            
            rejectedImages.push(image.name);
          }
        } catch (validationError) {
          console.error(`Validation error for ${image.name}:`, validationError);
          // For validation errors, reject the image (fail closed)
          try {
            await cloudinary.uploader.destroy(image.id);
          } catch (deleteError) {
            console.error(`Failed to delete image from Cloudinary: ${deleteError.message}`);
          }
          rejectedImages.push(image.name);
        }
      }
    } else {
      console.log('Skipping image validation (validation disabled)');
      validImages.push(...uploadedImages);
    }
    
    if (validImages.length === 0) {
      return res.status(400).json({
        message: `No valid ${category.replace('Images', '')} images were found in your upload.`,
        rejectedImages
      });
    }

    // Determine where to add the images (main restaurant or specific branch)
    if (branchId) {
      const branchIndex = restaurant.branches.findIndex(b => b.branchId === branchId);
      if (branchIndex === -1) {
        return res.status(404).json({ message: 'Branch not found' });
      }
      
      // Add images to the branch based on category
      const imageCategory = category.replace('Images', '');
      restaurant.branches[branchIndex].images[imageCategory].push(...validImages.map(img => img.url));
    } else {
      // Add images to the main restaurant based on category
      const imageCategory = category.replace('Images', '');
      restaurant.images[imageCategory].push(...validImages.map(img => img.url));
    }
    
    await restaurant.save();

    res.status(200).json({
      message: `${validImages.length} ${category.replace('Images', '')} image(s) uploaded successfully${rejectedImages.length > 0 ? `. ${rejectedImages.length} image(s) rejected.` : ''}`,
      uploadedImages: validImages.map(({buffer, ...rest}) => rest), // Remove buffer from response
      rejectedImages: rejectedImages.length > 0 ? rejectedImages : undefined
    });
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ message: 'Failed to upload images', error: error.message });
  }
};

// Delete image
// Delete image
const deleteRestaurantImage = async (req, res) => {
  try {
    const { id, branchId } = req.params;
    const { category, image_id } = req.query;
    
    console.log('Delete request:', { restaurantId: id, branchId, category, image_id });

    if (!['foodImages', 'menuImages', 'restaurantImages'].includes(category)) {
      return res.status(400).json({ message: 'Invalid category' });
    }

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    // Parse the image_id to extract the type and identifier
    const idParts = image_id.split('_');
    if (idParts.length < 2) {
      return res.status(400).json({ message: 'Invalid image ID format' });
    }

    const imageType = idParts[0]; // food, menu, restaurant

    let imageUrl = null;
    let imageIndex = -1;
    
    // Find the image to delete by matching the ID parts in the URL
    if (branchId) {
      const branch = restaurant.branches.find(b => b.branchId === branchId);
      if (!branch) {
        return res.status(404).json({ message: 'Branch not found' });
      }
      
      // Find matching image by searching through URLs
      for (let i = 0; i < branch.images[imageType].length; i++) {
        const url = branch.images[imageType][i];
        // Extract the filename and check if it matches parts of our ID
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1];
        
        // Check if this is the image we're looking for
        // This checks if any part of our image_id is found in the URL
        if (idParts.slice(1).some(part => filename.includes(part))) {
          imageIndex = i;
          imageUrl = url;
          break;
        }
      }
      
      if (imageIndex === -1) {
        return res.status(404).json({ message: 'Image not found with specified ID' });
      }
      
      // Remove the image from branch
      branch.images[imageType].splice(imageIndex, 1);
    } else {
      // Find image in main restaurant
      for (let i = 0; i < restaurant.images[imageType].length; i++) {
        const url = restaurant.images[imageType][i];
        // Extract the filename and check if it matches parts of our ID
        const urlParts = url.split('/');
        const filename = urlParts[urlParts.length - 1];
        
        // Check if this is the image we're looking for
        if (idParts.slice(1).some(part => filename.includes(part))) {
          imageIndex = i;
          imageUrl = url;
          break;
        }
      }
      
      if (imageIndex === -1) {
        return res.status(404).json({ message: 'Image not found with specified ID' });
      }
      
      // Remove the image from main restaurant
      restaurant.images[imageType].splice(imageIndex, 1);
    }

    // Delete from Cloudinary if URL exists
    if (imageUrl) {
      try {
        // Extract the public ID from the Cloudinary URL
        const urlParts = imageUrl.split('/');
        const filename = urlParts[urlParts.length - 1];
        const publicId = filename.split('.')[0]; // Remove extension
        
        // Check if it's in a folder
        const folderIndex = urlParts.indexOf('restaurants');
        if (folderIndex !== -1) {
          // Reconstruct the full path for Cloudinary
          const path = urlParts.slice(folderIndex, urlParts.length - 1).join('/');
          const fullPublicId = `${path}/${publicId}`;
          
          console.log('Deleting from Cloudinary with ID:', fullPublicId);
          await cloudinary.uploader.destroy(fullPublicId);
        }
      } catch (cloudinaryError) {
        console.error('Error deleting from Cloudinary:', cloudinaryError);
        // Continue even if Cloudinary deletion fails
      }
    }

    // Save the restaurant document with the image removed
    await restaurant.save();

    res.status(200).json({ 
      message: 'Image deleted successfully',
      category: imageType + 's',
      deletedIndex: imageIndex
    });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

module.exports = {
  getRestaurantImages,
  uploadRestaurantImages,
  deleteRestaurantImage,
  imageUpload,
  validateFoodImage,      // Export existing food validation
  validateMenuImage,      // Export new menu validation
  validateRestaurantImage 
};