import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { DashboardPage } from "@/app/pages/DashboardPage";
import { UploadsPage } from "@/app/pages/UploadsPage";
import { PendingPage } from "@/app/pages/PendingPage";
import { CardsPage } from "@/app/pages/CardsPage";
import { PricingPage } from "@/app/pages/PricingPage";
import { ExportsPage } from "@/app/pages/ExportsPage";
import { InventoryPage } from "@/app/pages/InventoryPage";
import { ReportsPage } from "@/app/pages/ReportsPage";
import { SettingsPage } from "@/app/pages/SettingsPage";
import ReviewPage from "@/app/pages/ReviewPage";

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/uploads" element={<UploadsPage />} />
          <Route path="/pending" element={<PendingPage />} />
          <Route path="/cards" element={<CardsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/exports" element={<ExportsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/review/:id" element={<ReviewPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}