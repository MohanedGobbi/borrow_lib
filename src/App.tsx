import { Routes, Route, Navigate } from "react-router";
import { Toaster } from "sonner";
import { Layout } from "@/components/Layout";
import { RequireAuth, RequireStaff } from "@/auth/guards";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import CatalogPage from "@/pages/CatalogPage";
import BookDetailPage from "@/pages/BookDetailPage";
import CartPage from "@/pages/CartPage";
import MyRequestsPage from "@/pages/MyRequestsPage";
import ProfilePage from "@/pages/ProfilePage";
import ScanLookupPage from "@/pages/ScanLookupPage";
import StaffLayout from "@/pages/staff/StaffLayout";
import OverviewPage from "@/pages/staff/OverviewPage";
import ApprovalsPage from "@/pages/staff/ApprovalsPage";
import PickupsPage from "@/pages/staff/PickupsPage";
import LoansPage from "@/pages/staff/LoansPage";
import InventoryPage from "@/pages/staff/InventoryPage";
import ReservationsPage from "@/pages/staff/ReservationsPage";
import UsersPage from "@/pages/staff/UsersPage";
import UserDetailPage from "@/pages/staff/UserDetailPage";
import AnalyticsPage from "@/pages/staff/AnalyticsPage";
import ActivityPage from "@/pages/staff/ActivityPage";

export default function App() {
  return (
    <>
      <Toaster position="bottom-right" richColors />
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/books/:id" element={<BookDetailPage />} />
          <Route path="/cart" element={<RequireAuth><CartPage /></RequireAuth>} />
          <Route path="/my-requests" element={<RequireAuth><MyRequestsPage /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
          <Route path="/scan/:uuid" element={<RequireStaff><ScanLookupPage /></RequireStaff>} />
          <Route path="/dashboard" element={<Navigate to="/staff" replace />} />
          <Route path="/staff" element={<RequireStaff><StaffLayout /></RequireStaff>}>
            <Route index element={<OverviewPage />} />
            <Route path="approvals" element={<ApprovalsPage />} />
            <Route path="pickups" element={<PickupsPage />} />
            <Route path="loans" element={<LoansPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="reservations" element={<ReservationsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="users/:id" element={<UserDetailPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="activity" element={<ActivityPage />} />
          </Route>
          <Route path="*" element={<LandingPage />} />
        </Route>
      </Routes>
    </>
  );
}
