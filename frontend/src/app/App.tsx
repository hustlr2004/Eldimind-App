import { Navigate, Route, Routes } from 'react-router-dom';
import { AppFrame } from '../components/AppFrame';
import { AuthPage } from '../features/auth/AuthPage';
import { LandingPage } from '../features/landing/LandingPage';
import { CaretakerDashboardPage } from '../features/caretaker/CaretakerDashboardPage';
import { BuddyPage } from '../features/ai/BuddyPage';
import { CallPage } from '../features/calls/CallPage';
import { CognitivePage } from '../features/cognitive/CognitivePage';
import { ElderDashboardPage } from '../features/elder/ElderDashboardPage';
import { MedicinesPage } from '../features/medicines/MedicinesPage';
import { MoodPage } from '../features/mood/MoodPage';
import { PhotosPage } from '../features/photos/PhotosPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SettingsPage } from '../features/settings/SettingsPage';
import { SosPage } from '../features/sos/SosPage';
import { ProtectedRoute } from './auth/ProtectedRoute';

export function App() {
  return (
    <AppFrame>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth/:role" element={<AuthPage />} />
        <Route
          path="/elder"
          element={
            <ProtectedRoute role="elder">
              <ElderDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/caretaker"
          element={
            <ProtectedRoute role="caretaker">
              <CaretakerDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/medicines"
          element={
            <ProtectedRoute>
              <MedicinesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/buddy"
          element={
            <ProtectedRoute role="elder">
              <BuddyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cognitive"
          element={
            <ProtectedRoute>
              <CognitivePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/mood"
          element={
            <ProtectedRoute role="elder">
              <MoodPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sos"
          element={
            <ProtectedRoute role="elder">
              <SosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/photos"
          element={
            <ProtectedRoute>
              <PhotosPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calls"
          element={
            <ProtectedRoute>
              <CallPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppFrame>
  );
}
