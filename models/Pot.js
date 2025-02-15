import mongoose from 'mongoose';

const PotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    category: { type: String, required: true },
    balance: { type: Number, default: 0 },
    goalAmount: { type: Number, default: 0 },
    userId: { type: String, required: true }, // Changed from ObjectId to String
  },
  { timestamps: true }
);

const Pot = mongoose.model('Pot', PotSchema);

export default Pot;