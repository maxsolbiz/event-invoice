"use client";

import { useAuth } from "@/lib/auth-context";

function LoginGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (user) return null;

  return <>{children}</>;
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <LoginGate>{children}</LoginGate>;
}
