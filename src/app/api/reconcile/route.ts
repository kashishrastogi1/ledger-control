import { NextResponse } from "next/server";
import { runController } from "@/lib/controller";

export async function POST() {
  return NextResponse.json(runController(500));
}

export async function GET() {
  return NextResponse.json(runController(500));
}