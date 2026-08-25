"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const navItems = [
    { href: "/app/invoices", label: "Invoices" },
    { href: "/app/clients", label: "Clients" },
  ];

  if (user.role === "admin") {
    navItems.push({ href: "/app/settings", label: "Settings" });
  }

  const isActive = (href: string) => pathname.startsWith(href);

  const navContent = (
    <>
      <div className="mb-8">
        <h1 className="text-lg font-bold">Event Invoice</h1>
        <p className="text-gray-400 text-xs mt-1">Management System</p>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "bg-white/10 text-white"
                : "text-gray-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 pt-4 mt-4">
        <div className="text-sm text-gray-300 mb-2">
          <span className="font-medium text-white">{user.username}</span>
          <span className="ml-2 text-xs bg-white/10 px-2 py-0.5 rounded">{user.role}</span>
        </div>
        <button
          onClick={logout}
          className="w-full text-left text-sm text-gray-400 hover:text-white px-3 py-2 rounded-md hover:bg-white/5 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 bg-gray-900 text-white rounded-md shadow-lg"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white p-4 flex flex-col transform transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {navContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 bg-gray-900 text-white min-h-screen p-4 flex-col flex-shrink-0">
        {navContent}
      </aside>
    </>
  );
}
