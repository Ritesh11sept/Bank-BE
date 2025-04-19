import express from "express";
import Transaction from "../models/Transaction.js";
import Users from "../models/Users.js";
import auth from '../middleware/auth.js';

const router = express.Router();

// Basic transactions endpoint
router.get("/transactions", async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .limit(50)
      .sort({ date: -1 });

    res.status(200).json(transactions);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// Detailed transactions endpoint - ensure all transactions are returned
router.get("/detailed-transactions", auth, async (req, res) => {
  try {
    // Get the authenticated user's ID from auth middleware
    const userId = req.user.id;
    console.log("Fetching detailed transactions for user:", userId);
    
    // Find transactions where the user is either the sender or receiver
    const transactions = await Transaction.find({
      $or: [
        { senderId: userId },
        { receiverId: userId }
      ]
    })
    .sort({ date: -1 });
    
    console.log(`Found ${transactions.length} transactions for user ${userId}`);
    
    // Add transaction type information to help with debugging
    const processedTransactions = transactions.map(t => {
      const isIncome = t.receiverId.toString() === userId;
      const isExpense = t.senderId.toString() === userId;
      
      return {
        ...t.toObject(),
        _transactionType: isIncome ? 'income' : isExpense ? 'expense' : 'unknown'
      };
    });
    
    // Log income/expense counts
    const incomeCount = processedTransactions.filter(t => t._transactionType === 'income').length;
    const expenseCount = processedTransactions.filter(t => t._transactionType === 'expense').length;
    
    console.log(`Income transactions: ${incomeCount}, Expense transactions: ${expenseCount}`);
    
    // Return processed transactions
    res.status(200).json(processedTransactions);
    
  } catch (error) {
    console.error("Error fetching detailed transactions:", error);
    res.status(500).json({ message: "Error fetching transaction data", error: error.message });
  }
});

export default router;
