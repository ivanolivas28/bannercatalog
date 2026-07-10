import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const odooSyncSchema = mongoose.Schema(
  {
    // Sync metadata
    syncType: {
      type: String,
      enum: ["full", "incremental", "manual"],
      default: "incremental",
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "failed"],
      default: "pending",
      index: true,
    },

    // Data synchronized
    customersSync: {
      count: Number,
      newCount: Number,
      updatedCount: Number,
      lastSyncDate: Date,
    },
    quotationsSync: {
      count: Number,
      newCount: Number,
      updatedCount: Number,
      lastSyncDate: Date,
    },
    ordersSync: {
      count: Number,
      newCount: Number,
      updatedCount: Number,
      lastSyncDate: Date,
    },

    // Results
    startedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    duration: {
      type: Number, // milliseconds
    },

    // Error tracking
    error: {
      type: String,
    },
    errorDetails: {
      type: String,
    },

    // Notes
    notes: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

odooSyncSchema.plugin(toJSON);
odooSyncSchema.index({ startedAt: -1, status: 1 });

export default mongoose.models.OdooSync ||
  mongoose.model("OdooSync", odooSyncSchema);
