import express from "express";
import mongoose from "mongoose";
import Ticket from "../models/Ticket.js";
// Change import to use Users.js instead of User.js
import User from "../models/Users.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Demo mode data for testing
const demoTickets = [
  {
    _id: "demo_ticket_1",
    subject: "Demo Ticket - Account Access",
    description: "This is a demo ticket for development. No actual database operations are performed.",
    status: "new",
    priority: "medium",
    category: "account",
    userId: "temp_user_id",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: [
      {
        _id: "demo_message_1",
        content: "Hi, I cannot access my account. It says my password is incorrect even though I'm sure it's right.",
        userId: "temp_user_id",
        isAdmin: false,
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        _id: "demo_message_2",
        content: "Hello, thanks for contacting support. I'll help you recover your account access. Have you tried the password reset option?",
        userId: "admin_user_id",
        isAdmin: true,
        createdAt: new Date(Date.now() - 82800000).toISOString()
      }
    ]
  },
  {
    _id: "demo_ticket_2",
    subject: "Demo Ticket - Payment Issue",
    description: "This is another demo ticket showing a different status and priority. No actual database operations are performed.",
    status: "inProgress",
    priority: "high", 
    category: "payments",
    userId: "temp_user_id",
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 43200000).toISOString(),
    messages: [
      {
        _id: "demo_message_3",
        content: "My payment to vendor XYZ failed but the money was deducted from my account. Please help!",
        userId: "temp_user_id",
        isAdmin: false,
        createdAt: new Date(Date.now() - 172800000).toISOString()
      },
      {
        _id: "demo_message_4",
        content: "I can confirm that we're looking into this issue. Your reference number is PAY-20230615. We'll update you shortly.",
        userId: "admin_user_id",
        isAdmin: true,
        createdAt: new Date(Date.now() - 144000000).toISOString()
      },
      {
        _id: "demo_message_5",
        content: "Any updates on this? It's quite urgent as I need to make the payment today.",
        userId: "temp_user_id",
        isAdmin: false,
        createdAt: new Date(Date.now() - 86400000).toISOString()
      }
    ]
  }
];

// Get all tickets (public access)
router.get("/", async (req, res) => {
  try {
    // Find all tickets without auth check
    const tickets = await Ticket.find()
      .sort({ updatedAt: -1 })
      .populate("userId", "name email");

    res.status(200).json(tickets);
  } catch (error) {
    console.error("Error getting tickets:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get tickets for a specific user
router.get("/user/:userId", auth, async (req, res) => {
  try {
    // Handle demo mode
    if (req.user.isDemo || req.params.userId === 'temp_user_id') {
      return res.status(200).json(demoTickets);
    }

    // Ensure user can only access their own tickets
    if (req.user.id !== req.params.userId && !req.user.isAdmin) {
      return res.status(403).json({ message: "Not authorized to view these tickets" });
    }

    const tickets = await Ticket.find({ userId: req.params.userId })
      .sort({ updatedAt: -1 });
    
    res.status(200).json(tickets);
  } catch (error) {
    console.error("Error getting user tickets:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get a specific ticket by ID
router.get("/:id", auth, async (req, res) => {
  try {
    // Handle demo mode
    if (req.user.isDemo) {
      const demoTicket = demoTickets.find(ticket => ticket._id === req.params.id);
      if (demoTicket) {
        return res.status(200).json(demoTicket);
      }
      return res.status(404).json({ message: "Demo ticket not found" });
    }

    const ticket = await Ticket.findById(req.params.id)
      .populate("userId", "name email")
      .populate("assignedTo", "name email");
    
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Ensure user can only access their own tickets or admin can access any
    const user = await User.findById(req.user.id);
    if (ticket.userId.toString() !== req.user.id && !user.isAdmin) {
      return res.status(403).json({ message: "Not authorized to view this ticket" });
    }

    res.status(200).json(ticket);
  } catch (error) {
    console.error("Error getting ticket details:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get messages for a specific ticket
router.get("/:id/messages", auth, async (req, res) => {
  try {
    // Handle demo mode
    if (req.user.isDemo) {
      const demoTicket = demoTickets.find(ticket => ticket._id === req.params.id);
      if (demoTicket) {
        return res.status(200).json(demoTicket.messages);
      }
      return res.status(404).json({ message: "Demo ticket not found" });
    }

    const ticket = await Ticket.findById(req.params.id);
    
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Ensure user can only access their own tickets or admin can access any
    const user = await User.findById(req.user.id);
    if (ticket.userId.toString() !== req.user.id && !user.isAdmin) {
      return res.status(403).json({ message: "Not authorized to view this ticket" });
    }

    res.status(200).json(ticket.messages);
  } catch (error) {
    console.error("Error getting ticket messages:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Create a new ticket
router.post("/", auth, async (req, res) => {
  try {
    const { subject, description, category, priority } = req.body;
    
    // Handle demo mode
    if (req.user.isDemo) {
      const mockTicket = {
        _id: `demo_ticket_${Date.now()}`,
        subject,
        description,
        category,
        priority,
        status: "new",
        userId: "temp_user_id",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [
          {
            _id: `demo_message_${Date.now()}`,
            content: description,
            userId: "temp_user_id",
            isAdmin: false,
            createdAt: new Date().toISOString()
          }
        ]
      };
      
      // Add to demo tickets array (this will be lost on server restart)
      demoTickets.push(mockTicket);
      
      return res.status(201).json(mockTicket);
    }
    
    // Create new ticket
    const newTicket = new Ticket({
      subject,
      description,
      userId: req.user.id,
      category,
      priority,
      messages: [{
        content: description,
        userId: req.user.id,
        isAdmin: false
      }]
    });

    const savedTicket = await newTicket.save();
    res.status(201).json(savedTicket);
  } catch (error) {
    console.error("Error creating ticket:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Add a message to a ticket
router.post("/:id/messages", auth, async (req, res) => {
  try {
    const { content } = req.body;
    
    // Handle demo mode
    if (req.user.isDemo) {
      const demoTicket = demoTickets.find(ticket => ticket._id === req.params.id);
      if (!demoTicket) {
        return res.status(404).json({ message: "Demo ticket not found" });
      }
      
      const newMessage = {
        _id: `demo_message_${Date.now()}`,
        content,
        userId: "temp_user_id",
        isAdmin: false,
        createdAt: new Date().toISOString()
      };
      
      demoTicket.messages.push(newMessage);
      demoTicket.updatedAt = new Date().toISOString();
      
      return res.status(201).json(newMessage);
    }
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Check if user is admin
    const user = await User.findById(req.user.id);
    const isAdmin = user && user.isAdmin;
    
    // Ensure user can only message their own tickets or admin can message any
    if (ticket.userId.toString() !== req.user.id && !isAdmin) {
      return res.status(403).json({ message: "Not authorized to message this ticket" });
    }

    // Don't allow messaging closed tickets
    if (ticket.status === "closed") {
      return res.status(400).json({ message: "Cannot add messages to a closed ticket" });
    }

    // Update ticket status to inProgress if it's new and an admin is replying
    if (ticket.status === "new" && isAdmin) {
      ticket.status = "inProgress";
    }

    // Add message to ticket
    const newMessage = {
      content,
      userId: req.user.id,
      isAdmin
    };

    ticket.messages.push(newMessage);
    await ticket.save();

    // Return only the new message
    res.status(201).json(ticket.messages[ticket.messages.length - 1]);
  } catch (error) {
    console.error("Error adding message:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Update ticket status (admin only)
router.patch("/:id/status", auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    // Handle demo mode
    if (req.user.isDemo) {
      const demoTicket = demoTickets.find(ticket => ticket._id === req.params.id);
      if (!demoTicket) {
        return res.status(404).json({ message: "Demo ticket not found" });
      }
      
      demoTicket.status = status;
      demoTicket.updatedAt = new Date().toISOString();
      
      if (status === "resolved" || status === "closed") {
        demoTicket.messages.push({
          _id: `demo_message_${Date.now()}`,
          content: `Ticket marked as ${status} by support team`,
          userId: "admin_user_id",
          isAdmin: true,
          createdAt: new Date().toISOString()
        });
      }
      
      return res.status(200).json(demoTicket);
    }
    
    // Check if user is admin
    const user = await User.findById(req.user.id);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    ticket.status = status;
    
    // If status is resolved or closed, add system message
    if (status === "resolved" || status === "closed") {
      ticket.messages.push({
        content: `Ticket marked as ${status} by support team`,
        userId: req.user.id,
        isAdmin: true
      });
    }

    await ticket.save();
    res.status(200).json(ticket);
  } catch (error) {
    console.error("Error updating ticket status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Assign ticket to an admin (admin only)
router.patch("/:id/assign", auth, async (req, res) => {
  try {
    const { adminId } = req.body;
    
    // Handle demo mode
    if (req.user.isDemo) {
      const demoTicket = demoTickets.find(ticket => ticket._id === req.params.id);
      if (!demoTicket) {
        return res.status(404).json({ message: "Demo ticket not found" });
      }
      
      return res.status(200).json(demoTicket);
    }
    
    // Check if user is admin
    const user = await User.findById(req.user.id);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // Check if assigned admin exists and is an admin
    if (adminId) {
      const admin = await User.findById(adminId);
      if (!admin || !admin.isAdmin) {
        return res.status(400).json({ message: "Invalid admin user" });
      }
    }

    ticket.assignedTo = adminId || null;
    await ticket.save();
    res.status(200).json(ticket);
  } catch (error) {
    console.error("Error assigning ticket:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
