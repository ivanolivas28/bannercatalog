import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const emailCampaignSchema = mongoose.Schema(
  {
    // Campaign info
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["welcome", "reactivation", "upsell", "follow_up", "prospection"],
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },

    // Customer
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
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // Email content
    subject: {
      type: String,
      trim: true,
    },
    bodyTemplate: {
      type: String,
      trim: true,
    },
    bodyRendered: {
      type: String,
      trim: true,
    },

    // Send tracking
    sentAt: {
      type: Date,
    },
    deliveredAt: {
      type: Date,
    },
    bouncedAt: {
      type: Date,
    },
    bounceReason: {
      type: String,
    },

    // Engagement tracking
    openedAt: {
      type: Date,
    },
    openCount: {
      type: Number,
      default: 0,
    },
    clickedAt: {
      type: Date,
    },
    clickCount: {
      type: Number,
      default: 0,
    },
    unsubscribedAt: {
      type: Date,
    },

    // Status
    status: {
      type: String,
      enum: ["draft", "scheduled", "sent", "delivered", "bounced", "complained"],
      default: "draft",
      index: true,
    },

    // Task generated from this email
    taskGeneratedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    },
    taskGeneratedReason: {
      type: String,
      trim: true,
    },

    // Provider info (Brevo/Odoo)
    provider: {
      type: String,
      enum: ["brevo", "odoo", "native"],
      default: "brevo",
    },
    providerMessageId: {
      type: String,
    },

    // Scheduling
    scheduledFor: {
      type: Date,
    },
    sequence: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

emailCampaignSchema.plugin(toJSON);
emailCampaignSchema.index({ sentAt: 1, status: 1 });
emailCampaignSchema.index({ customerId: 1, type: 1 });

export default mongoose.models.EmailCampaign ||
  mongoose.model("EmailCampaign", emailCampaignSchema);
