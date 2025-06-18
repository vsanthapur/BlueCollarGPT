# Voice Invoice Generator

A voice-powered invoice generation system that uses speech recognition to create professional invoices. Built for a 3-hour hackathon, this project demonstrates the power of combining modern web technologies with AI.

## Features

- Voice input for client details and work description
- AI-powered price suggestion using Claude 3.5 Haiku
- Automatic PDF generation
- Google Sheets integration for record keeping
- Modern, responsive UI

## Tech Stack

- Frontend: React + Vite
- Speech-to-Text: Web Speech API
- Backend: Node.js + Express
- LLM: Rilla Bedrock proxy (Claude 3.5 Haiku)
- PDF Generation: PDFKit
- Storage: Google Sheets

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Copy `backend/.env.example` to `backend/.env`
   - Fill in your Rilla API key and Google Sheets credentials

4. Start the development servers:
   ```bash
   npm run dev
   ```

The frontend will be available at http://localhost:5173 and the backend at http://localhost:3001.

## Usage

1. Click the "Speak" button and answer each question:
   - Client name
   - Job address
   - Work description

2. After answering all questions, click "Create Invoice"
3. The system will:
   - Generate an AI-suggested price
   - Create a PDF invoice
   - Add the record to Google Sheets
   - Open the PDF in a new tab

## Development Notes

- The Web Speech API requires Chrome or Edge
- Google Sheets integration is optional - the system will work without it
- The backend can be deployed to Render.com or AWS Lambda
- The frontend can be deployed to any static hosting service

## License

MIT 