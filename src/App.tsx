import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router";
import { AppToaster } from "@/components/AppToaster";
import { Layout } from "@/components/Layout";
import { FullPageLoader, RequireAdmin, RequireAuth, RequireStaff } from "@/auth/guards";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import CatalogPage from "@/pages/CatalogPage";

// Lazy-loaded account pages
const SignupPage = lazy(() => import("@/pages/SignupPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"));
const VerifyEmailPage = lazy(() => import("@/pages/VerifyEmailPage"));

// Lazy-loaded student pages
const BookDetailPage = lazy(() => import("@/pages/BookDetailPage"));
const CartPage = lazy(() => import("@/pages/CartPage"));
const MyRequestsPage = lazy(() => import("@/pages/MyRequestsPage"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const ScanLookupPage = lazy(() => import("@/pages/ScanLookupPage"));

// Lazy-loaded staff pages
const StaffLayout = lazy(() => import("@/pages/staff/StaffLayout"));
const OverviewPage = lazy(() => import("@/pages/staff/OverviewPage"));
const ApprovalsPage = lazy(() => import("@/pages/staff/ApprovalsPage"));
const PickupsPage = lazy(() => import("@/pages/staff/PickupsPage"));
const LoansPage = lazy(() => import("@/pages/staff/LoansPage"));
const InventoryPage = lazy(() => import("@/pages/staff/InventoryPage"));
const ImportBooksPage = lazy(() => import("@/pages/staff/ImportBooksPage"));
const ReservationsPage = lazy(() => import("@/pages/staff/ReservationsPage"));
const UsersPage = lazy(() => import("@/pages/staff/UsersPage"));
const UserDetailPage = lazy(() => import("@/pages/staff/UserDetailPage"));
const AnalyticsPage = lazy(() => import("@/pages/staff/AnalyticsPage"));
const ActivityPage = lazy(() => import("@/pages/staff/ActivityPage"));
const SettingsPage = lazy(() => import("@/pages/staff/SettingsPage"));

// Demo builds only: the in-browser "mail server" has no real inbox, so its messages are listed on a page.
// The literal check lets the bundler drop the import (and the page) from real builds.
const DemoMailbox = import.meta.env.VITE_DEMO === "true" ? lazy(() => import("@/pages/demo/MailboxPage")) : null;

export default function App() {
  return (
    <>
      <AppToaster />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<Suspense fallback={<FullPageLoader />}><SignupPage /></Suspense>} />
          <Route path="/forgot-password" element={<Suspense fallback={<FullPageLoader />}><ForgotPasswordPage /></Suspense>} />
          <Route path="/reset-password" element={<Suspense fallback={<FullPageLoader />}><ResetPasswordPage /></Suspense>} />
          <Route path="/verify-email" element={<Suspense fallback={<FullPageLoader />}><VerifyEmailPage /></Suspense>} />
          {DemoMailbox && (
            <Route path="/demo/mailbox" element={<Suspense fallback={<FullPageLoader />}><DemoMailbox /></Suspense>} />
          )}
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/books/:id" element={<Suspense fallback={<FullPageLoader />}><BookDetailPage /></Suspense>} />
          <Route path="/cart" element={<RequireAuth><Suspense fallback={<FullPageLoader />}><CartPage /></Suspense></RequireAuth>} />
          <Route path="/my-requests" element={<RequireAuth><Suspense fallback={<FullPageLoader />}><MyRequestsPage /></Suspense></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Suspense fallback={<FullPageLoader />}><ProfilePage /></Suspense></RequireAuth>} />
          <Route path="/dashboard" element={<Navigate to="/staff" replace />} />
          {/* The staff desk shell (sidebar and desk search) also frames the member workstation at /scan/:uuid. */}
          <Route element={<RequireStaff><Suspense fallback={<FullPageLoader />}><StaffLayout /></Suspense></RequireStaff>}>
            <Route path="/scan/:uuid" element={<Suspense fallback={<FullPageLoader />}><ScanLookupPage /></Suspense>} />
            <Route path="/staff" element={<Suspense fallback={<FullPageLoader />}><OverviewPage /></Suspense>} />
            <Route path="/staff/approvals" element={<Suspense fallback={<FullPageLoader />}><ApprovalsPage /></Suspense>} />
            <Route path="/staff/pickups" element={<Suspense fallback={<FullPageLoader />}><PickupsPage /></Suspense>} />
            <Route path="/staff/loans" element={<Suspense fallback={<FullPageLoader />}><LoansPage /></Suspense>} />
            <Route path="/staff/inventory" element={<Suspense fallback={<FullPageLoader />}><InventoryPage /></Suspense>} />
            <Route path="/staff/inventory/import" element={<Suspense fallback={<FullPageLoader />}><ImportBooksPage /></Suspense>} />
            <Route path="/staff/reservations" element={<Suspense fallback={<FullPageLoader />}><ReservationsPage /></Suspense>} />
            <Route path="/staff/users" element={<Suspense fallback={<FullPageLoader />}><UsersPage /></Suspense>} />
            <Route path="/staff/users/:id" element={<Suspense fallback={<FullPageLoader />}><UserDetailPage /></Suspense>} />
            <Route path="/staff/analytics" element={<Suspense fallback={<FullPageLoader />}><AnalyticsPage /></Suspense>} />
            <Route path="/staff/activity" element={<Suspense fallback={<FullPageLoader />}><ActivityPage /></Suspense>} />
            <Route path="/staff/settings" element={<RequireAdmin><Suspense fallback={<FullPageLoader />}><SettingsPage /></Suspense></RequireAdmin>} />
          </Route>
          <Route path="*" element={<LandingPage />} />
        </Route>
      </Routes>
    </>
  );
}
