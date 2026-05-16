import NextAuth from "next-auth";
import type { EmailProviderSendVerificationRequestParams } from "@auth/core/providers/email";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { SUPPORT_EMAIL } from "@/lib/contact";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";

const resendApiKey = process.env.AUTH_RESEND_KEY || process.env.RESEND_API_KEY;
const authEmailFrom = process.env.AUTH_EMAIL_FROM ?? "SmartLine <onboarding@resend.dev>";

async function sendVerificationRequest({
  identifier,
  provider,
  url,
}: EmailProviderSendVerificationRequestParams) {
  const { host } = new URL(url);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: provider.from,
      to: identifier,
      reply_to: SUPPORT_EMAIL,
      subject: `Sign in to ${host}`,
      html: `<p>Sign in to SmartLine:</p><p><a href="${url}">Continue to SmartLine</a></p>`,
      text: `Sign in to SmartLine: ${url}`,
    }),
  });

  if (!res.ok) {
    throw new Error("Resend error: " + JSON.stringify(await res.json()));
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      allowDangerousEmailAccountLinking: true,
      authorization: { params: { prompt: "select_account" } },
    }),
    Resend({
      apiKey: resendApiKey,
      from: authEmailFrom,
      sendVerificationRequest,
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/auth-error",
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
});
