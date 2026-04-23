export default function VerifyPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="max-w-[360px] text-center">
        <h1 className="text-2xl font-semibold text-black">Check your email</h1>
        <p className="mt-3 text-sm text-gray-500">
          We sent you a sign-in link. Click the link in your email to continue.
        </p>
        <p className="mt-6 text-xs text-gray-400">
          Didn&apos;t get it? Check your spam folder.
        </p>
      </div>
    </div>
  );
}
