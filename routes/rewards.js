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
      
      // Add notification
      user.notifications.push({
        type: 'reward',
        title: 'Welcome Bonus!',
        message: 'You earned 10 points for your first login.',
        icon: 'gift'
      });
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
          
          // Add notification for weekly streak
          user.notifications.push({
            type: 'reward',
            title: 'Weekly Streak Bonus!',
            message: `Congratulations! You've logged in for ${user.rewards.loginStreak} consecutive days and earned 50 bonus points.`,
            icon: 'calendar'
          });
          
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
          
          // Add notification for scratch card
          user.notifications.push({
            type: 'reward',
            title: 'New Scratch Card!',
            message: 'You received a special scratch card for your weekly login streak.',
            icon: 'gift'
          });
        } else {
          // Regular streak notification
          user.notifications.push({
            type: 'reward',
            title: 'Login Streak!',
            message: `You've logged in for ${user.rewards.loginStreak} consecutive days and earned ${streakBonus} points.`,
            icon: 'calendar'
          });
        }
        
        user.rewards.points += streakBonus;
      } else if (daysDiff > 1) {
        // Streak broken
        user.rewards.loginStreak = 1;
        user.rewards.points += 5; // Basic points for logging in
        
        // Add notification for streak reset
        user.notifications.push({
          type: 'alert',
          title: 'Login Streak Reset',
          message: 'Your login streak was reset. Visit daily to build your streak again!',
          icon: 'calendar'
        });
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
      
      // Add notification for scratch card
      user.notifications.push({
        type: 'reward',
        title: 'Daily Scratch Card',
        message: 'You received a new scratch card for logging in today!',
        icon: 'gift'
      });
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
    let rewardMessage = '';
    
    if (card.type === 'points') {
      const pointsValue = parseInt(card.value);
      user.rewards.points += pointsValue;
      rewardMessage = `${pointsValue} points added to your account!`;
    } else if (card.type === 'cashback') {
      const cashbackValue = parseInt(card.value);
      user.bankBalance += cashbackValue;
      rewardMessage = `₹${cashbackValue} cashback added to your account!`;
    }
    
    // Add notification for revealed card
    user.notifications.push({
      type: 'reward',
      title: 'Scratch Card Reward!',
      message: rewardMessage,
      icon: 'gift'
    });
    
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
    
    // Add notification for game points
    user.notifications.push({
      type: 'reward',
      title: 'Game Reward!',
      message: `You earned ${pointsAwarded} points from playing ${game}!`,
      icon: 'game'
    });
    
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

// Award pot interaction rewards
router.post('/pot-reward', async (req, res) => {
  try {
    const { action, amount, potName } = req.body;
    const user = await getUserFromToken(req);
    
    let pointsAwarded = 0;
    let scratchCard = null;
    
    // Calculate rewards based on action
    switch(action) {
      case 'create':
        // Award 20 points for creating a pot
        pointsAwarded = 20;
        user.rewards.points += pointsAwarded;
        
        // Add notification
        user.notifications.push({
          type: 'reward',
          title: 'New Pot Bonus!',
          message: `You earned ${pointsAwarded} points for creating a new savings pot.`,
          icon: 'pot'
        });
        break;
        
      case 'deposit':
        // Award 1 point for every 100 deposited, minimum 5 points
        pointsAwarded = Math.max(5, Math.floor(amount / 100));
        user.rewards.points += pointsAwarded;
        
        // Add notification
        user.notifications.push({
          type: 'reward',
          title: 'Deposit Bonus!',
          message: `You earned ${pointsAwarded} points for depositing ₹${amount} to your ${potName} pot.`,
          icon: 'deposit'
        });
        
        // 10% chance to get a scratch card for deposits over 1000
        if (amount >= 1000 && Math.random() < 0.1) {
          scratchCard = {
            id: `sc-${Date.now()}`,
            type: Math.random() > 0.6 ? 'cashback' : 'points',
            value: Math.floor(amount * 0.05), // 5% of deposit amount
            isNew: true,
            expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
            isRevealed: false
          };
          
          if (!user.rewards.scratchCards) {
            user.rewards.scratchCards = [];
          }
          
          user.rewards.scratchCards.push(scratchCard);
          
          // Add notification for scratch card
          user.notifications.push({
            type: 'reward',
            title: 'Deposit Scratch Card!',
            message: `You received a special scratch card for depositing to your ${potName} pot!`,
            icon: 'gift'
          });
        }
        break;
        
      case 'withdraw':
        // Small reward for withdrawals
        pointsAwarded = Math.floor(amount / 500); // 1 point per 500 withdrawn
        if (pointsAwarded > 0) {
          user.rewards.points += pointsAwarded;
          
          // Add notification
          user.notifications.push({
            type: 'reward',
            title: 'Withdrawal Points',
            message: `You earned ${pointsAwarded} points for your withdrawal.`,
            icon: 'withdraw'
          });
        }
        break;
        
      case 'goal-reached':
        // Big reward for reaching a goal
        pointsAwarded = 50;
        user.rewards.points += pointsAwarded;
        
        // Always give a scratch card for completing a goal
        scratchCard = {
          id: `sc-${Date.now()}`,
          type: Math.random() > 0.4 ? 'cashback' : 'points',
          value: Math.floor(Math.random() * 200) + 100, // 100-300 reward
          isNew: true,
          expiry: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
          isRevealed: false
        };
        
        if (!user.rewards.scratchCards) {
          user.rewards.scratchCards = [];
        }
        
        user.rewards.scratchCards.push(scratchCard);
        
        // Add notifications
        user.notifications.push({
          type: 'reward',
          title: 'Goal Achieved!',
          message: `Congratulations! You earned ${pointsAwarded} points for reaching your savings goal!`,
          icon: 'goal'
        });
        
        user.notifications.push({
          type: 'reward',
          title: 'Goal Achievement Bonus!',
          message: 'You received a special scratch card for reaching your savings goal!',
          icon: 'gift'
        });
        break;
    }
    
    await user.save();
    
    res.json({
      success: true,
      pointsAwarded,
      scratchCard,
      rewards: user.rewards
    });
  } catch (error) {
    console.error('Pot reward error:', error);
    res.status(401).json({ 
      success: false, 
      message: error.message || 'Failed to award pot reward' 
    });
  }
});

// Get user notifications
router.get('/notifications', async (req, res) => {
  try {
    const user = await getUserFromToken(req);
    
    res.json({
      success: true,
      notifications: user.notifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(401).json({ 
      success: false, 
      message: error.message || 'Failed to get notifications' 
    });
  }
});

// Mark notifications as read
router.post('/notifications/read', async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const user = await getUserFromToken(req);
    
    // If no IDs provided, mark all as read
    if (!notificationIds || notificationIds.length === 0) {
      user.notifications.forEach(notification => {
        notification.isRead = true;
      });
    } else {
      // Mark specific notifications as read
      user.notifications.forEach(notification => {
        if (notificationIds.includes(notification.id)) {
          notification.isRead = true;
        }
      });
    }
    
    await user.save();
    
    res.json({
      success: true,
      notifications: user.notifications
    });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    res.status(401).json({ 
      success: false, 
      message: error.message || 'Failed to mark notifications as read' 
    });
  }
});

export default router;
