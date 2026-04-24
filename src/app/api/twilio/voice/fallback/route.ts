import { NextRequest, NextResponse } from "next/server";

/**
 * Fired by Twilio when the <Dial><Sip> to OpenAI ends.
 *
 * DialCallStatus values:
 *   - completed: call finished normally (agent hung up or caller hung up)
 *   - answered:  bridge succeeded but we ended up here (Twilio quirk)
 *   - busy, no-answer, failed, canceled: bridge never connected
 *
 * When the bridge fails, we used to hang up silently and callers heard
 * only the disclosure line. Now we say something actionable and log
 * enough metadata to debug the failed dial.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const status = String(form.get("DialCallStatus") || "");
  const sipCode = String(form.get("DialSipResponseCode") || "");
  const callSid = String(form.get("CallSid") || "");
  const recipientCallSid = String(form.get("DialCallSid") || "");
  const duration = String(form.get("DialCallDuration") || "");

  console.log(
    `[twilio/voice/fallback] status=${status} sip=${sipCode} callSid=${callSid} dialSid=${recipientCallSid} duration=${duration}s`
  );

  const connected =
    status === "completed" ||
    status === "answered" ||
    (duration && parseInt(duration, 10) > 0);

  if (connected) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Hangup/></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  const failReason =
    sipCode === "486"
      ? "The agent is busy right now."
      : sipCode === "503" || sipCode === "480"
      ? "The AI service is temporarily unreachable."
      : "We couldn't connect you to the agent.";

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${failReason} Please try again in a moment. Goodbye.</Say>
  <Hangup/>
</Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}
