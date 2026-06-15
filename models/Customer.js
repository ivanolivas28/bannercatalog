import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const customerSchema = mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
      trim: true,
    },
    apellido: {
      type: String,
      required: true,
      trim: true,
    },
    empresa: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    whatsapp: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedAt: {
      type: Date,
    },
    rejectedAt: {
      type: Date,
    },
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

customerSchema.plugin(toJSON);

export default mongoose.models.Customer ||
  mongoose.model("Customer", customerSchema);
