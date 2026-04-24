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

  const formDump: string[] = [];
  form.forEach((v, k) => {
    if (k.startsWith("Digits")) return;
    formDump.push(`${k}=${v}`);
  });
  console.log(
    `[twilio/voice/fallback] status=${status} sip=${sipCode} callSid=${callSid} dialSid=${recipientCallSid} duration=${duration}s ${formDump.join(" ")}`
  );

  const dur = duration ? parseInt(duration, 10) : 0;
  const connected =
    status === "completed" ||
    status === "answered" ||
    (Number.isFinite(dur) && dur > 0);

  if (connected) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Hangup/></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  // Caller hung up while the dial was still ringing — not an error to announce.
  if (status === "canceled" && (!duration || dur === 0)) {
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Hangup/></Response>`,
      { headers: { "Content-Type": "text/xml" } }
    );
  }

  const failReason =
    sipCode === "486" || sipCode === "600"
      ? "The agent is busy right now."
      : sipCode === "503" || sipCode === "480" || sipCode === "502"
        ? "The AI service is temporarily unreachable."
        : sipCode === "403" || sipCode === "401"
          ? "The phone line is not allowed to connect to the AI. Please check your SmartLine settings."
          : sipCode === "404" || sipCode === "410"
            ? "The AI line could not be found. Please check your SmartLine configuration."
            : "We could not connect you to the agent.";

  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Joanna">${failReason} Please try again in a moment. Goodbye.</Say>
  <Hangup/>
</Response>`,
    { headers: { "Content-Type": "text/xml" } }
  );
}
