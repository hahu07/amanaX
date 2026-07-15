import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { ROLE_ROUTE } from "./auth/types";
import { ProtectedRoute } from "./components/ProtectedRoute";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import OperatorDashboard from "./dashboards/operator/OperatorDashboard";
import ProductSponsorDashboard from "./dashboards/productSponsor/ProductSponsorDashboard";
import IssuingHouseDashboard from "./dashboards/issuingHouse/IssuingHouseDashboard";
import TrusteeDashboard from "./dashboards/trustee/TrusteeDashboard";
import ShariahAdvisorDashboard from "./dashboards/shariahAdvisor/ShariahAdvisorDashboard";
import CustodianDashboard from "./dashboards/custodian/CustodianDashboard";
import DistributorDashboard from "./dashboards/distributor/DistributorDashboard";
import SecDashboard from "./dashboards/sec/SecDashboard";
import InvestorDashboard from "./dashboards/investor/InvestorDashboard";

// Signed-out visitors hitting "/" see the public marketing page; signed-in
// visitors are sent straight to their role's dashboard, unchanged from
// before.
function RootRedirect() {
  const { auth } = useAuth();
  if (auth) return <Navigate to={`/dashboard/${ROLE_ROUTE[auth.role]}`} replace />;
  return <HomePage />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/dashboard/operator"
            element={
              <ProtectedRoute allow={["PlatformOperator"]}>
                <OperatorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/fund-manager"
            element={
              <ProtectedRoute allow={["FundManager"]}>
                <ProductSponsorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/issuer"
            element={
              <ProtectedRoute allow={["Issuer"]}>
                <ProductSponsorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/issuing-house"
            element={
              <ProtectedRoute allow={["IssuingHouse"]}>
                <IssuingHouseDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/trustee"
            element={
              <ProtectedRoute allow={["Trustee"]}>
                <TrusteeDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/shariah-advisor"
            element={
              <ProtectedRoute allow={["ShariahAdvisor"]}>
                <ShariahAdvisorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/custodian"
            element={
              <ProtectedRoute allow={["Custodian"]}>
                <CustodianDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/distributor"
            element={
              <ProtectedRoute allow={["Distributor"]}>
                <DistributorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/sec"
            element={
              <ProtectedRoute allow={["SEC"]}>
                <SecDashboard />
              </ProtectedRoute>
            }
          />
          {/* Investor has no login path yet (Milestone 6) — route kept reachable for UI review. */}
          <Route path="/dashboard/investor" element={<InvestorDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
