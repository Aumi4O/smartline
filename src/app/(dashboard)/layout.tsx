import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/dashboard/sidebar";
import { MobileNav } from "@/components/dashboard/mobile-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <Sidebar />
      <MobileNav />
      <main className="lg:pl-[260px]">
        <div className="mx-auto max-w-[1200px] px-6 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
