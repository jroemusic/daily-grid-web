import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = 'force-dynamic';

const PIN = process.env.NEXT_PUBLIC_GRID_PIN || "1522";

export async function POST(request: Request) {
  const body = await request.json();
  const { pin } = body;

  if (pin === PIN) {
    const cookieStore = await cookies();
    cookieStore.set("grid-pin", "authenticated", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, // 1 week
      path: "/",
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
}
