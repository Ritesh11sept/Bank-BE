import mongoose from "mongoose";
import dotenv from "dotenv";
import { kpis, products, transactions } from "./data/data.js";
import KPI from "./models/KPI.js";
import Product from "./models/Product.js";
import Transaction from "./models/Transaction.js";

dotenv.config();

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    mongoose.set("strictQuery", false);
    await mongoose.connect(process.env.MONGO_URL);
    console.log("Connected to MongoDB");

    // Delete existing data
    await mongoose.connection.db.dropDatabase();
    console.log("Previous data deleted");

    // Convert string currency to numbers (remove $ and convert to cents)
    const formattedKpis = kpis.map(kpi => ({
      ...kpi,
      totalProfit: parseInt(kpi.totalProfit.replace("$", "").replace(",", "") * 100),
      totalRevenue: parseInt(kpi.totalRevenue.replace("$", "").replace(",", "") * 100),
      totalExpenses: parseInt(kpi.totalExpenses.replace("$", "").replace(",", "") * 100),
      expensesByCategory: Object.fromEntries(
        Object.entries(kpi.expensesByCategory).map(([key, value]) => [
          key,
          parseInt(value.replace("$", "").replace(",", "") * 100)
        ])
      ),
      monthlyData: kpi.monthlyData.map(month => ({
        ...month,
        revenue: parseInt(month.revenue.replace("$", "").replace(",", "") * 100),
        expenses: parseInt(month.expenses.replace("$", "").replace(",", "") * 100),
        operationalExpenses: parseInt(month.operationalExpenses.replace("$", "").replace(",", "") * 100),
        nonOperationalExpenses: parseInt(month.nonOperationalExpenses.replace("$", "").replace(",", "") * 100)
      })),
      dailyData: kpi.dailyData.map(day => ({
        ...day,
        revenue: parseInt(day.revenue.replace("$", "").replace(",", "") * 100),
        expenses: parseInt(day.expenses.replace("$", "").replace(",", "") * 100)
      }))
    }));

    const formattedProducts = products.map(product => ({
      ...product,
      price: parseInt(product.price.replace("$", "").replace(",", "") * 100),
      expense: parseInt(product.expense.replace("$", "").replace(",", "") * 100)
    }));

    const formattedTransactions = transactions.map(transaction => ({
      ...transaction,
      amount: parseInt(transaction.amount.replace("$", "").replace(",", "") * 100)
    }));

    // Insert formatted data
    await KPI.insertMany(formattedKpis);
    await Product.insertMany(formattedProducts);
    await Transaction.insertMany(formattedTransactions);

    console.log("Database seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
};

seedDatabase();
