import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// DEVICE SCHEMA - Sensores, botoneras, gateways
const deviceSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: ['sensor', 'button_physical', 'button_virtual', 'gateway', 'display', 'torreta'],
    },
    deviceId: {
      type: String,
      required: true,
      unique: true, // ID único del dispositivo
    },
    area: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Area',
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'maintenance', 'offline', 'error'],
      default: 'active',
    },
    lastValue: {
      type: mongoose.Schema.Types.Mixed, // Para valores de sensores
    },
    lastUpdate: {
      type: Date,
      default: Date.now,
    },
    location: {
      building: String,
      floor: String,
      zone: String,
    },
    configuration: {
      thresholds: [Number], // Para sensores
      buttonActions: [String], // Para botoneras
      notificationRules: [String], // Rutas de notificación
    },
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

// Virtual para obtener estado color (para dashboard)
deviceSchema.virtual('statusColor').get(function() {
  const statusColors = {
    'active': 'green',
    'maintenance': 'orange',
    'offline': 'red',
    'error': 'red'
  };
  return statusColors[this.status] || 'gray';
});

deviceSchema.plugin(toJSON);

export default mongoose.models.Device || mongoose.model("Device", deviceSchema);
