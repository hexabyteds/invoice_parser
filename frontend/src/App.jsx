import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "./pages/landing/Landing";
import Price from "./pages/landing/Price";
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ProtectedRoute from "./routes/ProtectedRoute";
import AdminRoute from "./routes/AdminRoute";
import CustomerLayout from "./layouts/CustomerLayout";
import AdminLayout from "./layouts/AdminLayout";

import Upload from "./pages/customer/Upload";
import Dashboard from "./pages/customer/Dashboard";
import Invoices from "./pages/customer/Invoices";
import Reports from "./pages/customer/Reports";
import Analytics from "./pages/customer/Analytics";
import Settings from "./pages/customer/Settings";
import InvoiceDetails from "./pages/customer/InvoiceDetails";
import Clients from "./pages/customer/Clients";
import ClientDetails from "./pages/customer/ClientDetails";
import AddClient from "./pages/customer/AddClient";
import EditInvoice from "./pages/customer/EditInvoice";
import ExportCenter from "./pages/customer/ExportCenter";
import Usage from "./pages/customer/Usage";

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

function App() {
  return (
    <BrowserRouter basename="/">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/price" element={<Price />} />

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
          <Route path="reports" element={<Reports />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="invoices/:id" element={<InvoiceDetails />} />
          <Route path="clients" element={<Clients />} />
          <Route path="clients/:id" element={<ClientDetails />} />
          <Route path="clients/new" element={<AddClient />} />
          <Route path="upload/:clientId" element={<Upload />} />
          <Route path="export" element={<ExportCenter />} />
          <Route path="usage" element={<Usage />} />
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
