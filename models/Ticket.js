import mongoose from "mongoose";

// Define a message schema that's more flexible with the userId
const MessageSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.Mixed, // This allows string or ObjectId
      required: false, // Make it not required to avoid validation issues
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Define the main ticket schema
const TicketSchema = new mongoose.Schema(
  {
    subject: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      // Updated to include "inProgress" (camelCase) as well as "in_progress" (snake_case)
      enum: ["new", "open", "in_progress", "inProgress", "resolved", "closed"],
      default: "new",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    category: {
      type: String,
      // Extended enum list to include all possible categories
      enum: ["account", "payments", "technical", "billing", "security", "other", 
             "savings", "transfer", "login", "general"],
      default: "other",
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users", // Reference to the Users model
      required: true,
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      default: null,
    },
    messages: [MessageSchema],
  },
  { timestamps: true }
);

// Add helper method to normalize status values before validation
TicketSchema.pre('validate', function(next) {
  // Normalize status values
  if (this.status === 'inProgress') {
    this.status = 'in_progress';
  }
  
  // Make sure the ticket has a valid category
  if (!this.category || !this.schema.path('category').enumValues.includes(this.category)) {
    console.log(`Invalid category "${this.category}" - defaulting to "other"`);
    this.category = 'other';
  }
  
  next();
});

// Pre-save middleware to handle message validation
TicketSchema.pre('save', function(next) {
  // Ensure all messages have valid content
  if (this.messages && this.messages.length > 0) {
    for (let i = 0; i < this.messages.length; i++) {
      const message = this.messages[i];
      
      // Ensure content exists
      if (!message.content) {
        return next(new Error('Message content is required'));
      }
      
      // Handle admin user IDs - convert string IDs to valid ObjectIds if needed
      if (message.isAdmin && message.userId && typeof message.userId === 'string') {
        try {
          if (!mongoose.Types.ObjectId.isValid(message.userId)) {
            // Use a default admin ID
            message.userId = mongoose.Types.ObjectId.createFromHexString('111111111111111111111111');
          }
        } catch (error) {
          console.warn('Error converting admin userId, using default:', error);
          message.userId = mongoose.Types.ObjectId.createFromHexString('111111111111111111111111');
        }
      }
    }
  }
  next();
});

const Ticket = mongoose.model("Ticket", TicketSchema);

export default Ticket;
