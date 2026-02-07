const Restaurant = require('../../../models/restaurants/shops/RestaurantDetails');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
require('dotenv').config();

const getRestaurantContacts = async (req, res) => {
  try {
    const { id } = req.params;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const contacts = {
      owner: {
        name: restaurant.ownerDetails.fullName || "",
        phone: restaurant.ownerDetails.phone || "",
        email: restaurant.ownerDetails.email || ""
      },
      managers: [{
        name: restaurant.managerDetails.managerName || "",
        phone: restaurant.managerDetails.managerPhone || "",
        email: restaurant.managerDetails.managerEmail || ""
      }],
      staff: restaurant.staff || [],
      socialMedia: restaurant.socialMedia || [],
      pendingInvites: restaurant.pendingInvites || []
    };

    res.status(200).json(contacts);
  } catch (error) {
    console.error("Error fetching contacts:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const updateOwnerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email } = req.body;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (name) restaurant.ownerDetails.fullName = name;
    if (phone) restaurant.ownerDetails.phone = phone;
    if (email) restaurant.ownerDetails.email = email;

    await restaurant.save();
    console.log("Owner details saved successfully:", restaurant._id);
    res.status(200).json({ message: "Owner details updated successfully", owner: restaurant.ownerDetails });
  } catch (error) {
    console.error("Error updating owner:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const updateManagerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email } = req.body;
    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (name) restaurant.managerDetails.managerName = name;
    if (phone) restaurant.managerDetails.managerPhone = phone;
    if (email) restaurant.managerDetails.managerEmail = email;

    await restaurant.save();
    console.log("Manager details saved successfully:", restaurant._id);

    // Generate a new token with updated manager name
    const payload = {
      restaurantId: restaurant._id,
      username: restaurant.managerDetails.username,
      managerName: restaurant.managerDetails.managerName,
    };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
    
    // Return the updated manager details including the managerName and token
    res.status(200).json({
      message: "Manager details updated successfully",
      manager: {
        managerName: restaurant.managerDetails.managerName,
        managerPhone: restaurant.managerDetails.managerPhone,
        managerEmail: restaurant.managerDetails.managerEmail,
      },
      token: token  // Send the new token
    });
  } catch (error) {
    console.error("Error updating manager:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

const sendInvite = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, name, phone, email } = req.body;
    console.log("Invite request:", { id, role, name, phone, email });
    const inviteToken = Math.random().toString(36).substring(2, 15);

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    // Ensure restaurantAddress.state is set
    if (!restaurant.restaurantAddress.state) {
      restaurant.restaurantAddress.state = "Default State"; // Replace with a valid default or logic to determine the state
      console.log("Added missing state to restaurantAddress:", restaurant.restaurantAddress.state);
    }

    const pendingInvite = { role, name, phone, email, token: inviteToken, status: 'pending', createdAt: new Date().toISOString() };
    restaurant.pendingInvites.push(pendingInvite);

    await restaurant.save();
    console.log("Invite saved to database:", pendingInvite);
    console.log("Restaurant document after save:", restaurant._id);

    // Email sending logic remains unchanged
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const inviteLink = `${frontendUrl}/restaurantportal/accept-invite?token=${inviteToken}&restaurantId=${id}&role=${role}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: `Invitation to Join ${restaurant.restaurantName} as ${role}`,
      html: `
        <h2>Hi ${name},</h2>
        <p>You have been invited to join <strong>${restaurant.restaurantName}</strong> as a <strong>${role}</strong>.</p>
        <p>Please click the link below to accept the invitation:</p>
        <a href="${inviteLink}" style="color: #007bff; text-decoration: none;">Accept Invitation</a>
        <p>Best,<br>The ${restaurant.restaurantName} Team</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log("Email sent successfully to:", email);

    res.status(200).json({ message: "Invite sent successfully", invite: pendingInvite });
  } catch (error) {
    console.error("Error sending invite:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
const acceptInvite = async (req, res) => {
  try {
    const { token, restaurantId, role } = req.body; // Use req.body instead of req.query

    console.log("Accept invite request received:", { token, restaurantId, role, timestamp: new Date().toISOString() });

    // Validate restaurant ID
    const objectId = mongoose.Types.ObjectId.isValid(restaurantId) 
      ? new mongoose.Types.ObjectId(restaurantId) 
      : restaurantId;

    const restaurant = await Restaurant.findById(objectId);
    if (!restaurant) {
      console.log("Restaurant not found for ID:", objectId);
      return res.status(404).json({ message: "Restaurant not found" });
    }

    const inviteIndex = restaurant.pendingInvites.findIndex(i => i.token === token && i.status === 'pending');
    if (inviteIndex === -1) {
      console.log("No matching pending invite found for token:", token);
      return res.status(400).json({ message: "Invalid or expired invite" });
    }

    const invite = restaurant.pendingInvites[inviteIndex];

    if (role === 'manager') {
      restaurant.managerDetails = {
        managerName: invite.name,
        managerPhone: invite.phone,
        managerEmail: invite.email,
        username: restaurant.managerDetails.username || `mgr_${invite.email.split('@')[0]}`,
        password: restaurant.managerDetails.password || Math.random().toString(36).slice(-8),
      };
    } else if (role === 'staff') {
      restaurant.staff.push({
        name: invite.name,
        phone: invite.phone,
        email: invite.email
      });
    }

    // Remove the pending invite from the array
    restaurant.pendingInvites.splice(inviteIndex, 1);

    console.log("Manager or staff details saved, and pending invite removed successfully:");
    await restaurant.save();

    res.status(200).json({ message: `Successfully joined as ${role}` });
  } catch (error) {
    console.error("Error accepting invite:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

module.exports = { getRestaurantContacts, updateOwnerDetails, updateManagerDetails, sendInvite, acceptInvite };