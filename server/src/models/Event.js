const mongoose = require('mongoose');

const EVENT_TYPES = ['page_view', 'click'];

const eventSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, maxlength: 100 },
    type: { type: String, required: true, enum: EVENT_TYPES },
    url: { type: String, required: true, maxlength: 2048 },
    // Normalised page key (origin + pathname, no query/hash). Used for grouping and heatmaps.
    page: { type: String, required: true, maxlength: 2048 },
    timestamp: { type: Date, required: true },

    // Click-only fields (document coordinates, in px)
    x: Number,
    y: Number,
    client_x: Number,
    client_y: Number,
    target: String,

    // Context captured at event time
    viewport_width: Number,
    viewport_height: Number,
    page_width: Number,
    page_height: Number,
    referrer: String,
    title: String,
    user_agent: String
  },
  { versionKey: false }
);

// Sessions list + per-session journey
eventSchema.index({ session_id: 1, timestamp: 1 });
// Heatmap lookups
eventSchema.index({ page: 1, type: 1 });
// Recent-first listings
eventSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Event', eventSchema);
module.exports.EVENT_TYPES = EVENT_TYPES;
