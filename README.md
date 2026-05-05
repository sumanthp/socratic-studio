# The Socratic Studio: Gemma 4 AI Tutor

The Socratic Studio is a tireless, 1-on-1 AI tutor designed for the **Kaggle Gemma 4 Hackathon**. It leverages the power of **Gemma 4 26B** for pedagogical dialogue and **Gemma 4 E4B** for a seamless, real-time voice-to-voice experience.

Instead of providing direct answers, the tutor uses Gemma 4’s "think" traces to identify where a student is stuck and asks the perfect next question to spark an "Aha!" moment.

## 🚀 Key Features

- **True Socratic Method:** Focused on process rather than answers.
- **Grounded Retrieval:** Uses Native Function Calling to query verified textbooks and curriculum standards, preventing hallucinations.
- **Voice-to-Voice:** Real-time audio streaming over WebSockets for a natural conversational experience.
- **Multi-Agent Council:** An ensemble of agents (Architect, Auditor, Debugger, Tutor) that provide comprehensive feedback on student code.

## 🛠️ Architecture

- **Frontend:** Next.js (TypeScript) with Tailwind CSS and Framer Motion for a polished, reactive UI.
- **Backend:** FastAPI (Python) orchestrating the LLM dialogue and audio processing.
- **LLMs:** 
  - **Gemma 4 26B (Ollama):** Manages the Socratic dialogue and tool use.
  - **Gemma 4 E4B (Ollama):** Handles real-time audio transcription and text-to-speech.

## 📦 Setup Instructions

### Prerequisites
- Node.js 18+
- Python 3.10+
- [Ollama](https://ollama.com/) with `gemma4:26b` and `gemma4:e4b` models installed.

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd ai-backend
   ```
2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI server:
   ```bash
   python main.py
   ```

### Frontend Setup
1. Navigate to the root directory:
   ```bash
   cd ..
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🧪 Testing Voice Mode
1. Click the **Microphone** icon in the chat interface.
2. Grant microphone permissions.
3. Speak a query (e.g., "How does Python handle memory?").
4. The Tutor will respond with a Socratic question based on grounded knowledge.

## 📝 License
MIT
