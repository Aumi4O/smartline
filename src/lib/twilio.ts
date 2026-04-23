import twilio from "twilio";

export function getMasterClient() {
  return twilio(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_AUTH_TOKEN!
  );
}

export function getSubAccountClient(subAccountSid: string, subAuthToken: string) {
  return twilio(subAccountSid, subAuthToken);
}
