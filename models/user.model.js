const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      trim: true,
      // E.164 format: +[country code][number], e.g. +14155552671
      match: [/^\+[1-9]\d{7,14}$/, 'Phone number must be in E.164 format (e.g. +14155552671)'],
    },

    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    phoneVerifiedAt: {
      type: Date,
      default: null,
    },

    name: {
      type: String,
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true, // Adds createdAt, updatedAt
    toJSON: {
      transform: (doc, ret) => {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// --- Indexes ---
userSchema.index({ phoneNumber: 1 }, { unique: true });
userSchema.index({ isPhoneVerified: 1 });
userSchema.index({ createdAt: -1 });

userSchema.methods.toPublicJSON = function () {
  return {
    id: this._id,
    phoneNumber: this.phoneNumber,
    name: this.name,
    isPhoneVerified: this.isPhoneVerified,
    phoneVerifiedAt: this.phoneVerifiedAt,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;
