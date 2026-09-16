import React from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import { LandingPage } from "./components/LandingPage";
import { AuthPage } from "./components/auth/AuthPage";
import { DashboardShell } from "./components/DashboardShell";
import { LotDetailPage } from "./components/LotDetailPage";
import { VerificationDocReviewPage } from "./components/admin/VerificationDocReviewPage";
import { FieldResearch } from "./components/FieldResearch";
import { useAuth } from "./contexts/AuthContext";
import { RefreshCw } from "lucide-react";

const RequireAuth: React.FC = () => {
  const { user, token, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F7F8F6] flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-bold text-[#244C3B]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!user && !token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

const InternalFieldResearchRoute: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#F7F8F6] p-6">
      <div className="max-w-6xl mx-auto">
        <FieldResearch language="en" onNavigateToTab={() => {}} />
      </div>
    </div>
  );
};

export const router = createBrowserRouter([
  {
    path: "/",
    element: <LandingPage />,
  },
  {
    path: "/login",
    element: <AuthPage />,
  },
  {
    path: "/app",
    element: <RequireAuth />,
    children: [
      {
        path: "",
        element: <DashboardShell />,
      },
      {
        path: "lots/:lotId",
        element: <LotDetailPage />,
      },
      {
        path: "admin/verification/:docId",
        element: <VerificationDocReviewPage />,
      },
    ],
  },
  {
    path: "/internal/field-research",
    element: <InternalFieldResearchRoute />,
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
