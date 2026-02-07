const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');
const mongoose = require('mongoose');

exports.getBankDetails = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const bankDetails = {
      accountHolderName: restaurant.bankDetails?.accountHolderName || '',
      bankName: restaurant.bankDetails?.bankName || '',
      accountNumber: restaurant.bankDetails?.accountNumber || '',
      ifscCode: restaurant.bankDetails?.ifscCode || '',
      accountType: restaurant.bankDetails?.accountType || '',
      branchName: restaurant.bankDetails?.branchName || '',
      isVerified: restaurant.bankDetails?.approvalStatus === 'approved',
      isRejected: restaurant.bankDetails?.approvalStatus === 'rejected',
      rejectionReason: restaurant.bankDetails?.rejectionReason || '',
      pendingDetails: restaurant.bankDetails?.pendingDetails ? {
        accountHolderName: restaurant.bankDetails.pendingDetails.accountHolderName,
        bankName: restaurant.bankDetails.pendingDetails.bankName,
        accountNumber: restaurant.bankDetails.pendingDetails.accountNumber,
        ifscCode: restaurant.bankDetails.pendingDetails.ifscCode,
        accountType: restaurant.bankDetails.pendingDetails.accountType,
        branchName: restaurant.bankDetails.pendingDetails.branchName,
        updatedAt: restaurant.bankDetails.pendingDetails.updatedAt,
        isApprovalPending: restaurant.bankDetails.approvalStatus === 'pending'
      } : null
    };

    res.json(bankDetails);
  } catch (error) {
    console.error('Error fetching bank details:', error);
    res.status(500).json({ 
      message: 'Error fetching bank details',
      error: error.message 
    });
  }
};

exports.updateBankDetails = async (req, res) => {
  try {
    const { restaurantId } = req.body;
    const bankData = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    if (!restaurant.bankDetails) {
      restaurant.bankDetails = {};
    }

    // Store pending changes
    restaurant.bankDetails.pendingDetails = {
      accountHolderName: bankData.accountHolderName,
      bankName: bankData.bankName,
      accountNumber: bankData.accountNumber,
      ifscCode: bankData.ifscCode,
      accountType: bankData.accountType,
      branchName: bankData.branchName,
      updatedAt: new Date()
    };
    restaurant.bankDetails.approvalStatus = 'pending';

    await restaurant.save();

    res.json({
      message: 'Bank details submitted for approval',
      currentDetails: {
        accountHolderName: restaurant.bankDetails.accountHolderName,
        bankName: restaurant.bankDetails.bankName,
        accountNumber: restaurant.bankDetails.accountNumber,
        ifscCode: restaurant.bankDetails.ifscCode,
        accountType: restaurant.bankDetails.accountType,
        branchName: restaurant.bankDetails.branchName,
        isVerified: restaurant.bankDetails.approvalStatus === 'approved'
      },
      pendingDetails: restaurant.bankDetails.pendingDetails
    });
  } catch (error) {
    console.error('Error updating bank details:', error);
    res.status(500).json({ 
      message: 'Error updating bank details',
      error: error.message 
    });
  }
};

exports.handleBankDetailsApproval = async (req, res) => {
  try {
    const { restaurantId, status, reason } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Validate if there are pending details
    if (!restaurant.bankDetails?.pendingDetails) {
      return res.status(400).json({ 
        message: "No pending bank details found for approval" 
      });
    }

    // If approving, update main bank details with pending details
    if (status === "approved") {
      // Keep existing bankDetails fields that aren't being updated
      const currentDetails = restaurant.bankDetails || {};
      const pendingDetails = restaurant.bankDetails.pendingDetails;

      restaurant.bankDetails = {
        ...currentDetails,
        accountHolderName: pendingDetails.accountHolderName,
        bankName: pendingDetails.bankName,
        accountNumber: pendingDetails.accountNumber,
        ifscCode: pendingDetails.ifscCode,
        accountType: pendingDetails.accountType,
        branchName: pendingDetails.branchName,
        approvalStatus: "approved",
        rejectionReason: null,
        lastUpdated: Date.now(),
        pendingDetails: null
      };
    } else if (status === "rejected") {
      // Validate rejection reason
      if (!reason) {
        return res.status(400).json({ 
          message: "Rejection reason is required" 
        });
      }

      restaurant.bankDetails = {
        ...restaurant.bankDetails,
        approvalStatus: "rejected",
        rejectionReason: reason,
        lastUpdated: Date.now(),
        pendingDetails: null
      };
    } else {
      return res.status(400).json({ 
        message: "Invalid approval status" 
      });
    }

    await restaurant.save();

    res.status(200).json({
      message: `Bank details ${status} successfully`,
      bankDetails: restaurant.bankDetails
    });
  } catch (error) {
    console.error("Bank details approval error:", error);
    res.status(500).json({ 
      message: "Error processing bank details approval",
      error: error.message 
    });
  }
};