import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// ALERT SCHEMA - Sistema de alertas y escalamiento
const alertSchema = mongoose.Schema(
  {
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Device',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    alertType: {
      type: String,
      required: true,
      enum: ['emergency', 'maintenance', 'quality', 'setup', 'other'],
    },
    priority: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    status: {
      type: String,
      enum: ['active', 'acknowledged', 'escalated', 'resolved', 'unassigned'],
      default: 'active',
    },
    description: {
      type: String,
      required: true,
    },
    assignedDepartment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
    },
    assignedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    escalationLevel: {
      type: Number,
      default: 0,
    },
    escalationHistory: [{
      timestamp: Date,
      level: Number,
      notified: [{
        user: mongoose.Schema.Types.ObjectId,
        department: mongoose.Schema.Types.ObjectId,
        notificationType: String // 'email', 'torreta', 'display', 'telegram'
      }]
    }],
    notificationsSent: [{
      timestamp: Date,
      type: String, // 'torreta', 'display', 'email', 'telegram'
      recipients: [String],
      delivered: Boolean,
    }],
    resolution: {
      timestamp: Date,
      resolvedBy: mongoose.Schema.Types.ObjectId,
      solution: String,
      timeToResolution: Number, // en minutos
    },
    timeline: [{
      timestamp: Date,
      event: String,
      description: String,
      user: mongoose.Schema.Types.ObjectId,
    }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

// Virtual para estado de color en dashboard
alertSchema.virtual('statusColor').get(function() {
  if (this.status === 'active') return 'red';
  if (this.status === 'acknowledged') return 'orange';
  if (this.status === 'escalated') return 'red';
  if (this.status === 'resolved') return 'green';
  return 'yellow';
});

// Virtual para tiempo desde creación
alertSchema.virtual('ageInMinutes').get(function() {
  return Math.floor((Date.now() - this.createdAt) / 60000);
});

alertSchema.plugin(toJSON);

export default mongoose.models.Alert || mongoose.model("Alert", alertSchema);
