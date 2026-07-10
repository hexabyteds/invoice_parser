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
 
function App() {
  return (
    <BrowserRouter>
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;