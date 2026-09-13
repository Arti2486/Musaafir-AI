import { NextResponse, type NextRequest } from "next/server";
import { AuthError } from "@/lib/auth";

/**
 * Wraps a route handler with consistent JSON errors + logging, so no API route
 * can silently swallow an auth failure.
 */
export function apiHandler<T>(
  handler: (request: NextRequest, context: T) => Promise<Response | NextResponse>,
) {
  return async (request: NextRequest, context: T): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json({ message: error.message }, { status: error.status });
      }
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[API] ${request.method} ${request.nextUrl?.pathname ?? ""} failed:`, message);
      const dbIssue = /connect|ECONNREFUSED|password authentication|database|DATABASE_URL/i.test(message)
        ? " PostgreSQL not connected - check DATABASE_URL in .env."
        : "";
      return NextResponse.json(
        { message: `Something went wrong on the server.${dbIssue}`, detail: message },
        { status: 500 },
      );
    }
  };
}

export async function readJson(request: NextRequest): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ message, ...extra }, { status: 400 });
}
