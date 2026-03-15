import { AppConfig } from "@/config";

// Both local and prod securely use relative routing for normal fetch calls
const API_URL = AppConfig.API_URL;
// WS routing logic remains dynamic because WebSockets do not support relative paths natively.
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

export interface Meeting {
    id: string;
    title?: string;
    status: string;
    start_time?: string;
    end_time?: string;
    participant_count: number;
    has_summary: boolean;
}

export interface TranscriptEntry {
    speaker: string;
    text: string;
    timestamp: number;
    is_ai_response?: boolean;
}

export interface MeetingSummary {
    summary?: string;
    executive_summary?: string;
    key_points?: string[];
    decisions?: string[];
    action_items?: string[];
    topics_discussed?: string[];
    duration_minutes?: number;
    participant_count?: number;
}

export interface LateJoinSummary {
    current_topic: string;
    catch_up: string;
    key_points: string[];
    pending_questions: string[];
}

// ── API Client ──────────────────────────────────────

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`${API_URL}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!res.ok) throw new Error(`API Error: ${res.status} ${res.statusText}`);
    return res.json();
}

export const api = {
    // Meetings
    listMeetings: () => fetchApi<{ meetings: Meeting[]; total: number }>("/api/meetings"),
    getMeeting: (id: string) => fetchApi<Meeting>(`/api/meetings/${id}`),
    createMeeting: (data: { title?: string }) =>
        fetchApi<Meeting>("/api/meetings", { method: "POST", body: JSON.stringify(data) }),

    // Transcript
    getTranscript: (id: string) =>
        fetchApi<{ meeting_id: string; transcript: TranscriptEntry[]; total_entries: number }>(
            `/api/meetings/${id}/transcript`
        ),

    // Summary
    getSummary: (id: string) => fetchApi<MeetingSummary>(`/api/meetings/${id}/summary`),

    // Late Join
    lateJoin: (id: string, minutes: number = 10) =>
        fetchApi<LateJoinSummary>(`/api/meetings/${id}/late-join`, {
            method: "POST",
            body: JSON.stringify({ minutes }),
        }),

    // System
    health: () => fetchApi<{ status: string }>("/api/health"),
    stats: () => fetchApi<Record<string, unknown>>("/api/stats"),
    voices: () => fetchApi<{ voices: { id: string; name: string; gender: string }[] }>("/api/voices"),
    activeMeetings: () => fetchApi<{ active: unknown[] }>("/api/active-meetings"),
};

// ── WebSocket ───────────────────────────────────────

export function createMeetingSocket(meetingId: string) {
    return new WebSocket(`${WS_URL}/ws/meeting/${meetingId}`);
}
