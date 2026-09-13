import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api";
import { getAuthUser, getTokenFromRequest } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/me -> the logged-in user, or 401. */
export const GET = apiHandler(async (request: NextRequest) => {
  const hasToken = Boolean(getTokenFromRequest(request));
  if (!hasToken) {
    return NextResponse.json({ message: "Unauthorized - please login again", authenticated: false }, { status: 401 });
  }

  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ message: "Unauthorized - please login again", authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user });
});
