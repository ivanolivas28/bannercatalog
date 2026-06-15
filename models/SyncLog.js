import mongoose from "mongoose";

const syncLogSchema = mongoose.Schema(
  {
    service:   { type: String, required: true, default: "odoo" },
    status:    { type: String, enum: ["success", "partial", "error"], required: true },
    synced:    { type: Number, default: 0 },
    total:     { type: Number, default: 0 },
    errors:    { type: Number, default: 0 },
    errorList: { type: [{ pn: String, error: String }], default: [] },
    duration:  { type: Number, default: 0 }, // ms
  },
  { timestamps: true }
);

// Keep only the last 30 sync logs
syncLogSchema.post("save", async function () {
  const count = await this.constructor.countDocuments({ service: this.service });
  if (count > 30) {
    const oldest = await this.constructor
      .find({ service: this.service })
      .sort({ createdAt: 1 })
      .limit(count - 30)
      .select("_id");
    await this.constructor.deleteMany({ _id: { $in: oldest.map((d) => d._id) } });
  }
});

export default mongoose.models.SyncLog || mongoose.model("SyncLog", syncLogSchema);
