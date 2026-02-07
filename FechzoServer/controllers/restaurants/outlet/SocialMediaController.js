const mongoose = require('mongoose');
const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');
const SocialMedia = require('../../../models/restaurants/outlet/SocialMedia');

// Get restaurant social media
exports.getRestaurantSocialMedia = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    // Find existing social media entry or create a new one
    let socialMedia = await SocialMedia.findOne({ restaurantId });
    
    if (!socialMedia) {
      // If no social media data exists, return empty array
      return res.status(200).json({ platforms: [] });
    }

    return res.status(200).json({ platforms: socialMedia.platforms });
  } catch (error) {
    console.error('[ERROR] Failed to fetch social media:', error.message, error.stack);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};


// Add a single social media platform
exports.addSocialMediaPlatform = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { platform, link } = req.body;
    
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    if (!platform || !link) {
      return res.status(400).json({ message: 'Platform name and link are required' });
    }
    
    // Validate platform and link
    const validPlatforms = ['Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'YouTube'];
    const urlRegex = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/;
    
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({ message: `Invalid platform: ${platform}. Must be one of: ${validPlatforms.join(', ')}` });
    }
    
    if (!urlRegex.test(link)) {
      return res.status(400).json({ message: 'Invalid URL format' });
    }

    // Find existing entry or create new one
    let socialMedia = await SocialMedia.findOne({ restaurantId });
    
    if (!socialMedia) {
      socialMedia = new SocialMedia({
        restaurantId,
        platforms: [{ platform, link }]
      });
    } else {
      // Check if platform already exists
      const existingIndex = socialMedia.platforms.findIndex(p => p.platform === platform);
      
      if (existingIndex >= 0) {
        // Update existing platform
        socialMedia.platforms[existingIndex].link = link;
      } else {
        // Add new platform
        socialMedia.platforms.push({ platform, link });
      }
      
      socialMedia.updatedAt = Date.now();
    }

    await socialMedia.save();
    
    return res.status(200).json({ 
      message: 'Social media platform added successfully',
      platforms: socialMedia.platforms
    });
  } catch (error) {
    console.error('[ERROR] Failed to add social media platform:', error.message, error.stack);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};

// Remove a social media platform
exports.removeSocialMediaPlatform = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { platformIndex } = req.body;
    
    if (!restaurantId || !mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({ message: 'Invalid Restaurant ID format' });
    }

    if (platformIndex === undefined || platformIndex < 0) {
      return res.status(400).json({ message: 'Valid platform index is required' });
    }

    // Find existing entry
    let socialMedia = await SocialMedia.findOne({ restaurantId });
    
    if (!socialMedia || !socialMedia.platforms.length || platformIndex >= socialMedia.platforms.length) {
      return res.status(404).json({ message: 'Platform not found' });
    }

    // Remove the platform at the specified index
    socialMedia.platforms.splice(platformIndex, 1);
    socialMedia.updatedAt = Date.now();
    
    await socialMedia.save();
    
    return res.status(200).json({ 
      message: 'Social media platform removed successfully',
      platforms: socialMedia.platforms
    });
  } catch (error) {
    console.error('[ERROR] Failed to remove social media platform:', error.message, error.stack);
    return res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
};