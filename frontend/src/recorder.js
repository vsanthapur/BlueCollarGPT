import { useState, useRef } from 'react';

export default function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recRef = useRef(null);

  const record = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser. Please use Chrome or Edge.');
      return;
    }

    recRef.current = new SpeechRecognition();
    recRef.current.continuous = false;
    recRef.current.interimResults = false;
    
    recRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setTranscript(transcript);
    };

    recRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recRef.current.onend = () => {
      setIsRecording(false);
    };

    try {
      recRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting speech recognition:', error);
    }
  };

  const stop = () => {
    if (recRef.current) {
      recRef.current.stop();
    }
  };

  const clear = () => {
    setTranscript('');
  };

  return { record, stop, isRecording, transcript, clear };
} 