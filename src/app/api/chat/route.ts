import { desc, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/db";
import { ensureDatabaseReady } from "@/db/bootstrap";
import { chatMessages } from "@/db/schema";
import { apiHandler, badRequest, readJson } from "@/lib/api";
import { requireAuthUser } from "@/lib/auth";
import { loadBundles } from "@/lib/data";
import { answerFromContext } from "@/lib/rag";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/chat -> stored conversation for the signed-in user. */
export const GET = apiHandler(async (request: NextRequest) => {
  const user = await requireAuthUser(request);
  await ensureDatabaseReady();

  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, user.id))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(60);

  return NextResponse.json({ messages: rows.reverse() });
});

/**
 * POST /api/chat { message, slug? }
 * Answers strictly from the destination CONTEXT tables (retrieval-augmented, no external LLM).
 */
export const POST = apiHandler(async (request: NextRequest) => {
  const user = await requireAuthUser(request);
  await ensureDatabaseReady();

  const body = await readJson(request);
  const message = String(body.message ?? "").trim();
  const slug = typeof body.slug === "string" && body.slug ? body.slug : null;

  if (message.length < 2) return badRequest("Please type or speak a question first");
  if (message.length > 1200) return badRequest("Message is too long (max 1200 characters)");

  const bundles = await loadBundles();
  const scoped = slug ? bundles.filter((bundle) => bundle.destination.slug === slug) : bundles;
  const { answer, sources } = answerFromContext(message, scoped.length ? scoped : bundles);

  const [savedUserMessage, savedAssistantMessage] = await Promise.all([
    db
      .insert(chatMessages)
      .values({ userId: user.id, role: "user", content: message, destinationSlug: slug })
      .returning(),
    db
      .insert(chatMessages)
      .values({ userId: user.id, role: "assistant", content: answer, destinationSlug: slug })
      .returning(),
  ]);

  console.log(`[CHAT] user id=${user.id} asked "${message.slice(0, 50)}" -> ${sources.length} sources`);

  return NextResponse.json({
    message: savedAssistantMessage,
    userMessage: savedUserMessage,
    answer,
    sources,
  });
});

/** DELETE /api/chat -> clears the stored transcript. */
export const DELETE = apiHandler(async (request: NextRequest) => {
  const user = await requireAuthUser(request);
  await ensureDatabaseReady();
  await db.delete(chatMessages).where(eq(chatMessages.userId, user.id));
  return NextResponse.json({ message: "Chat history cleared" });
});
