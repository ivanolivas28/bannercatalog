import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const cotizacionItemSchema = new mongoose.Schema(
  {
    pn: { type: String, required: true, trim: true },
    desc: { type: String, trim: true },
    qty: { type: Number, required: true, min: 1 },
    precioUSD: { type: Number, default: 0 },
    marca: { type: String, trim: true },
    tiempoEntrega: { type: String, trim: true },
  },
  { _id: false }
);

const cotizacionSchema = mongoose.Schema(
  {
    // Customer reference (if logged in)
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    // Contact info (always stored for reference)
    customerName: { type: String, trim: true },
    customerEmail: { type: String, trim: true, lowercase: true },
    customerWhatsapp: { type: String, trim: true },
    customerEmpresa: { type: String, trim: true },

    // Items requested
    items: {
      type: [cotizacionItemSchema],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: "La cotización debe tener al menos un producto.",
      },
    },

    // Workflow status
    status: {
      type: String,
      enum: ["pending", "sent_to_odoo", "completed"],
      default: "pending",
    },

    // Odoo integration
    odooQuotationId: { type: Number, default: null },
    odooQuotationName: { type: String, trim: true, default: null },

    // Source
    source: {
      type: String,
      enum: ["web_loggedin", "web_guest"],
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

cotizacionSchema.plugin(toJSON);

export default mongoose.models.Cotizacion ||
  mongoose.model("Cotizacion", cotizacionSchema);
