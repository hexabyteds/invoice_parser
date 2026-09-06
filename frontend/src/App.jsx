import { Routes, Route, Navigate, useParams } from "react-router-dom";

import Landing from "./pages/landing/Landing";
import Price from "./pages/landing/Price";
import LegalStub from "./pages/landing/LegalStub";
import Terms from "./pages/landing/Terms";
import NotFound from "./pages/landing/NotFound";
import Contact from "./pages/landing/Contact";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import AcceptInvite from "./pages/auth/AcceptInvite";
import VerifyEmail from "./pages/auth/VerifyEmail";
import ProtectedRoute from "./routes/ProtectedRoute";
import AdminRoute from "./routes/AdminRoute";
import CustomerLayout from "./layouts/CustomerLayout";
import AdminLayout from "./layouts/AdminLayout";

import Upload from "./pages/customer/Upload";
import Dashboard from "./pages/customer/Dashboard";
import Invoices from "./pages/customer/Invoices";
import Analytics from "./pages/customer/Analytics";
import Settings from "./pages/customer/Settings";
import Profile from "./pages/customer/Profile";
import InvoiceDetails from "./pages/customer/InvoiceDetails";
import BankStatementDetails from "./pages/customer/BankStatementDetails";
import Customers from "./pages/customer/Customers";
import CustomerDetail from "./pages/customer/CustomerDetail";
import AddCustomer from "./pages/customer/AddCustomer";
import Suppliers from "./pages/customer/Suppliers";
import SupplierDetail from "./pages/customer/SupplierDetail";
import AddSupplier from "./pages/customer/AddSupplier";
import EditInvoice from "./pages/customer/EditInvoice";
import ExportCenter from "./pages/customer/ExportCenter";
import Usage from "./pages/customer/Usage";
import Billing from "./pages/customer/Billing";
import BillingReturn from "./pages/customer/BillingReturn";

import AdminDashboard from "./pages/admin/Dashboard";
import AdminCustomers from "./pages/admin/Customers";
import AdminCustomerDetails from "./pages/admin/CustomerDetails";
import Companies from "./pages/admin/Companies";
import AdminCompanyDetails from "./pages/admin/CompanyDetails";
import Plans from "./pages/admin/Plans";
import Subscriptions from "./pages/admin/Subscriptions";
import Payments from "./pages/admin/Payments";
import AuditLogs from "./pages/admin/AuditLogs";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminSettings from "./pages/admin/Settings";
import UsageDashboard from "./pages/admin/usage/UsageDashboard";
import Features from "./components/landing/Features";

// Redirects an old `/dashboard/clients/...` URL (with a dynamic :id
// segment) to its `/dashboard/customers/...` replacement.
function RedirectParam({ to }) {
  const params = useParams();
  const target = Object.entries(params).reduce(
    (path, [key, value]) => path.replace(`:${key}`, value),
    to
  );
  return <Navigate to={target} replace />;
}

function App() {
  
  return (
    <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/invite/:token" element={<AcceptInvite />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/price" element={<Price />} />
        <Route path="/features" element={<Features />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<LegalStub title="Privacy Policy" />} />
        <Route path="/terms" element={<Terms />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <CustomerLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="upload" element={<Upload />} />
          <Route path="invoices" element={<Invoices />} />
          {/* Reports & Analytics were merged into one page — keep the old
              /reports URL working for anyone with it bookmarked. */}
          <Route path="reports" element={<Navigate to="/dashboard/analytics" replace />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="invoices/:id" element={<InvoiceDetails />} />
          <Route path="bank-statements/:id" element={<BankStatementDetails />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="customers/new" element={<AddCustomer />} />
          <Route path="customers/:id/edit" element={<AddCustomer />} />
          {/* "Clients" was renamed to "Customers" — keep the old URLs
              working for anyone with them bookmarked. */}
          <Route path="clients" element={<Navigate to="/dashboard/customers" replace />} />
          <Route path="clients/new" element={<Navigate to="/dashboard/customers/new" replace />} />
          <Route path="clients/:id" element={<RedirectParam to="/dashboard/customers/:id" />} />
          <Route path="clients/:id/edit" element={<RedirectParam to="/dashboard/customers/:id/edit" />} />
          <Route path="suppliers" element={<Suppliers />} />
          <Route path="suppliers/:id" element={<SupplierDetail />} />
          <Route path="suppliers/new" element={<AddSupplier />} />
          <Route path="suppliers/:id/edit" element={<AddSupplier />} />
          <Route path="upload/:clientId" element={<Upload />} />
          <Route path="export" element={<ExportCenter />} />
          <Route path="usage" element={<Usage />} />
          <Route path="billing" element={<Billing />} />
          <Route path="billing/return" element={<BillingReturn />} />
          <Route path="invoices/:id/edit" element={<EditInvoice />} />
        </Route>

        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="customers" element={<AdminCustomers />} />
          <Route path="customers/:id" element={<AdminCustomerDetails />} />
          <Route path="companies" element={<Companies />} />
          <Route path="companies/:id" element={<AdminCompanyDetails />} />
          <Route path="plans" element={<Plans />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="usage" element={<UsageDashboard />} />
          <Route path="payments" element={<Payments />} />
          <Route path="audit-logs" element={<AuditLogs />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
