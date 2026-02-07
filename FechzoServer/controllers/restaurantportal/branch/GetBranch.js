const mongoose = require('mongoose');
const Restaurant = require("../../../models/restaurants/shops/RestaurantDetails");

// Controller to fetch branch details by branchIds
const getBranchDetail = async (req, res) => {
  try {
    const { branchIds } = req.body; // Expecting an array of branch IDs
    console.log('Received branchIds:', branchIds);

    // Validate input
    if (!Array.isArray(branchIds) || branchIds.length === 0) {
      console.warn('Invalid input: branchIds must be a non-empty array');
      return res.status(400).json({
        success: false,
        message: 'branchIds must be a non-empty array',
      });
    }

    // Convert branchIds to ObjectId if they are valid
    const validBranchIds = branchIds
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));
    
    console.log('Valid ObjectIds:', validBranchIds);

    if (validBranchIds.length === 0) {
      console.warn('No valid ObjectIds found');
      return res.status(400).json({
        success: false,
        message: 'No valid branch IDs provided',
      });
    }

    // Fetch branches from the database
    const branches = await Restaurant.find({
      _id: { $in: validBranchIds },
      isBranch: true,
    }).select('restaurantId restaurantName restaurantAddress approvalStatus rejectionReason managerDetails');

    console.log('Fetched branches from DB:', branches);

    if (branches.length === 0) {
      console.warn('No branches found for the provided IDs');
      return res.status(404).json({
        success: false,
        message: 'No branches found for the provided IDs',
      });
    }

    // Map branches to include necessary details
    const branchDetails = branches.map(branch => ({
      branchId: branch.restaurantId,
      branchName: branch.restaurantName,
      restaurantAddress: {
        area: branch.restaurantAddress.area,
        city: branch.restaurantAddress.city,
        state: branch.restaurantAddress.state,
        postalCode: branch.restaurantAddress.postalCode,
        shopNumber: branch.restaurantAddress.shopNumber,
        landmark: branch.restaurantAddress.landmark,
      },
      approvalStatus: branch.approvalStatus,
      rejectionReason: branch.rejectionReason || '',
      managerDetails: {
        managerName: branch.managerDetails?.managerName || 'Unknown',
        managerEmail: branch.managerDetails?.managerEmail || 'N/A',
      },
    }));

    console.log('Formatted branch details to return:', branchDetails);

    res.status(200).json({
      success: true,
      branches: branchDetails,
    });
  } catch (error) {
    console.error('Error fetching branch details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch branch details: ' + error.message,
    });
  }
};

module.exports = { getBranchDetail };
