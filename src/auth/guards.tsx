import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { useAuth } from "@/auth/AuthContext";

export function FullPageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="size-8 animate-spin rounded-full border-2 border-border border-t-burnt" />
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!me) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

export function RequireStaff({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!me) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (me.role === "MEMBER") {
    return (
      <div className="rounded-md border border-danger/40 bg-danger/5 p-8 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-danger">403 · Forbidden</p>
        <h1 className="mt-2 text-2xl font-bold">Staff access required</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This area is restricted to library staff and administrators.
        </p>
      </div>
    );
  }
  return <>{children}</>;
}
