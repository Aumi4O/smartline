"use client";

import { useState } from "react";
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

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <div className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight text-black">
          SmartLine
        </Link>
        <button
          onClick={() => setOpen(!open)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-sm text-black"
          aria-label="Toggle menu"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {open && (
        <nav className="border-b border-gray-200 bg-gray-50 px-3 py-2">
          {navigation.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex h-9 items-center rounded-lg px-3 text-sm transition-colors",
                  isActive
                    ? "bg-gray-100 font-medium text-black"
                    : "text-gray-500 hover:text-black"
                )}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
