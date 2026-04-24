import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@nanostores/react';
import { $language } from '../stores/app';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

interface UseVoiceInputOptions {
  /** Maximum recording duration in seconds (default: 120) */
  maxDuration?: number;
  /**
   * Called with the full combined text (base + transcript) on each speech result.
   * Consumers can pass their setState directly, e.g. `onTranscript: setMyTitle`.
   */
  onTranscript?: (fullText: string) => void;
}

interface UseVoiceInputReturn {
  isListening: boolean;
  recordingTime: number;
  startListening: (currentText?: string) => void;
  stopListening: () => void;
  toggleListening: (currentText?: string) => void;
}

/**
 * Shared hook for Web Speech Recognition across all views.
 * Eliminates duplicated speech-to-text boilerplate in CalendarView, TasksView, etc.
 */
export function useVoiceInput(options: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const { maxDuration = 120 } = options;
  const language = useStore($language);

  const [isListening, setIsListening] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const recognitionRef = useRef<any>(null);
  const baseInputRef = useRef('');
  const onTranscriptRef = useRef(options.onTranscript);
  onTranscriptRef.current = options.onTranscript;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  // Timer
  useEffect(() => {
    let interval: number;
    if (isListening) {
      interval = window.setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxDuration) {
            stopListening();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(interval);
  }, [isListening, maxDuration]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback((currentText: string = '') => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Speech Recognition is not supported in this browser.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = language === 'ru' ? 'ru-RU' : 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = true;

    recognition.onstart = () => {
      setIsListening(true);
      setRecordingTime(0);
      baseInputRef.current = currentText;
    };

    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      if (transcript) {
        const base = baseInputRef.current;
        const separator = base && !base.endsWith(' ') ? ' ' : '';
        onTranscriptRef.current?.(base + separator + transcript);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [language]);

  const toggleListening = useCallback((currentText: string = '') => {
    if (isListening) {
      stopListening();
    } else {
      startListening(currentText);
    }
  }, [isListening, startListening, stopListening]);

  return {
    isListening,
    recordingTime,
    startListening,
    stopListening,
    toggleListening,
  };
}
