// /controllers/outlet/OutletController.js
const Outlet = require('../../../models/restaurants/outlet/Outlet');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Temporary storage

// Fetch all outlet information
exports.getOutletInfo = async (req, res) => {
  try {
    const outlets = await Outlet.find();
    const mappedOutlets = outlets.map(outlet => ({
      outletId: outlet.outlet_id,
      outletName: outlet.name,
      outletType: outlet.outletType,
      outletLocation: outlet.outletLocation || `${outlet.location.city}, ${outlet.location.state}`,
      specialties: outlet.specialties,
      address: outlet.location.address,
      restaurantId: outlet.restaurantId,
      activeSince: outlet.activeSince,
      mapLink: outlet.mapLink,
      aboutUs: outlet.aboutUs,
      ourStory: outlet.ourStory, // Include the nested object
      outletImage: outlet.outletImage,
      outletImageApprovalStatus: outlet.outletImageApprovalStatus,
      requestedTitle: outlet.requestedTitle,
      outletNameApprovalStatus: outlet.outletNameApprovalStatus
    }));
    res.status(200).json(mappedOutlets);
  } catch (error) {
    console.error('Error fetching outlet info:', error);
    res.status(500).json({ 
      message: 'Failed to fetch outlet information',
      error: error.message
    });
  }
};

// Update outlet information
exports.updateOutletInfo = async (req, res) => {
  try {
    const outlet = await Outlet.findOne({ outlet_id: req.params.id });
    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }
    // Map frontend fields back to model fields
    const updatedData = {
      name: req.body.outletName || outlet.name,
      outletType: req.body.outletType || outlet.outletType,
      outletLocation: req.body.outletLocation || outlet.outletLocation,
      specialties: req.body.specialties || outlet.specialties,
      location: {
        address: req.body.address || outlet.location.address,
        city: outlet.location.city,
        state: outlet.location.state
      },
      restaurantId: req.body.restaurantId || outlet.restaurantId,
      activeSince: req.body.activeSince || outlet.activeSince,
      mapLink: req.body.mapLink || outlet.mapLink,
      aboutUs: req.body.aboutUs || outlet.aboutUs,
      ourStory: req.body.ourStory || outlet.ourStory,
      outletImage: req.body.outletImage || outlet.outletImage,
      outletImageApprovalStatus: req.body.outletImageApprovalStatus || outlet.outletImageApprovalStatus,
      requestedTitle: req.body.requestedTitle || outlet.requestedTitle,
      outletNameApprovalStatus: req.body.outletNameApprovalStatus || outlet.outletNameApprovalStatus
    };
    const updatedOutlet = await Outlet.findOneAndUpdate(
      { outlet_id: req.params.id },
      updatedData,
      { new: true }
    );
    res.status(200).json(updatedOutlet);
  } catch (error) {
    console.error('Error updating outlet info:', error);
    res.status(500).json({ message: 'Failed to update outlet information', error: error.message });
  }
};

// Handle title change request
exports.requestTitleChange = async (req, res) => {
    const { outletId, newTitle, reason } = req.body;
    try {
      const outlet = await Outlet.findOne({ outlet_id: outletId });
      if (!outlet) {
        return res.status(404).json({ message: 'Outlet not found' });
      }
    outlet.requestedTitle = newTitle;
    outlet.outletNameApprovalStatus = 'pending';
    await outlet.save();
    res.status(201).json({ message: 'Title request submitted', outlet });
  } catch (error) {
    console.error('Error submitting title request:', error);
    res.status(500).json({ message: 'Failed to submit title request', error: error.message });
  }
};

// Handle image upload
exports.uploadImage = async (req, res) => {
  const { outletId } = req.body;
  try {
    const outlet = await Outlet.findOne({ outlet_id: outletId });
    if (!outlet) {
      return res.status(404).json({ message: 'Outlet not found' });
    }
    const imagePath = req.file.path; // Temporary; replace with cloud storage in production
    outlet.outletImage = imagePath;
    outlet.outletImageApprovalStatus = 'pending';
    await outlet.save();
    res.status(200).json(outlet);
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ message: 'Failed to upload image', error: error.message });
  }
};

// Export multer upload middleware
exports.upload = upload;