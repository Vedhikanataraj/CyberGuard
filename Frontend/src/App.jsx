import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import AppLayout from "./layouts/AppLayout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import NewScan from "./pages/NewScan";
import ScanHistory from "./pages/ScanHistory";
import ScanReport from "./pages/ScanReport";
import Vulnerabilities from "./pages/Vulnerabilities";
import Reports from "./pages/Reports";
import Assets from "./pages/Assets";
import Settings from "./pages/Settings";

import Login from "./pages/Login";
import Register from "./pages/Register";

import ProtectedRoute from "./Components/ProtectedRoute";

import {
  AuthProvider,
} from "./context/AuthContext";


function App() {

  return (
    <BrowserRouter>

      <AuthProvider>

        <Routes>

          {/* ==================================================
              PUBLIC ROUTES
          ================================================== */}
          <Route
            path="/"
            element={<Home />}
          />
          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/register"
            element={<Register />}
          />


          {/* ==================================================
              PROTECTED APPLICATION
          ================================================== */}

          <Route
            element={<ProtectedRoute />}
          >

            <Route
              element={<AppLayout />}
            >


              {/* DASHBOARD */}

              <Route
                path="/dashboard"
                element={<Dashboard />}
              />


              {/* NEW SCAN */}

              <Route
                path="/scan/new"
                element={<NewScan />}
              />


              {/* SCAN HISTORY */}

              <Route
                path="/scans"
                element={<ScanHistory />}
              />


              {/* SCAN REPORT */}

              <Route
                path="/scans/:scanId"
                element={<ScanReport />}
              />


              {/* VULNERABILITIES */}

              <Route
                path="/vulnerabilities"
                element={
                  <Vulnerabilities />
                }
              />


              {/* REPORTS */}

              <Route
               path="/reports"
               element={<Reports />}
              />
              <Route
               path="/scans/:scanId"
              element={<ScanReport />}
              />


              {/* ASSETS */}

              <Route
                path="/assets"
                element={<Assets />}
              />


              {/* SETTINGS */}

              <Route
                path="/settings"
                element={<Settings />}
              />

            </Route>

          </Route>


          {/* ==================================================
              FALLBACK
          ================================================== */}

          <Route
            path="*"
            element={
              <Navigate
                to="/dashboard"
                replace
              />
            }
          />

        </Routes>

      </AuthProvider>

    </BrowserRouter>
  );
}


export default App;