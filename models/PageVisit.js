const mongoose = require('mongoose');

const PageVisitSchema = new mongoose.Schema(
  {
    siteId: {
      type: String,
      default: 'default',
      index: true,
      trim: true,
    },
    path: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    fullUrl: {
      type: String,
      trim: true,
    },
    referrer: {
      type: String,
      default: '',
      trim: true,
    },
    utm_source: { type: String, default: '', index: true, trim: true },
    utm_medium: { type: String, default: '', trim: true },
    utm_campaign: { type: String, default: '', index: true, trim: true },
    utm_content: { type: String, default: '', trim: true },
    utm_term: { type: String, default: '', trim: true },
    userAgent: {
      type: String,
      default: '',
    },
    ip: {
      type: String,
      default: '',
      index: true,
    },
    deviceType: {
      type: String,
      enum: ['Desktop', 'Mobile', 'Tablet', 'Bot'],
      default: 'Desktop',
    },
    browser: {
      type: String,
      default: 'Unknown',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for high performance multi-tenant queries & deduplication
PageVisitSchema.index({ siteId: 1, ip: 1, path: 1, timestamp: -1 });

module.exports = mongoose.models.PageVisit || mongoose.model('PageVisit', PageVisitSchema);
