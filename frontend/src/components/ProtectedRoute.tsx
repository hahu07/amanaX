import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import type { Role } from "../auth/types";

export function ProtectedRoute({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { auth } = useAuth();
  if (!auth) return <Navigate to="/login" replace />;
  if (!allow.includes(auth.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
