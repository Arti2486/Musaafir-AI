import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api";
import { AUTH_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/logout -> clears the mirrored auth cookie. */
export const POST = apiHandler(async (_request: NextRequest) => {
  const response = NextResponse.json({ message: "Logged out" });
  response.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
});
