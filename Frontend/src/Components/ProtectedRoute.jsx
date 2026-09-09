import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07141b] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl font-semibold">
            CyberGuard
          </div>

          <div className="mt-2 text-sm text-gray-400">
            Checking authentication...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  return <Outlet />;
}