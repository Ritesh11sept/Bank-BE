import express from 'express';
import auth from '../middleware/auth.js'; // Changed from { auth } to default import
import Pot from '../models/Pot.js';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import User from '../models/Users.js';  // Changed from User.js to Users.js
const router = express.Router();

// Helper to get user from token
const getUserFromToken = async (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Authorization token required');
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = jwt.verify(token, process.env.JWT_SECRET || "devfallbacksecret");
  
  const user = await User.findById(decoded.id);
  if (!user) {
    throw new Error('User not found');
  }
  
  return user;
};

// Get all pots for current user
router.get('/', auth, async (req, res) => {
  try {
    // Make sure we have a valid user ID
    const userId = req.user.id || req.user._id;
    
    if (!userId) {
      return res.status(400).json({ 
        message: 'User ID is missing in auth token',
        error: 'Invalid user identification'
      });
    }

    console.log('Getting pots for user:', userId);
    
    // Convert to string to ensure consistent comparison
    const pots = await Pot.find({ userId: userId.toString() }).sort({ createdAt: -1 });
    console.log('Found pots:', pots);
    res.json(pots);
  } catch (error) {
    console.error('Error getting pots:', error);
    res.status(500).json({ 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Create pot - now using auth middleware for consistency
router.post("/", auth, async (req, res) => {
  try {
    const { name, category, goalAmount } = req.body;
    
    // Use the user from auth middleware
    // Handle both id and _id for flexibility
    const userId = req.user.id || req.user._id;
    
    if (!userId) {
      return res.status(400).json({ 
        success: false,
        message: 'User ID is missing in auth token' 
      });
    }
    
    // Create the pot
    const pot = new Pot({
      name,
      category,
      goalAmount: goalAmount || 0,
      balance: 0,
      userId: userId.toString(),
      createdAt: new Date() // Explicitly set creation date
    });
    
    await pot.save();
    
    // Award points for creating a pot
    // Make API call to rewards service
    try {
      const rewardResponse = await axios.post(
        `${req.protocol}://${req.get('host')}/rewards/pot-reward`,
        {
          action: 'create',
          potName: name
        },
        {
          headers: {
            Authorization: req.headers.authorization
          }
        }
      );
      
      // Use reward response if needed
      const rewardData = rewardResponse.data;
    } catch (rewardError) {
      console.error('Error awarding pot creation reward:', rewardError);
      // Continue - non-critical operation
    }
    
    res.status(201).json({
      success: true,
      pot
    });
  } catch (error) {
    console.error('Create pot error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to create pot' 
    });
  }
});

// Deposit to pot
router.post("/:id/deposit", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }
    
    // First get the user to deduct from their balance
    const user = await getUserFromToken(req);
    
    // Check if user has enough balance
    if (user.bankBalance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance'
      });
    }
    
    // Find the pot
    const pot = await Pot.findById(id);
    if (!pot) {
      return res.status(404).json({
        success: false,
        message: 'Pot not found'
      });
    }
    
    // Verify pot belongs to user
    if (pot.userId.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to pot'
      });
    }
    
    // Deduct from user's balance
    user.bankBalance -= Number(amount);
    await user.save();
    
    // Add to pot's balance
    pot.balance += Number(amount);
    
    // Check if goal is reached
    const goalReached = pot.goalAmount > 0 && pot.balance >= pot.goalAmount && (pot.balance - amount) < pot.goalAmount;
    
    await pot.save();
    
    // Add transaction record
    // ...existing transaction code if any...
    
    // Award points for deposit
    try {
      const rewardAction = goalReached ? 'goal-reached' : 'deposit';
      
      const rewardResponse = await axios.post(
        `${req.protocol}://${req.get('host')}/rewards/pot-reward`,
        {
          action: rewardAction,
          amount: Number(amount),
          potName: pot.name
        },
        {
          headers: {
            Authorization: req.headers.authorization
          }
        }
      );
      
      // Use reward response if needed
      const rewardData = rewardResponse.data;
    } catch (rewardError) {
      console.error('Error awarding deposit reward:', rewardError);
      // Continue - non-critical operation
    }
    
    res.json({
      success: true,
      pot,
      goalReached
    });
  } catch (error) {
    console.error('Deposit error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to deposit to pot' 
    });
  }
});

// Withdraw from pot
router.post("/:id/withdraw", async (req, res) => {
  try {
    const { id } = req.params;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid amount'
      });
    }
    
    // Find the pot
    const pot = await Pot.findById(id);
    if (!pot) {
      return res.status(404).json({
        success: false,
        message: 'Pot not found'
      });
    }
    
    // Check if pot has enough balance
    if (pot.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient pot balance'
      });
    }
    
    // Get the user to add to their balance
    const user = await getUserFromToken(req);
    
    // Verify pot belongs to user
    if (pot.userId.toString() !== user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized access to pot'
      });
    }
    
    // Add to user's balance
    user.bankBalance += Number(amount);
    await user.save();
    
    // Deduct from pot's balance
    pot.balance -= Number(amount);
    await pot.save();
    
    // Add transaction record
    // ...existing transaction code if any...
    
    // Award points for withdrawal
    try {
      const rewardResponse = await axios.post(
        `${req.protocol}://${req.get('host')}/rewards/pot-reward`,
        {
          action: 'withdraw',
          amount: Number(amount),
          potName: pot.name
        },
        {
          headers: {
            Authorization: req.headers.authorization
          }
        }
      );
      
      // Use reward response if needed
      const rewardData = rewardResponse.data;
    } catch (rewardError) {
      console.error('Error awarding withdrawal reward:', rewardError);
      // Continue - non-critical operation
    }
    
    res.json({
      success: true,
      pot
    });
  } catch (error) {
    console.error('Withdraw error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to withdraw from pot' 
    });
  }
});

// Set/update goal amount
router.put('/:id/goal', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { goalAmount } = req.body;
    
    if (!id) {
      return res.status(400).json({ message: 'Pot ID is required' });
    }

    if (typeof goalAmount !== 'number' || goalAmount < 0) {
      return res.status(400).json({ message: 'Invalid goal amount' });
    }
    
    // Get user ID consistently
    const userId = req.user.id || req.user._id;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is missing in auth token' });
    }
    
    const pot = await Pot.findOne({ _id: id, userId: userId.toString() });
    if (!pot) {
      return res.status(404).json({ message: 'Pot not found' });
    }
    
    pot.goalAmount = goalAmount;
    const updatedPot = await pot.save();
    
    res.json(updatedPot);
  } catch (error) {
    console.error('Error updating goal amount:', error);
    res.status(400).json({ 
      message: error.message || 'Failed to update goal',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

// Delete a pot
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get user ID consistently
    const userId = req.user.id || req.user._id;
    
    if (!userId) {
      return res.status(400).json({ message: 'User ID is missing in auth token' });
    }
    
    // Find pot and check ownership
    const pot = await Pot.findOne({ _id: id, userId: userId.toString() });
    if (!pot) {
      return res.status(404).json({ message: 'Pot not found' });
    }
    
    await pot.deleteOne();
    res.json({ message: 'Pot deleted successfully' });
  } catch (error) {
    console.error('Error deleting pot:', error);
    res.status(400).json({ 
      message: 'Failed to delete pot',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;