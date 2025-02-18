import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/Users.js';

const router = express.Router();

// Add debugging middleware
router.use((req, res, next) => {
  console.log('User route hit:', req.method, req.path, req.body);
  next();
});

// Mock bank accounts data
const mockBankAccounts = {
  'ABCDE1234F': [
    { bankName: 'State Bank of India', accountNumber: '1234567890', ifscCode: 'SBIN0001234', balance: 50000 },
    { bankName: 'HDFC Bank', accountNumber: '0987654321', ifscCode: 'HDFC0001234', balance: 75000 }
  ],
  'PQRST5678G': [
    { bankName: 'ICICI Bank', accountNumber: '1122334455', ifscCode: 'ICIC0001234', balance: 60000 }
  ]
};

// Test route to verify the router is working
router.get('/test', (req, res) => {
  res.json({ message: 'User routes are working' });
});

// Get linked accounts route
router.route('/getLinkedAccounts')
  .post((req, res) => {
    console.log('Getting linked accounts for:', req.body);
    const { pan } = req.body;
    
    if (!pan) {
      return res.status(400).json({ 
        success: false, 
        message: 'PAN number is required' 
      });
    }

    const accounts = mockBankAccounts[pan] || [];
    console.log('Found accounts:', accounts);
    
    return res.json({
      success: true,
      accounts
    });
  });

// Register route
router.route('/register')
  .post(async (req, res) => {
    try {
      const { name, email, password, pan, phone } = req.body;

      // Check if user exists
      let user = await User.findOne({ $or: [{ email }, { pan }] });
      if (user) {
        return res.status(400).json({ message: 'User already exists' });
      }

      // Get linked accounts
      const accounts = mockBankAccounts[pan] || [];
      
      // Create user with linked accounts
      user = await User.create({
        name,
        email,
        password,
        pan,
        phone,
        linkedAccounts: accounts
      });

      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }

      const token = jwt.sign(
        { id: user._id }, 
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.status(201).json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          pan: user.pan,
          phone: user.phone,
          linkedAccounts: user.linkedAccounts
        },
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Registration failed' 
      });
    }
  });

// Login route
router.route('/login')
  .post(async (req, res) => {
    try {
      const { pan, password } = req.body;

      const user = await User.findOne({ pan }).select('+password');
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not configured');
      }

      const token = jwt.sign(
        { id: user._id }, 
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          pan: user.pan,
          phone: user.phone,
          linkedAccounts: user.linkedAccounts
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Login failed' 
      });
    }
  });

export default router;
