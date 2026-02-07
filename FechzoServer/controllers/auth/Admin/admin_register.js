const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Admin = require('../../../models/Admin/admin');
const { validationResult } = require('express-validator');
const { configDotenv } = require('dotenv');

exports.loginAdmin = async (req, res) => {
    try {
      console.log('Received admin login request:', { username: req.body.username });
  
      // Input validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Input validation failed:', errors.array());
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg
        });
      }
      console.log('Input validation passed');
  
      const { username, password } = req.body;
  
      // Check if admin exists
      console.log('Checking if admin exists:', username);
      const admin = await Admin.findOne({ username });
      if (!admin) {
        console.log('Admin not found:', username);
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password'
        });
      }
      console.log('Admin found:', username);
  
      // Verify password
      console.log('Verifying password');
      const isMatch = await bcrypt.compare(password, admin.password);
      if (!isMatch) {
        console.log('Password verification failed');
        return res.status(401).json({
          success: false,
          message: 'Invalid username or password'
        });
      }
      console.log('Password verified successfully');
  
      // Generate JWT (expires in 2 days)
      console.log('Generating JWT');
      const token = jwt.sign(
        { adminId: admin._id, username: admin.username },
        process.env.JWT_SECRET,
        { expiresIn: '2d' }
      );
      console.log('JWT generated successfully');
      const isProduction = process.env.NODE_ENV === 'production';
      // Send JWT as httpOnly cookie
      res
        .cookie('adminToken', token, {
          httpOnly: true,
          secure:isProduction, // Ensure this is true for production with HTTPS
          sameSite: isProduction ? 'None' : 'Lax',
          maxAge: 2 * 24 * 60 * 60 * 1000 // 2 days in milliseconds
        })
        .status(200)
        .json({
          success: true,
          message: 'Login successful'
        });
      console.log('Admin login completed successfully for:', username);
  
    } catch (error) {
      console.error('Login error:', {
        message: error.message,
        stack: error.stack,
        username: req.body.username
      });
      res.status(500).json({
        success: false,
        message: 'Internal Server Error'
      });
    }
  };

  
exports.registerAdmin = async (req, res) => {
  try {
    console.log('Received admin registration request:', { username: req.body.username });

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Input validation failed:', errors.array());
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }
    console.log('Input validation passed');

    const { username, password, secretKey } = req.body;

    if (secretKey !== process.env.ADMIN_SECRET_KEY) {
      console.log('Invalid secret key provided');
      return res.status(403).json({
        success: false,
        message: 'Invalid admin secret key'
      });
    }
    console.log('Secret key validated successfully');

    const existingAdmin = await Admin.findOne({ username });
    if (existingAdmin) {
      console.log('Username already exists:', username);
      return res.status(400).json({
        success: false,
        message: 'Username already exists'
      });
    }
    console.log('Username is available:', username);

    console.log('Starting password hashing');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    console.log('Password hashed successfully');

    console.log('Creating new admin record');
    const newAdmin = new Admin({
      username,
      password: hashedPassword
    });

    console.log('Saving admin to database');
    await newAdmin.save();
    console.log('Admin saved successfully:', username);

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully'
    });
    console.log('Admin registration completed successfully for:', username);

  } catch (error) {
    console.error('Registration error:', {
      message: error.message,
      stack: error.stack,
      username: req.body.username
    });
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

// Get admin profile
exports.getAdminProfile = async (req, res) => {
  try {
    const adminId = req.admin.adminId;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access'
      });
    }
    
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      username: admin.username
      // Removed password from response
    });
  } catch (error) {
    console.error('Error fetching admin profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};

// Verify admin secret key
exports.verifyAdminSecret = async (req, res) => {
  try {
    const { secretKey } = req.body;
    
    if (!secretKey) {
      return res.status(400).json({
        success: false,
        message: 'Secret key is required'
      });
    }
    
    // Verify against environment variable
    if (secretKey !== process.env.ADMIN_SECRET_KEY) {
      return res.status(401).json({
        success: false,
        message: 'Invalid admin secret key'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Secret key verified successfully'
    });
  } catch (error) {
    console.error('Error verifying admin secret:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};

// Update admin profile
exports.updateAdminProfile = async (req, res) => {
  try {
    const { currentUsername, newUsername, newPassword } = req.body;
    const adminId = req.admin.adminId;
    
    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized access'
      });
    }
    
    // Validate input
    if (!currentUsername || !newUsername || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    // Find admin by ID
    const admin = await Admin.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }
    
    // Verify current username
    if (admin.username !== currentUsername) {
      return res.status(401).json({
        success: false,
        message: 'Current username is incorrect'
      });
    }
    
    // Check if new username already exists (if changing username)
    if (currentUsername !== newUsername) {
      const existingAdmin = await Admin.findOne({ username: newUsername });
      if (existingAdmin) {
        return res.status(400).json({
          success: false,
          message: 'Username already exists'
        });
      }
    }
    
    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);
    
    // Update admin record
    admin.username = newUsername;
    admin.password = hashedPassword;
    await admin.save();
    
    // Generate new JWT with updated username
    const token = jwt.sign(
      { adminId: admin._id, username: admin.username },
      process.env.JWT_SECRET,
      { expiresIn: '2d' }
    );
    
    // Set new cookie
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'None' : 'Lax',
      maxAge: 2 * 24 * 60 * 60 * 1000 // 2 days in milliseconds
    });
    
    return res.status(200).json({
      success: true,
      message: 'Admin profile updated successfully',
      username: newUsername
    });
  } catch (error) {
    console.error('Error updating admin profile:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error'
    });
  }
};
