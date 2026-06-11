import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// DEPARTMENT SCHEMA - Catálogo de departamentos/equipos de respuesta
const departmentSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['engineering', 'maintenance', 'quality', 'production', 'safety', 'other'],
    },
    description: String,
    area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Area',
      required: true,
    },
    users: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    escalationRules: [{
      level: Number,
      timeMinutes: Number,
      notificationTypes: [String], // ['torreta', 'email', 'telegram', 'display']
      fallbackDepartment: mongoose.Schema.Types.ObjectId,
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

departmentSchema.plugin(toJSON);

export default mongoose.models.Department || mongoose.model("Department", departmentSchema);
