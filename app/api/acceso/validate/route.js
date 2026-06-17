import { NextResponse } from "next/server";
import connectMongo from "@/libs/mongoose";
import Customer from "@/models/Customer";

// POST /api/acceso/validate — check if token is valid without consuming it
export async function POST(req) {
  try {
    const { token } = await req.json();
    if (!token) return NextResponse.json({ valid: false });

    await connectMongo();

    const customer = await Customer.findOne({
      loginToken: token,
      loginTokenExpiry: { $gt: new Date() },
      status: "approved",
    }).lean();

    if (!customer) return NextResponse.json({ valid: false });

    return NextResponse.json({ valid: true, nombre: customer.nombre });
  } catch (e) {
    console.error("[api/acceso/validate] error:", e.message);
    return NextResponse.json({ valid: false });
  }
}
