import mongoose from 'mongoose';

const potSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Pot name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required']
  },
  goalAmount: {
    type: Number,
    default: 0
  },
  balance: {
    type: Number,
    default: 0
  },
  userId: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const Pot = mongoose.model('Pot', potSchema);

export default Pot;