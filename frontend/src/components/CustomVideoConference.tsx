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
import { Chat, ControlBar, useMaybeLayoutContext } from '@livekit/components-react';
import { useCreateLayoutContext, usePinnedTracks, useTracks } from '@livekit/components-react';
import { MessageSquare, Settings } from 'lucide-react';

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
        setWidgetState((prev) => ({ ...prev, ...state }));
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

    return (
        <div className="lk-video-conference">
            {isWeb() && (
                <LayoutContextProvider
                    value={layoutContext}
                    onWidgetChange={widgetUpdate}
                >
                    <div className="lk-video-conference-inner">
                        {!focusTrack ? (
                            <div className="lk-grid-layout-wrapper">
                                <GridLayout tracks={tracks}>
                                    <ParticipantTile />
                                </GridLayout>
                            </div>
                        ) : (
                            <div className="lk-focus-layout-wrapper">
                                <FocusLayoutContainer>
                                    <CarouselLayout tracks={carouselTracks}>
                                        <ParticipantTile />
                                    </CarouselLayout>
                                    {focusTrack && <FocusLayout trackRef={focusTrack} />}
                                </FocusLayoutContainer>
                            </div>
                        )}
                        <ControlBar controls={{ chat: false, settings: false }} />
                        
                        {/* Custom Buttons injected absolute bottom-right or alongside to override the context-bound ones */}
                        <div className="absolute bottom-[32px] right-6 flex items-center gap-3 z-40 bg-[rgba(15,23,42,0.85)] p-2 px-3 rounded-2xl border border-white/10 shadow-floating backdrop-blur-xl">
                            <button 
                                onClick={toggleChat}
                                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                                    showChat 
                                        ? 'bg-blue-600 text-white shadow-md' 
                                        : 'bg-white/[0.08] text-gray-300 hover:bg-white/[0.15]'
                                }`}
                            >
                                <MessageSquare className="w-4 h-4" />
                                Chat
                            </button>
                            {SettingsComponent && (
                                <button 
                                    onClick={toggleSettings}
                                    className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
                                        showSettings 
                                            ? 'bg-teal-600 text-white shadow-md' 
                                            : 'bg-white/[0.08] text-gray-300 hover:bg-white/[0.15]'
                                    }`}
                                >
                                    <Settings className="w-4 h-4" />
                                    Settings
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Chat and Settings share the SAME sidebar slot */}
                    <Chat
                        style={{ display: showChat ? 'grid' : 'none' }}
                    />
                    {SettingsComponent && (
                        <div
                            className="lk-settings-menu-modal"
                            style={{ display: showSettings ? 'block' : 'none' }}
                        >
                            <SettingsComponent />
                        </div>
                    )}
                </LayoutContextProvider>
            )}
            <RoomAudioRenderer />
            <ConnectionStateToast />
        </div>
    );
}
