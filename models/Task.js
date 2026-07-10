import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const taskSchema = mongoose.Schema(
  {
    // Customer reference
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true,
    },
    odooPartnerId: {
      type: Number,
      index: true,
    },

    // Task details
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["call", "email", "meeting", "follow_up", "reactivation", "prospection"],
      required: true,
    },
    priority: {
      type: String,
      enum: ["urgent", "high", "medium", "low"],
      default: "medium",
    },
    priority_score: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Customer context
    customer: {
      name: String,
      empresa: String,
      email: String,
      whatsapp: String,
      lastQuotationDate: Date,
      totalSpent: Number,
      quotationCount: Number,
      segment: String,
    },

    // Suggested action
    suggestedAction: {
      type: String,
      trim: true,
    },
    actionUrl: {
      type: String,
    },

    // Status
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "skipped", "postponed"],
      default: "pending",
      index: true,
    },
    dueDate: {
      type: Date,
      index: true,
    },
    completedAt: {
      type: Date,
    },
    completedBy: {
      type: String,
    },

    // Result tracking
    result: {
      type: String,
      enum: ["success", "failed", "no_interest", "not_reachable", "needs_followup"],
    },
    notes: {
      type: String,
      trim: true,
    },

    // Tracking
    emailSent: {
      type: Boolean,
      default: false,
    },
    emailCampaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EmailCampaign",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

taskSchema.plugin(toJSON);
taskSchema.index({ dueDate: 1, status: 1, priority_score: -1 });

export default mongoose.models.Task || mongoose.model("Task", taskSchema);
