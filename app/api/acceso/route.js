import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectMongo from "@/libs/mongoose";
import Customer from "@/models/Customer";

// POST /api/acceso — validate token and set password
export async function POST(req) {
  try {
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: "Token y contraseña requeridos." }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres." }, { status: 400 });
    }

    await connectMongo();

    const customer = await Customer.findOne({
      loginToken: token,
      loginTokenExpiry: { $gt: new Date() },
      status: "approved",
    });

    if (!customer) {
      return NextResponse.json({ error: "Link inválido o expirado." }, { status: 400 });
    }

    // Hash and save password, consume token
    customer.password = await bcrypt.hash(password, 12);
    customer.loginToken = null;
    customer.loginTokenExpiry = null;
    await customer.save();

    return NextResponse.json({ success: true, email: customer.email });
  } catch (e) {
    console.error("[api/acceso] error:", e.message);
    return NextResponse.json({ error: "Error interno." }, { status: 500 });
  }
}
