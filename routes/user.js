import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/Users.js'; 
import Transaction from '../models/Transaction.js';

const router = express.Router();

// Add debugging middleware with more verbose logging
router.use((req, res, next) => {
  console.log('User route hit:', req.method, req.path, req.body);
  console.log('Authorization header:', req.headers.authorization || 'none');
  next();
});

// Get user profile with detailed information - REMOVED AUTH MIDDLEWARE
router.get("/profile", async (req, res) => {
  try {
    // If no user ID provided in request, return error
    const userId = req.query.userId || (req.user && req.user.id);
    
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
    
    console.log("Profile request for user:", userId);
    
    const user = await User.findById(userId).select("-password");
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Include the ID in the response
    const userData = {
      ...user.toObject(),
      _id: user._id
    };
    
    console.log("Sending user profile");
    res.status(200).json(userData);
  } catch (error) {
    console.error("Error fetching user profile:", error);
    res.status(500).json({ message: "Server error", error: error.message });
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

// Simulate OCR endpoint for PAN card with improved name extraction
router.route('/extract-pan-details')
  .post((req, res) => {
    try {
      console.log('PAN extraction request received');
      
      // If request contains image data (base64), process it
      if (req.body.image) {
        // Get the text from the image
        const extractedText = req.body.extractedText || '';
        
        // Extract PAN number
        const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/;
        const panMatch = extractedText.match(panRegex);
        const pan = panMatch ? panMatch[0] : req.body.pan || "ABCDE1234F"; // Default for demo
        
        // Extract name - avoid "Permanent Account Number" text
        let name = req.body.name || '';
        
        if (!name) {
          // Clean text to avoid common headers
          const cleanText = extractedText.replace(/Permanent Account Number|PERMANENT ACCOUNT NUMBER|PAN CARD|INCOME TAX DEPARTMENT|GOVT\. OF INDIA/gi, "");
          
          // Try to find name with a name label
          const nameMatch = cleanText.match(/Name[\s:]*([A-Za-z\s.]+)(?=Father|Date|Birth|DOB|\d{2}\/\d{2}\/\d{4}|$)/i);
          if (nameMatch && nameMatch[1] && nameMatch[1].length > 3) {
            name = nameMatch[1].trim();
          }
        }
        
        // Extract date of birth
        let dateOfBirth = req.body.dateOfBirth || '';
        if (!dateOfBirth) {
          const dobMatch = extractedText.match(/(DOB|Date of Birth|Birth|Born)[\s:]*(\d{2}[-/.\s]\d{2}[-/.\s]\d{4})/i);
          if (dobMatch && dobMatch[2]) {
            const dateStr = dobMatch[2].replace(/\s/g, '');
            const parts = dateStr.split(/[-/.]/);
            if (parts.length === 3) {
              dateOfBirth = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
          }
        }
        
        // For demo purposes, ensure we always return some data
        return res.json({
          success: true,
          data: {
            name: name || 'John Doe',
            pan: pan,
            dateOfBirth: dateOfBirth || '1990-01-01'
          }
        });
      }
      
      // Default response if no image data
      return res.json({
        success: true,
        data: {
          name: 'John Doe',
          pan: 'ABCDE1234F',
          dateOfBirth: '1990-01-01'
        }
      });
    } catch (error) {
      console.error('Error in PAN extraction:', error);
      return res.status(200).json({ 
        success: true,  // Return success even on error
        data: {
          name: 'John Doe',
          pan: 'ABCDE1234F',
          dateOfBirth: '1990-01-01'
        }
      });
    }
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

// Login route - Keep this as is since it's for authentication
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

// Get admin user stats - REMOVED AUTH MIDDLEWARE
router.route('/admin/stats')
  .get(async (req, res) => {
    try {
      const totalUsers = await User.countDocuments({});
      const activeUsers = await User.countDocuments({ status: 'active' });
      const inactiveUsers = await User.countDocuments({ status: 'inactive' });
      const blockedUsers = await User.countDocuments({ status: 'blocked' });
      
      // Get new users in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const newUsers = await User.countDocuments({ 
        createdAt: { $gte: thirtyDaysAgo } 
      });

      res.json({
        success: true,
        stats: {
          totalUsers,
          activeUsers,
          inactiveUsers,
          blockedUsers,
          newUsers,
          userGrowthRate: totalUsers > 0 ? (newUsers / totalUsers) * 100 : 0
        }
      });
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch admin stats' 
      });
    }
  });

// Update all-users route to include more details - REMOVED AUTH MIDDLEWARE
router.route('/all-users')
  .get(async (req, res) => {
    try {
      const users = await User.find({})
        .select('name email pan phone status createdAt bankBalance')
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        users: users.map(user => ({
          id: user._id,
          name: user.name,
          email: user.email,
          pan: user.pan,
          phone: user.phone,
          status: user.status || 'active',
          createdAt: user.createdAt,
          balance: user.bankBalance || 0
        }))
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch users' 
      });
    }
  });

// Transfer money between users - REMOVED AUTH MIDDLEWARE
router.route('/transfer')
  .post(async (req, res) => {
    try {
      const { senderId, receiverId, amount, note } = req.body;
      
      if (!senderId || !receiverId || !amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid transfer details'
        });
      }
      
      // Validate sender has enough balance
      const sender = await User.findById(senderId);
      if (!sender || sender.bankBalance < amount) {
        return res.status(400).json({
          success: false,
          message: 'Insufficient balance'
        });
      }
      
      // Validate receiver exists
      const receiver = await User.findById(receiverId);
      if (!receiver) {
        return res.status(404).json({
          success: false,
          message: 'Receiver not found'
        });
      }
      
      // Execute transfer
      sender.bankBalance -= parseFloat(amount);
      receiver.bankBalance += parseFloat(amount);
      
      // Add transaction record
      const transaction = new Transaction({
        senderId,
        receiverId,
        senderName: sender.name,
        receiverName: receiver.name,
        amount: parseFloat(amount),
        note,
        date: new Date()
      });
      
      // Add notifications for both users
      sender.notifications = sender.notifications || [];
      receiver.notifications = receiver.notifications || [];
      
      sender.notifications.unshift({
        type: 'transaction',
        title: 'Money Sent',
        message: `You sent ₹${amount} to ${receiver.name}`,
        icon: 'withdraw',
        link: '/transactions'
      });
      
      receiver.notifications.unshift({
        type: 'transaction',
        title: 'Money Received',
        message: `You received ₹${amount} from ${sender.name}`,
        icon: 'deposit',
        link: '/transactions'
      });
      
      // Save everything
      await Promise.all([
        sender.save(),
        receiver.save(),
        transaction.save()
      ]);
      
      res.json({
        success: true,
        message: 'Transfer completed successfully',
        transaction: {
          id: transaction._id,
          amount,
          receiverName: receiver.name,
          date: transaction.date
        }
      });
    } catch (error) {
      console.error('Transfer error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Transfer failed' 
      });
    }
  });

// Get user transactions - REMOVED AUTH MIDDLEWARE
router.route('/transactions')
  .get(async (req, res) => {
    try {
      const userId = req.query.userId || (req.user && req.user.id);
      
      if (!userId) {
        return res.status(400).json({ 
          success: false, 
          message: 'User ID is required as a query parameter' 
        });
      }
      
      // Remove limit to fetch all transactions
      const transactions = await Transaction.find({
        $or: [
          { senderId: userId },
          { receiverId: userId }
        ]
      }).sort({ date: -1 });
      
      // Add type field to each transaction
      const processedTransactions = transactions.map(transaction => {
        const isCredit = transaction.receiverId.toString() === userId.toString();
        return {
          ...transaction._doc,
          type: isCredit ? 'credit' : 'debit'
        };
      });
      
      res.json({
        success: true,
        transactions: processedTransactions
      });
    } catch (error) {
      console.error('Transactions fetch error:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch transactions' 
      });
    }
  });

export default router;
