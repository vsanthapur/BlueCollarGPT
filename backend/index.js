import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { OpenAI } from 'openai';

const ai = new OpenAI({ 
  apiKey: 'sk-rilla-vibes',
  baseURL: 'https://litellm.rillavoice.com/v1'
});

const app = express();
app.use(cors());
app.use(express.json());

// Store conversation state
const conversationState = new Map();

// Generate a unique invoice ID
function generateInvoiceId() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${year}-${month}${day}-${random}`;
}

app.post('/api/invoice', async (req, res) => {
  try {
    const { transcript, sessionId } = req.body;
    
    // Generate a sessionId if not provided
    const effectiveSessionId = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log('Received request:', { transcript, effectiveSessionId });
    
    // Generate current date and time window
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const hour = now.getHours();
    const timeWindow = `${hour}:00-${hour + 1}:30`;

    // Get or initialize session state
    let sessionState = conversationState.get(effectiveSessionId) || {
      invoiceId: generateInvoiceId(),
      previousTranscript: '',
      currentQuestionIndex: 0,
      answers: [],
      isFirstRecording: true
    };

    const prompt = [
      { 
        role: 'system', 
        content: `You are InvoiceBot. You MUST respond with ONLY valid JSON, no other text.
You have two possible response formats:

1. For a complete invoice:
{
  "type": "invoice",
  "data": {
    "invoiceId": "string (will be provided)",
    "date": "string (will be provided)",
    "timeWindow": "string (will be provided)",
    "client": "string",
    "address": "string",
    "items": [
      {
        "name": "string",
        "qty": number,
        "unitPrice": number
      }
    ],
    "subtotal": number,
    "tax": number,
    "total": number,
    "terms": "string (default: 'Due on receipt')",
    "paymentMethods": ["string"],
    "contractorLicense": "string (default: 'NY-PL-123456')",
    "warranty": "string (default: '30 days on labor; parts per manufacturer')",
    "customerSignature": null,
    "signedAt": null,
    "summary": "string"
  }
}

2. For questions:
{
  "type": "questions",
  "data": {
    "questions": ["string"],
    "currentQuestion": "string"
  }
}

IMPORTANT RULES:
1. Your response must be ONLY the JSON object, no other text or explanation
2. For the first recording:
   - Analyze the transcript to determine what information is missing
   - Generate specific, contextual questions based on the work being discussed
   - Example questions:
     * "What specific plumbing issue are you experiencing in your bathroom?"
     * "When did you first notice the electrical problem in your kitchen?"
     * "Which rooms need the HVAC repair work?"
     * "What is the square footage of the area that needs painting?"
   - Return the questions format with currentQuestion set to the first missing question
3. For all other missing information, make reasonable assumptions:
   - Use default values for terms, warranty, and contractor license
   - Set payment methods to ["Card", "Cash", "Zelle"]
   - Calculate tax based on local rates (around 5-8%)
   - Include a reasonable markup
   - Break down work into logical line items
4. If you receive answers to previous questions, combine them with the original context to generate a complete invoice
5. Leave customerSignature and signedAt as null`
      },
      { 
        role: 'user', 
        content: `${sessionState.isFirstRecording ? transcript : sessionState.previousTranscript + "\n\nAnswers to previous questions:\n" + transcript}\n\nUse these values for the invoice:\n- invoiceId: ${sessionState.invoiceId}\n- date: ${date}\n- timeWindow: ${timeWindow}`
      }
    ];

    console.log('Session State:', {
      effectiveSessionId,
      isFirstRecording: sessionState.isFirstRecording,
      currentQuestionIndex: sessionState.currentQuestionIndex,
      questionsCount: sessionState.questions?.length || 0,
      answersCount: sessionState.answers?.length || 0
    });
    
    const rsp = await ai.chat.completions.create({
      model: 'claude-3-5-sonnet',
      messages: prompt,
      temperature: 0.3,
      response_format: { type: "json_object" }
    });

    let result;
    try {
      const content = rsp.choices[0].message.content;
      console.log('Raw API Response:', content);
      
      // Try to parse the content
      try {
        const parsed = JSON.parse(content);
        // Handle nested json wrapper
        result = parsed.json || parsed;
      } catch (parseError) {
        console.error('Failed to parse JSON:', parseError);
        console.error('Content that failed to parse:', content);
        throw new Error('Invalid JSON response from model');
      }
      
      // Validate the response structure
      if (!result) {
        throw new Error('Empty response from model');
      }
      
      if (!result.type) {
        console.error('Response missing type:', result);
        throw new Error('Response missing type field');
      }
      
      if (result.type === 'questions' && (!result.data || !result.data.questions || !Array.isArray(result.data.questions))) {
        console.error('Invalid questions response:', result);
        throw new Error('Invalid questions response format');
      }
      
      console.log('Parsed Response:', {
        type: result.type,
        hasData: !!result.data,
        questionsCount: result.type === 'questions' ? result.data.questions.length : 0
      });
      
    } catch (parseError) {
      console.error('Failed to process model response:', parseError);
      throw new Error(`Failed to process model response: ${parseError.message}`);
    }

    // Update session state
    if (result.type === 'questions') {
      if (sessionState.isFirstRecording) {
        // First recording - store transcript and initialize questions
        sessionState.isFirstRecording = false;
        sessionState.previousTranscript = transcript;
        sessionState.currentQuestionIndex = 0;
        sessionState.answers = [];
        sessionState.questions = result.data.questions;
        console.log('Initialized new question session:', {
          questions: sessionState.questions,
          currentIndex: sessionState.currentQuestionIndex,
          questionsCount: sessionState.questions.length
        });
      } else {
        // Store the answer and move to next question
        sessionState.answers.push(transcript);
        sessionState.currentQuestionIndex++;
        console.log('Stored answer and moved to next question:', {
          currentIndex: sessionState.currentQuestionIndex,
          totalQuestions: sessionState.questions.length,
          answers: sessionState.answers
        });
      }
      
      // If we've answered all questions, generate the invoice
      if (sessionState.currentQuestionIndex >= sessionState.questions.length) {
        console.log('All questions answered, generating invoice');
        // Combine all context and generate invoice
        const combinedTranscript = sessionState.previousTranscript + "\n\nAnswers:\n" + sessionState.answers.join("\n");
        const finalPrompt = [
          prompt[0],
          {
            role: 'user',
            content: `${combinedTranscript}\n\nUse these values for the invoice:\n- invoiceId: ${sessionState.invoiceId}\n- date: ${date}\n- timeWindow: ${timeWindow}`
          }
        ];
        
        const finalResponse = await ai.chat.completions.create({
          model: 'claude-3-5-sonnet',
          messages: finalPrompt,
          temperature: 0.3,
          response_format: { type: "json_object" }
        });
        
        try {
          const finalResult = JSON.parse(finalResponse.choices[0].message.content);
          if (!finalResult || !finalResult.type || finalResult.type !== 'invoice') {
            throw new Error('Invalid invoice response format');
          }
          conversationState.delete(effectiveSessionId);
          res.json(finalResult.data);
          return;
        } catch (error) {
          console.error('Failed to parse final invoice response:', error);
          throw new Error('Failed to generate invoice: ' + error.message);
        }
      }
      
      // Return the current question
      const currentQuestion = sessionState.questions[sessionState.currentQuestionIndex];
      conversationState.set(effectiveSessionId, sessionState);
      
      const response = { 
        questions: sessionState.questions,
        currentQuestion: currentQuestion,
        sessionId: effectiveSessionId,
        status: 'waiting_for_input',
        questionNumber: sessionState.currentQuestionIndex + 1,
        totalQuestions: sessionState.questions.length
      };
      
      console.log('Sending response to frontend:', response);
      res.json(response);
    } else if (result.type === 'invoice') {
      // Clear the session state after successful invoice generation
      conversationState.delete(effectiveSessionId);
      console.log('Sending invoice to frontend:', result.data);
      res.json(result.data);
    } else {
      console.error('Invalid response type:', result.type);
      throw new Error('Invalid response type from model');
    }
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ 
      error: 'Failed to generate invoice',
      details: error.message
    });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`API running on port ${PORT}`)); 