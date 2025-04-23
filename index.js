import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import rewardsRoutes from './routes/rewards.js';
import transactionRoutes from "./routes/transaction.js";
import potsRoutes from "./routes/pots.js";
import userRoutes from "./routes/user.js";
import ticketsRoutes from "./routes/tickets.js";
import Transaction from "./models/Transaction.js";
// Add these imports to ensure models are registered
import "./models/Users.js";
import "./models/Ticket.js";

/* CONFIGURATIONS */
dotenv.config();
const app = express();
app.use(express.json({limit: '50mb'}));  // Increase payload limit for base64 images
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: "cross-origin" }));
app.use(morgan("common"));
app.use(bodyParser.json({limit: '50mb'}));  // Increase payload limit for base64 images
app.use(bodyParser.urlencoded({ extended: false }));

// Improved CORS handling
app.use((req, res, next) => {
  // Allow specific origins instead of all (*) when using credentials
  const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  // Add the credentials header - this is crucial
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Update the existing CORS middleware to ensure consistent settings
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'],
  credentials: true, // Make sure this is set to true
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept']
}));

/* ROUTES */
// Main application routes
app.use("/transaction", transactionRoutes);
app.use("/pots", potsRoutes);
app.use("/user", userRoutes);

// Rewards system routes
app.use("/rewards", rewardsRoutes);

// Support ticket routes
app.use("/tickets", ticketsRoutes);

// Add some debugging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

/* ERROR HANDLING MIDDLEWARE */
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

/* MONGOOSE SETUP */
const PORT = process.env.PORT || 9000;

mongoose
  .connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    app.listen(PORT, () => console.log(`Server Port: ${PORT}`));
    console.log('MongoDB Connected Successfully');
    
    /* ADD DATA ONE TIME ONLY OR AS NEEDED */
    // Database seeding can be implemented here if needed in the future
  })
  .catch((error) => {
    console.error(`MongoDB Connection Error: ${error}`);
    process.exit(1);
  });

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'API is running',
    env: process.env.NODE_ENV || 'development'
  });
});

// Catch all 404 routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});
