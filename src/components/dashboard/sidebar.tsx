"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard" },
  { name: "Agents", href: "/agents" },
  { name: "Phone Numbers", href: "/phone-numbers" },
  { name: "Leads", href: "/leads" },
  { name: "Campaigns", href: "/campaigns" },
  { name: "Calls", href: "/calls" },
  { name: "Knowledge", href: "/knowledge" },
  { name: "Analytics", href: "/analytics" },
  { name: "Billing", href: "/billing" },
  { name: "Audit Log", href: "/audit-log" },
  { name: "Settings", href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-30 hidden h-full w-[260px] border-r border-gray-200 bg-gray-50 lg:block">
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center border-b border-gray-200 px-6">
          <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-black">
            SmartLine
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4">
          <ul className="space-y-0.5">
            {navigation.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(item.href));

              return (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex h-9 items-center rounded-lg px-3 text-sm transition-colors",
                      isActive
                        ? "bg-gray-100 font-medium text-black"
                        : "text-gray-500 hover:bg-gray-100 hover:text-black"
                    )}
                  >
                    {item.name}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-gray-200 p-4">
          <p className="truncate text-xs text-gray-400">SmartLine v0.1</p>
        </div>
      </div>
    </aside>
  );
}
