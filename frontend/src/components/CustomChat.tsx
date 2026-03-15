"use client";

import * as React from 'react';
import { useChat } from '@livekit/components-react';
import { X } from 'lucide-react';

interface CustomChatProps {
    onClose?: () => void;
}

export default function CustomChat({ onClose }: CustomChatProps) {
    const { chatMessages, send, isSending } = useChat();
    const [inputValue, setInputValue] = React.useState('');
    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = inputValue.trim();
        if (!trimmed) return;

        try {
            await send(trimmed);
        } catch (err) {
            console.error('Failed to send message:', err);
        }
        // Always clear input after attempting to send
        setInputValue('');
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="custom-chat">
            {/* Header */}
            <div className="custom-chat-header">
                <span className="custom-chat-title">Messages</span>
                {onClose && (
                    <button onClick={onClose} className="custom-chat-close">
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Messages List */}
            <div className="custom-chat-messages">
                {chatMessages.length === 0 && (
                    <div className="custom-chat-empty">
                        <p>No messages yet</p>
                        <p className="custom-chat-empty-sub">Send a message to start the conversation</p>
                    </div>
                )}
                {chatMessages.map((msg, idx) => {
                    const showName = idx === 0 || chatMessages[idx - 1].from !== msg.from;
                    return (
                        <div key={msg.id ?? idx} className="custom-chat-message">
                            {showName && (
                                <div className="custom-chat-meta">
                                    <span className="custom-chat-sender">
                                        {msg.from?.name || msg.from?.identity || 'Unknown'}
                                    </span>
                                    <span className="custom-chat-time">{formatTime(msg.timestamp)}</span>
                                </div>
                            )}
                            <div className="custom-chat-body">{msg.message}</div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form className="custom-chat-form" onSubmit={handleSubmit}>
                <input
                    type="text"
                    className="custom-chat-input"
                    placeholder="Enter a message..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={isSending}
                    onKeyDown={(e) => e.stopPropagation()}
                    onKeyUp={(e) => e.stopPropagation()}
                />
                <button
                    type="submit"
                    className="custom-chat-send"
                    disabled={isSending || !inputValue.trim()}
                >
                    Send
                </button>
            </form>
        </div>
    );
}
