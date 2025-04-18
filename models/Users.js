import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide a name'],
  },
  email: {
    type: String,
    required: [true, 'Please provide an email'],
    unique: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },
  pan: {
    type: String,
    required: [true, 'Please provide PAN number'],
    unique: true,
    match: [/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Please provide a valid PAN number'],
  },
  phone: {
    type: String,
    required: [true, 'Please provide phone number'],
    match: [/^[0-9]{10}$/, 'Please provide a valid phone number'],
  },
  password: {
    type: String,
    required: [true, 'Please provide a password'],
    minlength: 6,
    select: false,
  },
  linkedAccounts: [{
    bankName: String,
    accountNumber: String,
    ifscCode: String,
    balance: Number
  }],
  dateOfBirth: {
    type: String, // Changed from Date to String to handle different date formats
    required: [true, 'Please provide date of birth'],
  },
  age: {
    type: Number,
    required: [true, 'Age is required'],
  },
  rewards: {
    points: {
      type: Number,
      default: 0
    },
    loginStreak: {
      type: Number,
      default: 0
    },
    lastLogin: {
      type: Date,
      default: null
    },
    scratchCards: [{
      id: String,
      type: {
        type: String,
        enum: ['cashback', 'discount', 'points']
      },
      value: String,
      isNew: Boolean,
      expiry: Date,
      isRevealed: {
        type: Boolean,
        default: false
      }
    }],
    claimedOffers: [{
      offerId: String,
      claimedAt: {
        type: Date,
        default: Date.now
      }
    }],
    gameScores: [{
      game: String,
      score: Number,
      playedAt: {
        type: Date,
        default: Date.now
      }
    }]
  },
  notifications: [{
    id: {
      type: String,
      default: () => new mongoose.Types.ObjectId().toString()
    },
    type: {
      type: String,
      enum: ['reward', 'transaction', 'alert', 'system'],
      default: 'system'
    },
    title: String,
    message: String,
    isRead: {
      type: Boolean,
      default: false
    },
    icon: {
      type: String,
      default: 'notification'
    },
    link: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  bankBalance: {
    type: Number,
    default: 150000,
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Match password method
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', UserSchema);
