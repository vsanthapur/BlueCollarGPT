import React, { useState, useRef, useEffect } from 'react';
import './App.css';

function App() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [invoice, setInvoice] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const transcriptRef = useRef('');

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      recognitionRef.current = new window.webkitSpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

      recognitionRef.current.onresult = (event) => {
        const current = event.resultIndex;
        const t = event.results[current][0].transcript;
        console.log('Speech recognized:', t);
        setTranscript(t);
        transcriptRef.current = t;
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        const t = transcriptRef.current;
        if (t && t.trim().length > 0) {
          generateInvoice(t);
        }
      };
    } else {
      setError('Speech recognition is not supported in your browser.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = () => {
    setTranscript('');
    transcriptRef.current = '';
    recognitionRef.current.start();
    setIsListening(true);
  };

  const stopListening = () => {
    recognitionRef.current.stop();
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      if (!questions.length) {
        setInvoice(null);
        setQuestions([]);
        setCurrentQuestion('');
        setSessionId(null);
      }
      setError(null);
      startListening();
    }
  };

  const generateInvoice = async (t) => {
    setIsProcessing(true);
    setError(null);
    console.log('Calling /api/invoice with:', { transcript: t, sessionId });
    try {
      const response = await fetch('http://localhost:3001/api/invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: t,
          sessionId: sessionId
        }),
      });

      const data = await response.json();
      console.log('API response:', data);
      if (response.ok) {
        if (data.status === 'waiting_for_input') {
          setQuestions(data.questions);
          setCurrentQuestion(data.currentQuestion);
          setSessionId(data.sessionId);
          console.log('Set questions:', data.questions, 'Current question:', data.currentQuestion, 'Session:', data.sessionId);
        } else {
          setInvoice(data);
          setQuestions([]);
          setCurrentQuestion('');
          setSessionId(null);
          console.log('Set invoice:', data);
        }
      } else {
        console.error('API error:', data.error);
        throw new Error(data.error || 'Failed to generate invoice');
      }
    } catch (err) {
      setError(err.message);
      console.error('Error in generateInvoice:', err.message);
    } finally {
      setIsProcessing(false);
      console.log('Set isProcessing to false');
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Voice-Powered Invoice Generator</h1>
        <button 
          onClick={toggleListening}
          className={`record-button ${isListening ? 'listening' : ''}`}
        >
          {isListening ? 'Stop Recording' : 'Start Recording'}
        </button>
        
        {transcript && (
          <div className="transcript">
            <h3>Your Input:</h3>
            <p>{transcript}</p>
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        {isProcessing && (
          <div className="processing">
            Processing your request...
          </div>
        )}

        {currentQuestion && (
          <div className="questions">
            <h3>Question {questions.indexOf(currentQuestion) + 1} of {questions.length}:</h3>
            <p>{currentQuestion}</p>
            <p className="recording-hint">Click "Start Recording" to answer</p>
          </div>
        )}

        {invoice && (
          <div className="invoice">
            <h2>Generated Invoice</h2>
            <div className="invoice-header">
              <div>
                <h3>Invoice #{invoice.invoiceId}</h3>
                <p>Date: {invoice.date}</p>
                <p>Time Window: {invoice.timeWindow}</p>
              </div>
              <div>
                <h4>Bill To:</h4>
                <p>{invoice.client}</p>
                <p>{invoice.address}</p>
              </div>
            </div>

            <table className="invoice-items">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>{item.qty}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td>{formatCurrency(item.qty * item.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3">Subtotal</td>
                  <td>{formatCurrency(invoice.subtotal)}</td>
                </tr>
                <tr>
                  <td colSpan="3">Tax</td>
                  <td>{formatCurrency(invoice.tax)}</td>
                </tr>
                <tr className="total">
                  <td colSpan="3">Total</td>
                  <td>{formatCurrency(invoice.total)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="invoice-details">
              <div>
                <h4>Terms</h4>
                <p>{invoice.terms}</p>
              </div>
              <div>
                <h4>Payment Methods</h4>
                <p>{invoice.paymentMethods.join(', ')}</p>
              </div>
              <div>
                <h4>Contractor License</h4>
                <p>{invoice.contractorLicense}</p>
              </div>
              <div>
                <h4>Warranty</h4>
                <p>{invoice.warranty}</p>
              </div>
            </div>

            <div className="invoice-summary">
              <h4>Work Summary</h4>
              <p>{invoice.summary}</p>
            </div>

            <div className="invoice-signature">
              <div>
                <h4>Customer Signature</h4>
                <p>{invoice.customerSignature || 'Not signed'}</p>
              </div>
              <div>
                <h4>Signed At</h4>
                <p>{invoice.signedAt || 'Not signed'}</p>
              </div>
            </div>
          </div>
        )}
      </header>
    </div>
  );
}

export default App; 