import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Esta ruta ya no está disponible." },
    { status: 404 }
  );
}
