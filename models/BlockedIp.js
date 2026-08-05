const mongoose = require('mongoose');

const BlockedIpSchema = new mongoose.Schema(
  {
    ip: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    reason: {
      type: String,
      required: true,
      default: 'Suspicious activity or vulnerability probe detected',
    },
    blockedBy: {
      type: String,
      enum: ['system', 'admin'],
      default: 'system',
    },
    threatCategory: {
      type: String,
      default: 'Vulnerability Probe',
    },
    status: {
      type: String,
      enum: ['active', 'unblocked'],
      default: 'active',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.BlockedIp || mongoose.model('BlockedIp', BlockedIpSchema);
