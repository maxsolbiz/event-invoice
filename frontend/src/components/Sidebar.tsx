"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const navItems = [
    { href: "/app/invoices", label: "Invoices" },
    { href: "/app/clients", label: "Clients" },
  ];

  if (user.role === "admin") {
    navItems.push({ href: "/app/settings", label: "Settings" });
  }

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen p-4 flex flex-col">
      <div className="mb-8">
        <h1 className="text-lg font-bold">Event Invoice</h1>
        <p className="text-gray-400 text-xs mt-1">Management System</p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              pathname.startsWith(item.href)
                ? "bg-gray-700 text-white"
                : "text-gray-300 hover:bg-gray-800 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-gray-700 pt-4 mt-4">
        <div className="text-sm text-gray-300 mb-2">
          <span className="font-medium text-white">{user.username}</span>
          <span className="ml-2 text-xs bg-gray-700 px-2 py-0.5 rounded">{user.role}</span>
        </div>
        <button
          onClick={logout}
          className="w-full text-left text-sm text-gray-400 hover:text-white px-3 py-2 rounded-md hover:bg-gray-800 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
