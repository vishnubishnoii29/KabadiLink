import React, { useState, useEffect } from 'react';
import { useI18n } from '../i18n';

export default function VoiceReader({ text, label = 'Listen Aloud', size = 'normal' }) {
  const { lang } = useI18n();
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      setSupported(true);
    }
  }, []);

  const handleSpeak = (e) => {
    e?.stopPropagation();
    if (!supported || !text) return;

    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    window.speechSynthesis.cancel(); // Stop any ongoing speech
    const utterance = new SpeechSynthesisUtterance(text);

    // Map UI language to BCP 47 voice code
    if (lang === 'hi') {
      utterance.lang = 'hi-IN';
    } else if (lang === 'mr') {
      utterance.lang = 'mr-IN';
    } else {
      utterance.lang = 'en-IN';
    }

    utterance.rate = 0.95; // Slightly slower for clarity
    utterance.pitch = 1.0;

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={handleSpeak}
      className={`btn ${speaking ? 'btn-primary' : 'btn-secondary'}`}
      style={{
        padding: size === 'small' ? '0.25rem 0.55rem' : '0.4rem 0.8rem',
        fontSize: size === 'small' ? '0.75rem' : '0.8rem',
        borderColor: speaking ? 'var(--primary)' : 'var(--border-subtle)',
        boxShadow: speaking ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        borderRadius: 'var(--radius-full)'
      }}
      title="Voice Readout Assistance (Audio Guidance)"
    >
      <span>{speaking ? '⏹️' : '🔊'}</span>
      <span>{speaking ? 'Speaking...' : label}</span>
    </button>
  );
}
