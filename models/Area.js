import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

// AREA SCHEMA - Catálogo de áreas de la planta
const areaSchema = mongoose.Schema(
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
    description: String,
    location: {
      building: String,
      floor: String,
      coordinates: {
        x: Number,
        y: Number,
      },
    },
    departments: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
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

areaSchema.plugin(toJSON);

export default mongoose.models.Area || mongoose.model("Area", areaSchema);
