import { BrowserRouter, Routes, Route } from "react-router-dom";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProtectedRoute from "./routes/ProtectedRoute";
import DashboardLayout from "./components/dashboard/DashboardLayout";
import Upload from "./pages/Upload";
import Dashboard from "./pages/Dashboard";
import Invoices from "./pages/Invoices";
import Report from "./pages/Report";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Setting";
import InvoiceDetails from "./pages/InvoiceDetails";
import Clients from "./pages/Clients";
import ClientDetails from "./pages/ClientDetails";
import AddClient from "./pages/AddClient";
function App() {
  return (
    <BrowserRouter basename="/invoice">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="upload" element={<Upload />} />
            <Route path="invoices" element={<Invoices />} />
            <Route path="reports" element={<Report />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="settings" element={<Settings />} />
            <Route path="invoices/:id" element={<InvoiceDetails />} />
            <Route path="clients" element={<Clients />} />
            <Route path="clients/:id" element={<ClientDetails />} />
            <Route path="clients/new" element={<AddClient />} />
            <Route path="upload/:clientId" element={<Upload />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;