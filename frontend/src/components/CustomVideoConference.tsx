"use client";

import { isEqualTrackRef, isTrackReference, isWeb, log } from '@livekit/components-core';
import type { TrackReferenceOrPlaceholder, WidgetState } from '@livekit/components-core';
import { RoomEvent, Track } from 'livekit-client';
import * as React from 'react';
import {
    CarouselLayout,
    ConnectionStateToast,
    FocusLayout,
    FocusLayoutContainer,
    GridLayout,
    LayoutContextProvider,
    ParticipantTile,
    RoomAudioRenderer,
} from '@livekit/components-react';
import { useMaybeLayoutContext, useParticipants } from '@livekit/components-react';
import { useCreateLayoutContext, usePinnedTracks, useTracks, TrackToggle, DisconnectButton } from '@livekit/components-react';
import { MessageSquare, Settings, Users, Link as LinkIcon, ShieldAlert, Cpu } from 'lucide-react';
import CustomChat from './CustomChat';

interface CustomVideoConferenceProps {
    SettingsComponent?: React.ComponentType;
}

export default function CustomVideoConference({ SettingsComponent }: CustomVideoConferenceProps) {
    const [widgetState, setWidgetState] = React.useState<WidgetState>({
        showChat: false,
        unreadMessages: 0,
        showSettings: false,
    });
    const lastAutoFocusedScreenShareTrack = React.useRef<TrackReferenceOrPlaceholder | null>(null);

    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { updateOnlyOn: [RoomEvent.ActiveSpeakersChanged], onlySubscribed: false },
    );

    // Custom widget update: ensure only one panel is open at a time
    const toggleChat = () => {
        setWidgetState(prev => ({
            ...prev,
            showChat: !prev.showChat,
            showSettings: false, // exclusive
        }));
    };

    const toggleSettings = () => {
        setWidgetState(prev => ({
            ...prev,
            showSettings: !prev.showSettings,
            showChat: false, // exclusive
        }));
    };

    const widgetUpdate = (state: WidgetState) => {
        log.debug('updating widget state', state);
        // Only sync unreadMessages from the internal Chat widget callback.
        // Do NOT let it override showChat/showSettings — we control those manually.
        setWidgetState((prev) => ({
            ...prev,
            unreadMessages: state.unreadMessages ?? prev.unreadMessages,
        }));
    };

    const layoutContext = useCreateLayoutContext();



    const screenShareTracks = tracks
        .filter(isTrackReference)
        .filter((track) => track.publication.source === Track.Source.ScreenShare);

    const focusTrack = usePinnedTracks(layoutContext)?.[0];
    const carouselTracks = tracks.filter((track) => !isEqualTrackRef(track, focusTrack));

    React.useEffect(() => {
        if (
            screenShareTracks.some((track) => track.publication.isSubscribed) &&
            lastAutoFocusedScreenShareTrack.current === null
        ) {
            layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: screenShareTracks[0] });
            lastAutoFocusedScreenShareTrack.current = screenShareTracks[0];
        } else if (
            lastAutoFocusedScreenShareTrack.current &&
            !screenShareTracks.some(
                (track) =>
                    track.publication.trackSid ===
                    lastAutoFocusedScreenShareTrack.current?.publication?.trackSid,
            )
        ) {
            layoutContext.pin.dispatch?.({ msg: 'clear_pin' });
            lastAutoFocusedScreenShareTrack.current = null;
        }
        if (focusTrack && !isTrackReference(focusTrack)) {
            const updatedFocusTrack = tracks.find(
                (tr) =>
                    tr.participant.identity === focusTrack.participant.identity &&
                    tr.source === focusTrack.source,
            );
            if (updatedFocusTrack !== focusTrack && isTrackReference(updatedFocusTrack)) {
                layoutContext.pin.dispatch?.({ msg: 'set_pin', trackReference: updatedFocusTrack });
            }
        }
    }, [
        screenShareTracks
            .map((ref) => `${ref.publication.trackSid}_${ref.publication.isSubscribed}`)
            .join(),
        focusTrack?.publication?.trackSid,
        tracks,
    ]);

    // Determine which sidebar panel to show
    const showChat = widgetState.showChat && !widgetState.showSettings;
    const showSettings = widgetState.showSettings && !widgetState.showChat;

    // -------------------------------------------------------------
    // Share Link Functionality
    // -------------------------------------------------------------
    const [hasCopied, setHasCopied] = React.useState(false);

    // Copy only the meeting code (room_id) to clipboard
    const handleShareLink = async () => {
        try {
            // Extract the room_id from the URL path: /meet/[room_id]
            const pathParts = window.location.pathname.split('/');
            const meetingCode = pathParts[pathParts.length - 1] || pathParts[pathParts.length - 2];
            await navigator.clipboard.writeText(meetingCode);
            setHasCopied(true);
            setTimeout(() => setHasCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy meeting code', err);
        }
    };

    const participants = useParticipants();
    const isPanelOpen = showChat || showSettings;

    return (
        <div className="flex flex-col h-full w-full bg-[#0b0f19] text-white overflow-hidden font-sans">
            {isWeb() && (
                <LayoutContextProvider
                    value={layoutContext}
                    onWidgetChange={widgetUpdate}
                >
                    {/* TOP BAR */}
                    <header className="h-16 shrink-0 flex items-center justify-between px-6 border-b border-white/5 bg-[#0f172a]/80 backdrop-blur-md z-20">
                        <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center border border-teal-500/30">
                                <ShieldAlert className="w-4 h-4 text-teal-400" />
                            </div>
                            <h1 className="text-lg font-semibold tracking-tight text-gray-100">Secure Meeting Room</h1>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-medium text-gray-300">
                                <Users className="w-4 h-4 text-gray-400" />
                                <span>{participants.length} {participants.length === 1 ? 'Participant' : 'Participants'}</span>
                            </div>
                            
                            <button 
                                onClick={handleShareLink}
                                className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ${
                                    hasCopied 
                                        ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                                        : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'
                                }`}
                            >
                                <LinkIcon className="w-4 h-4" />
                                {hasCopied ? 'Code Copied!' : 'Copy Meeting Code'}
                            </button>
                        </div>
                    </header>

                    <main className="flex-1 flex overflow-hidden relative">
                        {/* MAIN VIDEO AREA */}
                        <div className={`flex-1 relative flex flex-col transition-all duration-300 ease-in-out ${isPanelOpen ? 'lg:pr-0' : ''}`}>
                            <div className="flex-1 p-4 lg:p-6 pb-32"> {/* pb-32 leaves room for bottom bar */}
                                <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl bg-black/40 ring-1 ring-white/10 relative">
                                    {!focusTrack ? (
                                        <div className="absolute inset-0 w-full h-full">
                                            <GridLayout tracks={tracks}>
                                                <ParticipantTile />
                                            </GridLayout>
                                        </div>
                                    ) : (
                                        <div className="absolute inset-0 w-full h-full">
                                            <FocusLayoutContainer>
                                                <CarouselLayout tracks={carouselTracks}>
                                                    <ParticipantTile />
                                                </CarouselLayout>
                                                {focusTrack && <FocusLayout trackRef={focusTrack} />}
                                            </FocusLayoutContainer>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* FLOATING BOTTOM CONTROL BAR */}
                            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30">
                                <div className="flex items-center gap-2 lg:gap-4 px-6 py-3 rounded-2xl bg-[#0f172a]/85 backdrop-blur-xl border border-white/10 shadow-floating">
                                    
                                    {/* Built-in LiveKit Control Toggles (Mic/Cam/Share) styled via CSS usually, but we inject them directly */}
                                    <div className="flex items-center gap-2 border-r border-white/10 pr-2 lg:pr-4">
                                        <TrackToggle source={Track.Source.Microphone} showIcon={true} />
                                        <TrackToggle source={Track.Source.Camera} showIcon={true} />
                                        <TrackToggle source={Track.Source.ScreenShare} showIcon={true} />
                                    </div>

                                    <div className="flex items-center gap-2 pl-2 lg:pl-0">
                                        <button 
                                            onClick={toggleChat}
                                            className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300 ${
                                                showChat ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25' : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                            }`}
                                            title="Chat"
                                        >
                                            <MessageSquare className="w-5 h-5" />
                                        </button>
                                        
                                        {SettingsComponent && (
                                            <button 
                                                onClick={toggleSettings}
                                                className={`relative flex items-center justify-center w-11 h-11 rounded-full transition-all duration-300 ${
                                                    showSettings ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/25' : 'bg-white/10 text-gray-300 hover:bg-white/20'
                                                }`}
                                                title="AI Ghost Proxy"
                                            >
                                                <Cpu className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="pl-2 lg:pl-4 border-l border-white/10">
                                        <DisconnectButton className="flex items-center justify-center px-5 py-2.5 font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-lg shadow-red-900/20">
                                            Leave Room
                                        </DisconnectButton>
                                    </div>

                                </div>
                            </div>
                        </div>

                        {/* RIGHT SIDE PANEL (Dynamic) */}
                        <aside className={`shrink-0 bg-[#0f172a] shadow-2xl transition-[width,border] duration-300 ease-in-out absolute lg:relative right-0 h-full z-40 overflow-hidden ${
                            isPanelOpen ? 'w-[340px] border-l border-white/10' : 'w-0 border-none'
                        }`}>
                            {/* Inner fixed-width wrapper prevents contents from squishing during close animation */}
                            <div className="w-[340px] h-full overflow-hidden flex flex-col relative">
                                <div className={`absolute inset-0 w-full h-full flex flex-col transition-opacity duration-300 bg-[#0f172a] ${showChat ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                                    <CustomChat onClose={toggleChat} />
                                </div>
                                
                                {SettingsComponent && (
                                    <div className={`absolute inset-0 w-full h-full transition-opacity duration-300 bg-[#0f172a] p-4 overflow-y-auto ${showSettings ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
                                        <SettingsComponent />
                                    </div>
                                )}
                            </div>
                        </aside>
                    </main>
                </LayoutContextProvider>
            )}
            <RoomAudioRenderer />
            <ConnectionStateToast />
        </div>
    );
}
