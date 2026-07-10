import mongoose from "mongoose";
import toJSON from "./plugins/toJSON";

const customerSchema = mongoose.Schema(
  {
    // Original fields
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
      trim: true,
      lowercase: true,
    },
    whatsapp: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "active", "inactive"],
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
    password: {
      type: String,
      private: true,
      default: null,
    },
    loginToken: {
      type: String,
      default: null,
    },
    loginTokenExpiry: {
      type: Date,
      default: null,
    },
    moneda: {
      type: String,
      enum: ["USD", "MXN"],
      default: "USD",
    },

    // Odoo integration fields
    odooPartnerId: {
      type: Number,
      index: true,
    },
    sector: {
      type: String,
      trim: true,
    },
    ciudad: {
      type: String,
      trim: true,
    },
    pais: {
      type: String,
      trim: true,
    },

    // Purchase history (for RFM analysis)
    totalSpent: {
      type: Number,
      default: 0,
    },
    quotationCount: {
      type: Number,
      default: 0,
    },
    orderCount: {
      type: Number,
      default: 0,
    },
    lastQuotationDate: {
      type: Date,
      default: null,
    },
    lastOrderDate: {
      type: Date,
      default: null,
    },

    // RFM Score
    rfmScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    segment: {
      type: String,
      enum: ["vip_active", "active", "at_risk", "dormant", "new", "prospect"],
      default: "prospect",
    },

    // Sync tracking
    lastSyncDate: {
      type: Date,
      default: null,
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
