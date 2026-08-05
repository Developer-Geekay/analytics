const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'global_settings',
    },
    autoIpBlockEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.SystemConfig || mongoose.model('SystemConfig', SystemConfigSchema);
