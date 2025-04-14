import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/Users.js'; // Updated to use Users.js instead of User.js
import auth from '../middleware/auth.js'; // Ensure correct auth import
import Transaction from '../models/Transaction.js';

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

// Get all users (for transfer functionality)
router.route('/all-users')
  .get(async (req, res) => {
    try {
      console.log('Fetching all users for transfer functionality');
      
      // Extract user ID from token for filtering
      let userId = null;
      
      // Get the auth token from the header
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
          const decoded = jwt.verify(token, process.env.JWT_SECRET || "devfallbacksecret");
          userId = decoded.id;
          console.log('Current user ID from token:', userId);
        } catch (error) {
          console.error("Token verification failed:", error);
          return res.status(401).json({
            success: false,
            message: 'Invalid authentication token'
          });
        }
      } else {
        console.log('No authorization token provided');
        return res.status(401).json({
          success: false,
          message: 'Authentication token required'
        });
      }
      
      // Validate user exists
      const currentUser = await User.findById(userId);
      if (!currentUser) {
        console.error('User not found for ID:', userId);
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Find all users except current user
      console.log('Finding all users except:', userId);
      const users = await User.find(
        { _id: { $ne: userId } }, 
        'name email _id phone'
      ).limit(20);
      
      console.log(`Found ${users.length} users for transfer list`);
      
      // Check if we found users, and if not, create a dummy user for testing
      if (users.length === 0) {
        console.log('No other users found - checking total user count');
        const totalUsers = await User.countDocuments({});
        console.log(`Total users in database: ${totalUsers}`);
        
        if (totalUsers <= 1) {
          console.log('Creating a dummy test user for transfers');
          try {
            // Create a dummy user for testing transfers
            const dummyUser = new User({
              name: "Test User",
              email: "test@example.com",
              password: "password123",
              pan: "TESTG1234H",
              phone: "9876543210",
              dateOfBirth: "1990-01-01",
              age: 33,
              bankBalance: 50000
            });
            await dummyUser.save();
            console.log('Created dummy user:', dummyUser._id);
            
            // Add the dummy user to our results
            users.push({
              _id: dummyUser._id,
              name: dummyUser.name,
              email: dummyUser.email,
              phone: dummyUser.phone
            });
          } catch (dummyError) {
            console.error('Failed to create dummy user:', dummyError);
          }
        }
      }
      
      res.json({
        success: true,
        users
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ 
        success: false, 
        message: error.message || 'Failed to fetch users' 
      });
    }
  });

// Transfer money between users
router.route('/transfer')
  .post(auth, async (req, res) => {
    try {
      const { receiverId, amount, note } = req.body;
      const senderId = req.user.id;
      
      if (!receiverId || !amount || amount <= 0) {
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

// Get user transactions
router.route('/transactions')
  .get(auth, async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Find all transactions where user is sender or receiver
      const transactions = await Transaction.find({
        $or: [
          { senderId: userId },
          { receiverId: userId }
        ]
      }).sort({ date: -1 }).limit(50);
      
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
