const User = require('../../../models/User/User');
const mongoose = require('mongoose');

// Add a new address
exports.addAddress = async (req, res) => {
  try {
    console.log("Incoming request to add address:", req.body);

    const {
      userId,
      type,
      name,
      address,
      completeAddress,
      landmark,
      city,
      state,
      pincode,
      country,
      phone,
      latitude,         // from frontend
      longitude,        // from frontend
      coords,           // optional alternative
      deliveryInstructions,
      isDefault,
      isBillingAddress,
    } = req.body;

    console.log("Extracted userId from body:", userId);

    // Validate userId
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Validate required fields
    const requiredFields = ['name', 'completeAddress', 'city', 'state', 'pincode', 'country', 'phone'];
    for (const field of requiredFields) {
      if (!req.body[field] || typeof req.body[field] !== 'string' || req.body[field].trim() === '') {
        return res.status(400).json({ message: `Missing or invalid field: ${field}` });
      }
    }

    // Parse coordinates – support both direct lat/lng and coords object
    let coordinates = [0, 0]; // fallback

    if (coords && typeof coords === 'object') {
      const lat = Number(coords.lat || coords.latitude);
      const lng = Number(coords.lng || coords.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        coordinates = [lng, lat]; // MongoDB: [longitude, latitude]
      }
    } else if (latitude && longitude && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
      coordinates = [Number(longitude), Number(latitude)];
    } else {
      console.warn("No valid coordinates provided – saving with [0,0]");
    }

    console.log("Parsed coordinates:", coordinates);

    // Create new address object
    const newAddress = {
      _id: new mongoose.Types.ObjectId(),
      type: type || 'Home',
      name: name.trim(),
      address: address?.trim() || '',
      completeAddress: completeAddress.trim(),
      landmark: landmark?.trim() || '',
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      country: country.trim() || 'India',
      phone: phone.trim(),
      deliveryInstructions: deliveryInstructions?.trim() || '',
      isDefault: Boolean(isDefault),
      isBillingAddress: Boolean(isBillingAddress),
      location: {
        type: 'Point',
        coordinates,          // ← This is the key change!
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Handle default / billing logic
    if (newAddress.isDefault) {
      await User.updateOne(
        { _id: userId },
        { $set: { "addresses.$[].isDefault": false } }
      );
    }

    if (newAddress.isBillingAddress) {
      await User.updateOne(
        { _id: userId },
        { $set: { "addresses.$[].isBillingAddress": false } }
      );
    }

    // Push new address
    const result = await User.updateOne(
      { _id: userId },
      {
        $push: { addresses: newAddress },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: 'Failed to add address' });
    }

    // Fetch updated address
    const updatedUser = await User.findById(userId);
    const savedAddress = updatedUser.addresses.id(newAddress._id);

    console.log("Address saved successfully:", savedAddress);

    res.status(201).json({
      message: 'Address added successfully',
      address: savedAddress,
    });
  } catch (error) {
    console.error("Error while adding address:", error);
    res.status(500).json({
      message: 'Failed to add address',
      error: error.message,
    });
  }
};

// Update address (similar changes)
exports.updateAddress = async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    const {
      type,
      name,
      address,
      completeAddress,
      landmark,
      city,
      state,
      pincode,
      country,
      phone,
      latitude,
      longitude,
      coords,
      deliveryInstructions,
      isDefault,
      isBillingAddress,
    } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ message: 'Invalid userId or addressId' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const existingAddress = user.addresses.id(addressId);
    if (!existingAddress) return res.status(404).json({ message: 'Address not found' });

    // Parse coordinates
    let coordinates = existingAddress.location?.coordinates || [0, 0];

    if (coords && typeof coords === 'object') {
      const lat = Number(coords.lat || coords.latitude);
      const lng = Number(coords.lng || coords.longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        coordinates = [lng, lat];
      }
    } else if (latitude && longitude && !isNaN(Number(latitude)) && !isNaN(Number(longitude))) {
      coordinates = [Number(longitude), Number(latitude)];
    }

    console.log("Update coordinates:", coordinates);

    const session = await User.startSession();
    session.startTransaction();

    try {
      if (isDefault || isBillingAddress) {
        const unsetFields = {};
        if (isDefault) unsetFields["addresses.$[].isDefault"] = false;
        if (isBillingAddress) unsetFields["addresses.$[].isBillingAddress"] = false;

        await User.updateOne(
          { _id: userId },
          { $set: unsetFields },
          { session }
        );
      }

      const updateFields = {
        "addresses.$.type": type?.trim() || existingAddress.type,
        "addresses.$.name": name?.trim() || existingAddress.name,
        "addresses.$.address": address?.trim() || existingAddress.address,
        "addresses.$.completeAddress": completeAddress?.trim() || existingAddress.completeAddress,
        "addresses.$.landmark": landmark?.trim() || existingAddress.landmark,
        "addresses.$.city": city?.trim() || existingAddress.city,
        "addresses.$.state": state?.trim() || existingAddress.state,
        "addresses.$.pincode": pincode?.trim() || existingAddress.pincode,
        "addresses.$.country": country?.trim() || existingAddress.country,
        "addresses.$.phone": phone?.trim() || existingAddress.phone,
        "addresses.$.deliveryInstructions": deliveryInstructions?.trim() || existingAddress.deliveryInstructions,
        "addresses.$.isDefault": Boolean(isDefault),
        "addresses.$.isBillingAddress": Boolean(isBillingAddress),
        "addresses.$.updatedAt": new Date(),
        "addresses.$.location": {
          type: 'Point',
          coordinates,   // ← Save GeoJSON!
        },
      };

      await User.updateOne(
        { _id: userId, "addresses._id": addressId },
        { $set: updateFields },
        { session }
      );

      await session.commitTransaction();

      const updatedUser = await User.findById(userId);
      const updatedAddress = updatedUser.addresses.id(addressId);

      return res.status(200).json({
        message: 'Address updated successfully',
        address: updatedAddress,
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('UpdateAddress: Error', error);
    return res.status(500).json({
      message: 'Failed to update address',
      error: error.message,
    });
  }
};

// Get addresses (already fine, but now will return location.coordinates)
exports.getUserAddresses = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const user = await User.findById(userId, 'addresses');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const addresses = user.addresses.map((addr) => ({
      ...addr.toObject(),
      // Optional: add flat lat/lng for frontend convenience
      latitude: addr.location?.coordinates?.[1],
      longitude: addr.location?.coordinates?.[0],
    }));

    res.status(200).json(addresses);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch addresses', error: error.message });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    const {
      type,
      name,
      address,
      completeAddress,
      landmark,
      city,
      state,
      pincode,
      country,
      phone,
      latitude,
      longitude,
      deliveryInstructions,
      isDefault,
      isBillingAddress,
    } = req.body;

    console.log('UpdateAddress: Request received', { userId, addressId, updates: req.body });

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      console.warn('UpdateAddress: Invalid userId', userId);
      return res.status(400).json({ message: 'Invalid userId' });
    }

    if (!mongoose.Types.ObjectId.isValid(addressId)) {
      console.warn('UpdateAddress: Invalid addressId', addressId);
      return res.status(400).json({ message: 'Invalid addressId' });
    }

    const user = await User.findById(userId);
    if (!user) {
      console.warn('UpdateAddress: User not found', userId);
      return res.status(404).json({ message: 'User not found' });
    }

    const existingAddress = user.addresses.id(addressId);
    if (!existingAddress) {
      console.warn('UpdateAddress: Address not found', addressId);
      return res.status(404).json({ message: 'Address not found' });
    }

    // Validate required fields
    const requiredFields = ['name', 'completeAddress', 'city', 'state', 'pincode', 'country', 'phone'];
    for (const field of requiredFields) {
      if (req.body[field] && (typeof req.body[field] !== 'string' || req.body[field].trim() === '')) {
        console.warn(`UpdateAddress: Invalid field: ${field}`);
        return res.status(400).json({ message: `Invalid field: ${field}` });
      }
    }

    const session = await User.startSession();
    session.startTransaction();

    try {
      if (isDefault || isBillingAddress) {
        const unsetFields = {};
        if (isDefault) unsetFields["addresses.$[].isDefault"] = false;
        if (isBillingAddress) unsetFields["addresses.$[].isBillingAddress"] = false;

        await User.updateOne(
          { _id: userId },
          { $set: unsetFields },
          { session }
        );
      }

      const updateFields = {
        "addresses.$.type": type?.trim() || existingAddress.type || 'Home',
        "addresses.$.name": name?.trim() || existingAddress.name,
        "addresses.$.address": address?.trim() || existingAddress.address || '',
        "addresses.$.completeAddress": completeAddress?.trim() || existingAddress.completeAddress,
        "addresses.$.landmark": landmark?.trim() || existingAddress.landmark || '',
        "addresses.$.city": city?.trim() || existingAddress.city,
        "addresses.$.state": state?.trim() || existingAddress.state,
        "addresses.$.pincode": pincode?.trim() || existingAddress.pincode,
        "addresses.$.country": country?.trim() || existingAddress.country,
        "addresses.$.phone": phone?.trim() || existingAddress.phone,
        "addresses.$.deliveryInstructions": deliveryInstructions?.trim() || existingAddress.deliveryInstructions || '',
        "addresses.$.isDefault": Boolean(isDefault),
        "addresses.$.isBillingAddress": Boolean(isBillingAddress),
        "addresses.$.updatedAt": new Date(),
        "addresses.$.latitude": latitude && !isNaN(latitude) ? Number(latitude) : existingAddress.latitude,
        "addresses.$.longitude": longitude && !isNaN(longitude) ? Number(longitude) : existingAddress.longitude,
      };

      const updateResult = await User.updateOne(
        { _id: userId, "addresses._id": addressId },
        { $set: updateFields },
        { session }
      );

      if (updateResult.modifiedCount === 0) {
        console.warn('UpdateAddress: No changes made or address not found');
        await session.abortTransaction();
        return res.status(400).json({ message: 'No changes made or address not found' });
      }

      await session.commitTransaction();

      const updatedUser = await User.findById(userId);
      const updatedAddress = updatedUser.addresses.id(addressId);

      console.log('UpdateAddress: Address updated successfully', updatedAddress);
      return res.status(200).json({
        message: 'Address updated successfully',
        address: updatedAddress,
      });
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('UpdateAddress: Error', error);
    return res.status(500).json({
      message: 'Failed to update address',
      error: error.message,
    });
  }
};

// Delete an address
exports.deleteAddress = async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    console.log("Deleting address:", { userId, addressId });
    
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(addressId)) {
      return res.status(400).json({ message: 'Invalid userId or addressId' });
    }
    
    // Using findOneAndUpdate with $pull and explicitly disabling validation
    const result = await User.findOneAndUpdate(
      { _id: userId },
      { $pull: { addresses: { _id: addressId } } },
      { 
        new: true,
        runValidators: false  // This is the key to avoiding validation errors
      }
    );
    
    if (!result) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log("Address deleted successfully");
    res.status(200).json({ message: 'Address deleted successfully' });
  } catch (error) {
    console.error("Error deleting address:", error);
    res.status(500).json({ 
      message: 'Failed to delete address', 
      error: error.message
    });
  }
};