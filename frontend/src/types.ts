export type Role = 'elder' | 'caretaker';
export type LanguageCode = 'en' | 'hi' | 'kn';
export type ThemeMode = 'light' | 'dark' | 'high_contrast';

export type AppUser = {
  uid: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: Role;
  linkedElders?: string[];
  linkedCaretakers?: string[];
  lastActiveAt?: string | null;
};

export type VitalsResponse = {
  ok: boolean;
  vitals: Array<{
    heartRate?: number;
    spo2?: number;
    steps?: number;
    recordedAt?: string;
  }>;
};

export type Medicine = {
  _id: string;
  userUid: string;
  name: string;
  dosage?: string;
  scheduleTimes?: string[];
  notes?: string;
};

export type MedicinesResponse = {
  ok: boolean;
  medicines: Medicine[];
  user?: {
    uid: string;
    fullName: string;
  };
};

export type FeedItem = {
  type: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
};

export type FeedResponse = {
  ok: boolean;
  feed: FeedItem[];
  user?: {
    uid: string;
    fullName: string;
  };
};

export type MoodLog = {
  mood: number;
  note?: string;
  recordedAt: string;
};

export type MoodHistoryResponse = {
  ok: boolean;
  moodLogs: MoodLog[];
};

export type ChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  language?: string;
  createdAt: string;
};

export type ChatHistoryResponse = {
  ok: boolean;
  messages: ChatMessage[];
};

export type BuddyChatResponse = {
  ok: boolean;
  response: {
    text: string;
  };
  distressSignals: string[];
};

export type SettingsResponse = {
  ok: boolean;
  preferences: {
    language: LanguageCode;
    theme: ThemeMode;
    fontSize: 'normal' | 'large' | 'extra_large';
    notifications: {
      enabled?: boolean;
      sound: boolean;
      vibration: boolean;
      doNotDisturbStart?: string | null;
      doNotDisturbEnd?: string | null;
    };
    deviceConnections: Record<string, { status: string; lastSyncAt?: string | null }>;
  };
  emergencyContacts: Array<{ name: string; phone: string; relationship?: string }>;
};

export type CaretakerOverviewResponse = {
  ok: boolean;
  overview: {
    elder: {
      uid: string;
      fullName: string;
      photoUrl?: string | null;
      lastActiveAt?: string | null;
    };
    todayMood?: { label: string; value: number };
    latestVitals?: { heartRate?: number; spo2?: number };
    recentAlerts: Array<{ id: string; title: string; severity: string }>;
    statusChip: string;
  };
};

export type CaretakerEldersResponse = {
  ok: boolean;
  elders: Array<{
    uid: string;
    fullName: string;
    photoUrl?: string | null;
    lastActiveAt?: string | null;
  }>;
};

export type LocationRecord = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  recordedAt: string;
};

export type LatestLocationResponse = {
  ok: boolean;
  location: LocationRecord | null;
};

export type SosEvent = {
  reason?: string;
  message?: string;
  latitude?: number;
  longitude?: number;
  triggeredAt: string;
};

export type SosEventsResponse = {
  ok: boolean;
  events: SosEvent[];
};

export type WeeklyReportResponse = {
  ok: boolean;
  report: {
    mentalWellnessScore: number;
    medicationAdherence: {
      adherencePercent: number | null;
    };
    totals: {
      alerts: number;
    };
    charts: {
      heartRateTrend: Array<{
        date: string;
        heartRate: number | null;
      }>;
    };
  };
};

export type ReportExportResponse = {
  ok: boolean;
  downloadUrl: string;
};

export type PhotoJournalItem = {
  imageUrl: string;
  caption?: string;
  createdAt: string;
};

export type PhotosResponse = {
  ok: boolean;
  photos: PhotoJournalItem[];
};

export type LinkedContact = {
  uid: string;
  fullName: string;
  photoUrl?: string | null;
};

export type LinksResponse = {
  ok: boolean;
  links: {
    linkedCaretakers: LinkedContact[];
    linkedElders: LinkedContact[];
  };
};

export type LinkOtpGenerateResponse = {
  ok: boolean;
  code: string;
  expiresAt: string;
};

export type LinkOtpVerifyResponse = {
  ok: boolean;
  elder: {
    uid: string;
    fullName: string;
  };
  caretaker: {
    uid: string;
    fullName: string;
  };
};

export type CallLog = {
  type: 'voice' | 'video';
  status: string;
  createdAt: string;
};

export type CallLogsResponse = {
  ok: boolean;
  logs: CallLog[];
};
