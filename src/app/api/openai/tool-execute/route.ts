import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { conversations, organizations, phoneNumbers, agents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { searchKnowledge } from "@/lib/knowledge/knowledge-service";

/**
 * OpenAI tool execution endpoint — called by OpenAI during a SIP Realtime session
 * when the agent invokes a function tool.
 * 
 * OpenAI POSTs tool call details → we execute → return result.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { call_id, tool_name, arguments: toolArgs } = body;

    if (!tool_name) {
      return NextResponse.json({ error: "Missing tool_name" }, { status: 400 });
    }

    const conv = await db.query.conversations.findFirst({
      where: eq(conversations.metadata, { sipCallId: call_id } as any),
    });

    const agentId = conv?.agentId;

    let result: unknown;

    switch (tool_name) {
      case "lookup_knowledge": {
        const query = toolArgs?.query || "general information";
        if (!agentId) {
          result = { answer: "I don't have access to the knowledge base right now." };
          break;
        }
        const chunks = await searchKnowledge(agentId, query);
        result = chunks.length > 0
          ? { answer: chunks.join("\n\n") }
          : { answer: "I don't have specific information about that topic." };
        break;
      }

      case "transfer_call": {
        const reason = toolArgs?.reason || "Customer requested transfer";
        if (conv) {
          const agent = await db.query.agents.findFirst({
            where: eq(agents.id, conv.agentId),
          });

          if (agent?.transferPhone) {
            result = {
              action: "transfer",
              transferTo: agent.transferPhone,
              message: `Transferring you to a team member now. ${reason}`,
            };
          } else {
            result = {
              action: "no_transfer",
              message: "I'm sorry, I don't have a transfer number configured. Is there anything else I can help with?",
            };
          }
        } else {
          result = { action: "no_transfer", message: "Transfer not available." };
        }
        break;
      }

      default:
        result = { error: `Unknown tool: ${tool_name}` };
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error("Tool execution error:", error);
    return NextResponse.json(
      { result: { error: "Tool execution failed" } },
      { status: 500 }
    );
  }
}
