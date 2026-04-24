import Link from "next/link";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

const messages: Record<string, { title: string; body: string; cta: string; href: string }> = {
  Configuration: {
    title: "We couldn't complete sign-in",
    body: "Something on our side needs a moment. Please try again in a minute.",
    cta: "Back to sign in",
    href: "/login",
  },
  AccessDenied: {
    title: "Access denied",
    body: "You don't have permission to sign in with this account. If you just signed up, please complete activation.",
    cta: "Back to sign in",
    href: "/login",
  },
  Verification: {
    title: "Link expired",
    body: "Your sign-in link has expired or was already used. Request a new one to continue.",
    cta: "Get a new link",
    href: "/login",
  },
  OAuthAccountNotLinked: {
    title: "Account already exists",
    body: "This email is already linked to another sign-in method. Try the original method you used to sign up.",
    cta: "Back to sign in",
    href: "/login",
  },
  Default: {
    title: "Activate your account",
    body: "Your sign-in was successful, but your account isn't fully set up yet. Sign in again and we'll guide you through activation.",
    cta: "Continue to sign in",
    href: "/login",
  },
};

export default async function AuthErrorPage({ searchParams }: Props) {
  const params = await searchParams;
  const code = params.error ?? "Default";
  const msg = messages[code] ?? messages.Default;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-black">SmartLine</h1>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-black">{msg.title}</h2>
          <p className="mt-2 text-sm text-gray-500">{msg.body}</p>

          <Link
            href={msg.href}
            className="mt-6 inline-flex h-10 w-full items-center justify-center rounded-md bg-black px-4 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            {msg.cta}
          </Link>

          <p className="mt-4 text-center text-xs text-gray-400">
            Need help? <a href="mailto:support@leadagentsstudio.com" className="underline">support@leadagentsstudio.com</a>
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          By continuing, you agree to our{" "}
          <Link href="/terms" className="underline">Terms</Link> and{" "}
          <Link href="/privacy" className="underline">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
