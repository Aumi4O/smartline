export const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@smartlineagent.com";

export const PRIVACY_EMAIL =
  process.env.NEXT_PUBLIC_PRIVACY_EMAIL || SUPPORT_EMAIL;

export const LEGAL_EMAIL =
  process.env.NEXT_PUBLIC_LEGAL_EMAIL || SUPPORT_EMAIL;

export const mailto = (email: string) => `mailto:${email}`;
