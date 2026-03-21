import { useState, useRef, useEffect } from 'react';

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function VoiceInput({ onTranscript, disabled }) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => !!SpeechRecognition);
  const recognitionRef = useRef(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += t + ' ';
        else interim = t;
      }
      onTranscript(finalTranscript + interim);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      title={listening ? 'Stop recording' : 'Speak your issue'}
      className={`p-2 rounded-lg border transition-all ${
        listening
          ? 'border-red-500 bg-red-900/30 text-red-400 animate-pulse'
          : 'border-gray-600 bg-gray-800 text-gray-400 hover:text-green-400 hover:border-green-500'
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {listening ? (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <rect x="6" y="4" width="4" height="16" rx="1"/>
          <rect x="14" y="4" width="4" height="16" rx="1"/>
        </svg>
      ) : (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line strokeLinecap="round" x1="12" y1="19" x2="12" y2="23" />
          <line strokeLinecap="round" x1="8" y1="23" x2="16" y2="23" />
        </svg>
      )}
    </button>
  );
}
