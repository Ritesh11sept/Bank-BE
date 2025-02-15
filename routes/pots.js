import express from 'express';
import { auth } from '../middleware/auth.js';
import Pot from '../models/Pot.js';
import mongoose from 'mongoose';
const router = express.Router();

// Get all pots for current user
router.get('/', auth, async (req, res) => {
  try {
    console.log('Getting pots for user:', req.user.id);
    const pots = await Pot.find({ userId: String(req.user.id) }).sort({ createdAt: -1 });
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

// Create a new pot
router.post('/', auth, async (req, res) => {
  try {
    const { name, category } = req.body;
    console.log('Creating pot:', { name, category, userId: req.user.id });
    
    const newPot = new Pot({
      name,
      category,
      userId: String(req.user.id)
    });
    
    const savedPot = await newPot.save();
    console.log('Created pot:', savedPot);
    res.status(201).json(savedPot);
  } catch (error) {
    console.error('Error creating pot:', error);
    res.status(400).json({ 
      message: 'Failed to create pot',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Deposit money to a pot
router.post('/:id/deposit', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const { amount } = req.body;
    
    // Find pot and check ownership
    const pot = await Pot.findOne({ _id: id, userId: String(req.user.id) });
    if (!pot) {
      return res.status(404).json({ message: 'Pot not found' });
    }
    
    // Update pot balance
    pot.balance += Number(amount);
    await pot.save({ session });
    
    await session.commitTransaction();
    res.json(pot);
  } catch (error) {
    await session.abortTransaction();
    console.error('Error depositing to pot:', error);
    res.status(400).json({ 
      message: 'Failed to deposit',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    session.endSession();
  }
});

// Withdraw money from a pot
router.post('/:id/withdraw', auth, async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const { amount } = req.body;
    
    // Find pot and check ownership
    const pot = await Pot.findOne({ _id: id, userId: String(req.user.id) });
    if (!pot) {
      return res.status(404).json({ message: 'Pot not found' });
    }
    
    // Check if pot has enough balance
    if (pot.balance < amount) {
      return res.status(400).json({ message: 'Insufficient funds in pot' });
    }
    
    // Update pot balance
    pot.balance -= Number(amount);
    await pot.save({ session });
    
    await session.commitTransaction();
    res.json(pot);
  } catch (error) {
    await session.abortTransaction();
    console.error('Error withdrawing from pot:', error);
    res.status(400).json({ 
      message: 'Failed to withdraw',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    session.endSession();
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
    
    const pot = await Pot.findOne({ _id: id, userId: String(req.user.id) });
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
    
    // Find pot and check ownership
    const pot = await Pot.findOne({ _id: id, userId: String(req.user.id) });
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