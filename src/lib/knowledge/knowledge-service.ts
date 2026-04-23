import { db } from "@/lib/db";
import { knowledgeDocuments, knowledgeChunks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    let chunk = text.slice(start, end);

    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf(". ");
      const lastNewline = chunk.lastIndexOf("\n");
      const breakAt = Math.max(lastPeriod, lastNewline);
      if (breakAt > CHUNK_SIZE * 0.5) {
        chunk = chunk.slice(0, breakAt + 1);
      }
    }

    chunks.push(chunk.trim());
    start += chunk.length - CHUNK_OVERLAP;
    if (start <= 0) start = chunk.length;
  }

  return chunks.filter((c) => c.length > 20);
}

export async function createDocument(
  orgId: string,
  agentId: string,
  filename: string,
  mimeType: string,
  content: string
) {
  const [doc] = await db
    .insert(knowledgeDocuments)
    .values({
      orgId,
      agentId,
      filename,
      mimeType,
      fileUrl: "",
      fileSizeBytes: new TextEncoder().encode(content).length,
      status: "processing",
    })
    .returning();

  const chunks = splitIntoChunks(content);

  if (chunks.length > 0) {
    await db.insert(knowledgeChunks).values(
      chunks.map((text, idx) => ({
        documentId: doc.id,
        agentId,
        content: text,
        chunkIndex: idx,
        metadata: { source: filename, page: idx + 1 },
      }))
    );
  }

  await db
    .update(knowledgeDocuments)
    .set({
      status: "ready",
      chunkCount: chunks.length,
    })
    .where(eq(knowledgeDocuments.id, doc.id));

  return { document: doc, chunkCount: chunks.length };
}

export async function listDocuments(agentId: string) {
  return db.query.knowledgeDocuments.findMany({
    where: eq(knowledgeDocuments.agentId, agentId),
    orderBy: (d, { desc }) => [desc(d.createdAt)],
  });
}

export async function listOrgDocuments(orgId: string) {
  return db.query.knowledgeDocuments.findMany({
    where: eq(knowledgeDocuments.orgId, orgId),
    orderBy: (d, { desc }) => [desc(d.createdAt)],
  });
}

export async function deleteDocument(docId: string, orgId: string) {
  await db
    .delete(knowledgeChunks)
    .where(eq(knowledgeChunks.documentId, docId));

  await db
    .delete(knowledgeDocuments)
    .where(and(eq(knowledgeDocuments.id, docId), eq(knowledgeDocuments.orgId, orgId)));
}

export async function searchKnowledge(agentId: string, query: string, topK = 5): Promise<string[]> {
  const chunks = await db.query.knowledgeChunks.findMany({
    where: eq(knowledgeChunks.agentId, agentId),
    orderBy: (c, { asc }) => [asc(c.chunkIndex)],
    limit: topK * 3,
  });

  const queryLower = query.toLowerCase();
  const scored = chunks.map((c) => {
    const contentLower = c.content.toLowerCase();
    const words = queryLower.split(/\s+/);
    const hits = words.filter((w) => contentLower.includes(w)).length;
    return { content: c.content, score: hits / words.length };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK).filter((s) => s.score > 0).map((s) => s.content);
}
