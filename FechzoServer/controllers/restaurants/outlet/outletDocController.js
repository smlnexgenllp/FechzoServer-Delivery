const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');
const cloudinary = require('../../../config/cloudinary');
const mongoose = require('mongoose');

exports.getDocuments = async (req, res) => {
  try {
    const { restaurantId } = req.query;
    
    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    const documents = {
      pan: {
        number: restaurant.legalDetails.panCardNumber || '',
        name: restaurant.legalDetails.panFullName || '',
        imageUrl: restaurant.legalDetails.uploadPanCard || '',
        isVerified: restaurant.legalDetails.panApprovalStatus === 'approved',
        isRejected: restaurant.legalDetails.panApprovalStatus === 'rejected',
        rejectionReason: restaurant.legalDetails.panRejectionReason || '',
        pendingDetails: restaurant.legalDetails.pendingPanDetails ? {
          number: restaurant.legalDetails.pendingPanDetails.number,
          name: restaurant.legalDetails.pendingPanDetails.name,
          imageUrl: restaurant.legalDetails.pendingPanDetails.imageUrl,
          updatedAt: restaurant.legalDetails.pendingPanDetails.updatedAt,
          isApprovalPending: restaurant.legalDetails.panApprovalStatus === 'pending'
        } : null
      },
      fssai: {
        number: restaurant.legalDetails.fssaiNumber || '',
        expiryDate: restaurant.legalDetails.fssaiExpiryDate || '',
        imageUrl: restaurant.legalDetails.uploadFssaiLicense || '',
        isVerified: restaurant.legalDetails.fssaiApprovalStatus === 'approved',
        isRejected: restaurant.legalDetails.fssaiApprovalStatus === 'rejected',
        rejectionReason: restaurant.legalDetails.fssaiRejectionReason || '',
        pendingDetails: restaurant.legalDetails.pendingFssaiDetails ? {
          number: restaurant.legalDetails.pendingFssaiDetails.number,
          expiryDate: restaurant.legalDetails.pendingFssaiDetails.expiryDate,
          imageUrl: restaurant.legalDetails.pendingFssaiDetails.imageUrl,
          updatedAt: restaurant.legalDetails.pendingFssaiDetails.updatedAt,
          isApprovalPending: restaurant.legalDetails.fssaiApprovalStatus === 'pending'
        } : null
      }
    };

    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Error fetching documents' });
  }
};

exports.updateDocuments = async (req, res) => {
    try {
      const { restaurantId } = req.body;
      const documentType = req.body.type;
  
      if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
        return res.status(400).json({ message: 'Invalid restaurant ID format' });
      }
  
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ message: 'Restaurant not found' });
      }
  
      if (!restaurant.legalDetails) {
        restaurant.legalDetails = {};
      }
  
      // Handle file upload to Cloudinary if file exists
      let imageUrl = null;
      if (req.file) {
        try {
          const result = await cloudinary.uploader.upload(req.file.path, {
            folder: `restaurants/${restaurantId}/documents/pending`,
            public_id: `${documentType}_${Date.now()}`,
            resource_type: 'image'
          });
          imageUrl = result.secure_url;
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError);
          return res.status(400).json({ 
            message: 'Error uploading image',
            error: uploadError.message 
          });
        }
      }
  
      // Store pending changes separately
      if (documentType === 'pan') {
        restaurant.legalDetails.pendingPanDetails = {
          number: req.body.number,
          name: req.body.name,
          imageUrl: imageUrl || restaurant.legalDetails.uploadPanCard,
          updatedAt: new Date()
        };
        restaurant.legalDetails.panApprovalStatus = 'pending';
      } else if (documentType === 'fssai') {
        restaurant.legalDetails.pendingFssaiDetails = {
          number: req.body.number,
          expiryDate: req.body.expiryDate,
          imageUrl: imageUrl || restaurant.legalDetails.uploadFssaiLicense,
          updatedAt: new Date()
        };
        restaurant.legalDetails.fssaiApprovalStatus = 'pending';
      }
  
      await restaurant.save();
  
      // Return response with both current and pending data
      res.json({
        message: `${documentType.toUpperCase()} details submitted for approval`,
        currentDocument: {
          type: documentType,
          number: documentType === 'pan' ? 
            restaurant.legalDetails.panCardNumber : 
            restaurant.legalDetails.fssaiNumber,
          name: documentType === 'pan' ? 
            restaurant.legalDetails.panFullName : 
            undefined,
          expiryDate: documentType === 'fssai' ? 
            restaurant.legalDetails.fssaiExpiryDate : 
            undefined,
          imageUrl: documentType === 'pan' ? 
            restaurant.legalDetails.uploadPanCard : 
            restaurant.legalDetails.uploadFssaiLicense,
          isVerified: documentType === 'pan' ? 
            restaurant.legalDetails.panApprovalStatus === 'approved' : 
            restaurant.legalDetails.fssaiApprovalStatus === 'approved'
        },
        pendingDocument: {
          type: documentType,
          number: documentType === 'pan' ? 
            restaurant.legalDetails.pendingPanDetails?.number : 
            restaurant.legalDetails.pendingFssaiDetails?.number,
          name: documentType === 'pan' ? 
            restaurant.legalDetails.pendingPanDetails?.name : 
            undefined,
          expiryDate: documentType === 'fssai' ? 
            restaurant.legalDetails.pendingFssaiDetails?.expiryDate : 
            undefined,
          imageUrl: documentType === 'pan' ? 
            restaurant.legalDetails.pendingPanDetails?.imageUrl : 
            restaurant.legalDetails.pendingFssaiDetails?.imageUrl,
          isApprovalPending: true,
          updatedAt: documentType === 'pan' ? 
            restaurant.legalDetails.pendingPanDetails?.updatedAt : 
            restaurant.legalDetails.pendingFssaiDetails?.updatedAt
        }
      });
    } catch (error) {
      console.error('Error updating documents:', error);
      res.status(500).json({ 
        message: 'Error updating documents',
        error: error.message 
      });
    }
};

exports.handleDocumentApproval = async (req, res) => {
  try {
    const { restaurantId, documentType, status, reason } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ message: 'Restaurant not found' });
    }

    if (documentType === 'pan') {
      if (status === 'approved') {
        restaurant.legalDetails.panCardNumber = restaurant.legalDetails.pendingPanDetails.number;
        restaurant.legalDetails.panFullName = restaurant.legalDetails.pendingPanDetails.name;
        restaurant.legalDetails.uploadPanCard = restaurant.legalDetails.pendingPanDetails.imageUrl;
        restaurant.legalDetails.panApprovalStatus = 'approved';
        restaurant.legalDetails.panRejectionReason = null;
      } else {
        restaurant.legalDetails.panApprovalStatus = 'rejected';
        restaurant.legalDetails.panRejectionReason = reason;
      }
      restaurant.legalDetails.pendingPanDetails = null;
    } else if (documentType === 'fssai') {
      if (status === 'approved') {
        restaurant.legalDetails.fssaiNumber = restaurant.legalDetails.pendingFssaiDetails.number;
        restaurant.legalDetails.fssaiExpiryDate = restaurant.legalDetails.pendingFssaiDetails.expiryDate;
        restaurant.legalDetails.uploadFssaiLicense = restaurant.legalDetails.pendingFssaiDetails.imageUrl;
        restaurant.legalDetails.fssaiApprovalStatus = 'approved';
        restaurant.legalDetails.fssaiRejectionReason = null;
      } else {
        restaurant.legalDetails.fssaiApprovalStatus = 'rejected';
        restaurant.legalDetails.fssaiRejectionReason = reason;
      }
      restaurant.legalDetails.pendingFssaiDetails = null;
    }

    await restaurant.save();

    res.json({
      message: `Document ${status} successfully`,
      status,
      reason: status === 'rejected' ? reason : null
    });
  } catch (error) {
    console.error('Error handling document approval:', error);
    res.status(500).json({
      message: 'Error processing document approval',
      error: error.message
    });
  }
};

