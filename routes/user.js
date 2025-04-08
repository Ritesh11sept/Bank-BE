import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/Users.js';

const router = express.Router();

// Add debugging middleware
router.use((req, res, next) => {
  console.log('User route hit:', req.method, req.path, req.body);
  next();
});

// Get user details
router.route('/profile')
  .get(async (req, res) => {
    try {
      // In real app, get userId from auth middleware
      // For now, we'll extract it from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authorization token required' 
        });
      }
      
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "devfallbacksecret");
      
      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found' 
        });
      }
      
      res.json({
        success: true,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          pan: user.pan,
          phone: user.phone,
          dateOfBirth: user.dateOfBirth,
          age: user.age,
          linkedAccounts: user.linkedAccounts,
          bankBalance: user.bankBalance,
          createdAt: user.createdAt
        }
      });
    } catch (error) {
      console.error('Profile fetch error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch user profile' 
      });
    }
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

// Add OTP verification route
router.route('/verify-otp')
  .post((req, res) => {
    const { otp } = req.body;
    
    // For demo, always verify with 000000
    if (otp === '000000') {
      res.json({ success: true, message: 'OTP verified successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
  });

// Simulate OCR endpoint for PAN card
router.route('/extract-pan-details')
  .post((req, res) => {
    // In real implementation, this would process the uploaded image
    // For demo, return mock data after a delay
    setTimeout(() => {
      res.json({
        success: true,
        data: {
          name: 'JOHN DOE',
          pan: 'ABCDE1234F',
          dateOfBirth: '1990-01-01',
          age: '33'
        }
      });
    }, 1500);
  });

// Register route
router.route('/register')
  .post(async (req, res) => {
    try {
      console.log('Registration payload:', req.body);
      const { name, email, password, pan, phone, dateOfBirth, age } = req.body;

      // Validation
      if (!name || !email || !password || !pan || !phone || !dateOfBirth) {
        return res.status(400).json({ 
          success: false, 
          message: 'All fields are required: name, email, password, pan, phone, dateOfBirth'
        });
      }

      // Check PAN format
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(pan)) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid PAN format. Must be in the format ABCDE1234F' 
        });
      }

      // Check if user exists
      let user = await User.findOne({ $or: [{ email }, { pan }] });
      if (user) {
        return res.status(400).json({ 
          success: false,
          message: 'User with this email or PAN already exists' 
        });
      }

      // Get linked accounts
      const accounts = mockBankAccounts[pan] || [];
      
      // Create user with initial balance
      user = await User.create({
        name,
        email,
        password,
        pan,
        phone,
        dateOfBirth,
        age: age || 18, // Default to 18 if age not provided
        linkedAccounts: accounts,
        bankBalance: 150000
      });

      // Make sure JWT_SECRET is defined
      if (!process.env.JWT_SECRET) {
        console.log('JWT_SECRET is missing. Using a fallback for development.');
        process.env.JWT_SECRET = "devfallbacksecret";
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
          dateOfBirth: user.dateOfBirth,
          age: user.age,
          linkedAccounts: user.linkedAccounts,
          bankBalance: user.bankBalance
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
