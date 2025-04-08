import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/Users.js';

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

// Get user rewards
router.get('/', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    
    res.json({
      success: true,
      rewards: user.rewards
    });
  } catch (error) {
    console.error('Get rewards error:', error);
    res.status(401).json({ 
      success: false, 
      message: error.message || 'Failed to get rewards' 
    });
  }
});

// Update login streak
router.post('/login-streak', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    
    // Calculate streak
    const now = new Date();
    const lastLogin = user.rewards.lastLogin ? new Date(user.rewards.lastLogin) : null;
    
    // Check if this is first login or if it's a new day
    if (!lastLogin) {
      // First login ever
      user.rewards.loginStreak = 1;
      user.rewards.points += 10; // Award points for first login
    } else {
      // Calculate days between logins
      const timeDiff = Math.abs(now - lastLogin);
      const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Consecutive day
        user.rewards.loginStreak += 1;
        
        // Bonus points based on streak
        let streakBonus = 5; // Base bonus
        if (user.rewards.loginStreak % 7 === 0) {
          // Weekly bonus
          streakBonus = 50;
          
          // Add a scratch card for weekly streak
          const newScratchCard = {
            id: `sc-${Date.now()}`,
            type: Math.random() > 0.5 ? 'cashback' : 'points',
            value: Math.random() > 0.5 ? `${Math.floor(Math.random() * 100) + 50}` : `${Math.floor(Math.random() * 200) + 100}`,
            isNew: true,
            expiry: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            isRevealed: false
          };
          
          if (!user.rewards.scratchCards) {
            user.rewards.scratchCards = [];
          }
          user.rewards.scratchCards.push(newScratchCard);
        }
        
        user.rewards.points += streakBonus;
      } else if (daysDiff > 1) {
        // Streak broken
        user.rewards.loginStreak = 1;
        user.rewards.points += 5; // Basic points for logging in
      }
      // If daysDiff = 0, same day login, don't change streak or add points
    }
    
    // Update last login
    user.rewards.lastLogin = now;
    
    // Add a daily scratch card if user doesn't have unrevealed cards
    const hasUnrevealedCard = user.rewards.scratchCards && 
                              user.rewards.scratchCards.some(card => !card.isRevealed);
    
    if (!hasUnrevealedCard) {
      if (!user.rewards.scratchCards) {
        user.rewards.scratchCards = [];
      }
      
      // Add a new scratch card
      const newScratchCard = {
        id: `sc-${Date.now()}`,
        type: Math.random() > 0.7 ? 'cashback' : (Math.random() > 0.5 ? 'discount' : 'points'),
        value: Math.floor(Math.random() * 50) + (user.rewards.loginStreak > 5 ? 50 : 10),
        isNew: true,
        expiry: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        isRevealed: false
      };
      
      user.rewards.scratchCards.push(newScratchCard);
    }
    
    await user.save();
    
    res.json({
      success: true,
      rewards: user.rewards
    });
  } catch (error) {
    console.error('Update login streak error:', error);
    res.status(401).json({ 
      success: false, 
      message: error.message || 'Failed to update login streak' 
    });
  }
});

// Reveal scratch card
router.post('/scratch-card/:id', async (req, res) => {
  try {
    const cardId = req.params.id;
    const user = await getUserFromToken(req);
    
    // Find the scratch card
    const cardIndex = user.rewards.scratchCards.findIndex(card => card.id === cardId);
    
    if (cardIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Scratch card not found'
      });
    }
    
    // Reveal the card
    user.rewards.scratchCards[cardIndex].isRevealed = true;
    user.rewards.scratchCards[cardIndex].isNew = false;
    
    // Process reward
    const card = user.rewards.scratchCards[cardIndex];
    if (card.type === 'points') {
      user.rewards.points += parseInt(card.value);
    } else if (card.type === 'cashback') {
      // Add cashback to user's balance
      user.bankBalance += parseInt(card.value);
    }
    
    await user.save();
    
    res.json({
      success: true,
      card: user.rewards.scratchCards[cardIndex],
      rewards: user.rewards
    });
  } catch (error) {
    console.error('Reveal scratch card error:', error);
    res.status(401).json({ 
      success: false, 
      message: error.message || 'Failed to reveal scratch card' 
    });
  }
});

// Save game score
router.post('/game-score', async (req, res) => {
  try {
    const { game, score } = req.body;
    const user = await getUserFromToken(req);
    
    if (!user.rewards.gameScores) {
      user.rewards.gameScores = [];
    }
    
    // Add new game score
    user.rewards.gameScores.push({
      game,
      score,
      playedAt: new Date()
    });
    
    // Award points based on score
    const pointsAwarded = Math.floor(score / 10);
    user.rewards.points += pointsAwarded;
    
    await user.save();
    
    res.json({
      success: true,
      pointsAwarded,
      rewards: user.rewards
    });
  } catch (error) {
    console.error('Save game score error:', error);
    res.status(401).json({ 
      success: false, 
      message: error.message || 'Failed to save game score' 
    });
  }
});

export default router;
