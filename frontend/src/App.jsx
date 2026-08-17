import { Routes, Route, Navigate } from "react-router-dom";

import Landing from "./pages/landing/Landing";
import Price from "./pages/landing/Price";
import LegalStub from "./pages/landing/LegalStub";
import NotFound from "./pages/landing/NotFound";
import Contact from "./pages/landing/Contact";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
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
import Clients from "./pages/customer/Clients";
import ClientDetails from "./pages/customer/ClientDetails";
import AddClient from "./pages/customer/AddClient";
import EditInvoice from "./pages/customer/EditInvoice";
import ExportCenter from "./pages/customer/ExportCenter";
import Usage from "./pages/customer/Usage";
import Billing from "./pages/customer/Billing";
import BillingReturn from "./pages/customer/BillingReturn";

import AdminDashboard from "./pages/admin/Dashboard";
import Customers from "./pages/admin/Customers";
import CustomerDetails from "./pages/admin/CustomerDetails";
import Companies from "./pages/admin/Companies";
import Plans from "./pages/admin/Plans";
import Subscriptions from "./pages/admin/Subscriptions";
import Payments from "./pages/admin/Payments";
import AuditLogs from "./pages/admin/AuditLogs";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminSettings from "./pages/admin/Settings";
import UsageDashboard from "./pages/admin/usage/UsageDashboard";
import Features from "./components/landing/Features";
function App() {
  
  return (
    <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/price" element={<Price />} />
        <Route path="/features" element={<Features />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/privacy" element={<LegalStub title="Privacy Policy" />} />
        <Route path="/terms" element={<LegalStub title="Terms of Service" />} />
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
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetails />} />
          <Route path="clients/new" element={<AddClient />} />
          <Route path="clients/:id/edit" element={<AddClient />} />
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
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetails />} />
          <Route path="companies" element={<Companies />} />
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
