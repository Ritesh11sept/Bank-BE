import express from "express";
import KPI from "../models/KPI.js";

const router = express.Router();

router.get("/kpis", async (req, res) => {
  console.log('KPI Route - Received request');
  // Add CORS headers
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  try {
    // Check if database is connected
    if (!KPI.db.readyState) {
      console.error('Database not connected');
      return res.status(500).json({ message: 'Database connection error' });
    }

    console.log('KPI Route - Fetching KPIs from database');
    const kpis = await KPI.find();
    
    if (!kpis || kpis.length === 0) {
      console.log('KPI Route - No KPIs found');
      return res.status(404).json({ message: 'No KPIs found' });
    }

    console.log('KPI Route - Found KPIs:', kpis.length);
    return res.status(200).json(kpis);
  } catch (error) {
    console.error('KPI Route - Error:', error.message);
    console.error('Stack:', error.stack);
    return res.status(500).json({ 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export default router;
