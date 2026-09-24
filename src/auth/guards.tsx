import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useI18n } from "@/i18n";

export function FullPageLoader() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status">
      <div className="size-7 animate-spin rounded-full border-2 border-border border-t-brand" />
      <span className="sr-only">{t("common.loading")}</span>
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
  const { t } = useI18n();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!me) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (me.role === "MEMBER") {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <ShieldAlert className="mx-auto size-9 text-danger" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">{t("common.forbidden")}</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">{t("common.forbiddenSub")}</p>
      </div>
    );
  }
  return <>{children}</>;
}
