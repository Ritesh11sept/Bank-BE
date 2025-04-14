import express from "express";
import Transaction from "../models/Transaction.js";
import User from "../models/Users.js"; // Updated to use Users.js instead of User.js
import auth from '../middleware/auth.js';

const router = express.Router();

router.get("/transactions", async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .limit(50)
      .sort({ createdOn: -1 });

    res.status(200).json(transactions);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

export default router;
