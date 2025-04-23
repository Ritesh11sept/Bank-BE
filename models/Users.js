import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      min: 2,
      max: 100,
    },
    email: {
      type: String,
      required: true,
      max: 50,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      min: 8,
    },
    phone: {
      type: String,
      max: 15,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    bankBalance: {
      type: Number,
      default: 1000,
    },
    panNumber: String,
    occupation: String,
    dateOfBirth: Date,
    isVerified: {
      type: Boolean,
      default: false,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["user", "admin", "support"],
      default: "user",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "blocked"],
      default: "active",
    },
    // Fields for rewards system
    rewards: {
      points: {
        type: Number,
        default: 0,
      },
      streak: {
        type: Number,
        default: 0,
      },
      lastLogin: {
        type: Date,
        default: null,
      },
      totalEarned: {
        type: Number,
        default: 0,
      },
    },
    scratchCards: [
      {
        value: Number,
        revealed: {
          type: Boolean,
          default: false,
        },
        expiryDate: Date,
      },
    ],
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre("save", async function (next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified("password")) {
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
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const Users = mongoose.model("Users", UserSchema);
export default Users;
