# Capco AI Avatar Interview Platform - Project Overview

## What This Project Does

This is an AI-powered interview platform that uses **lifelike video avatars** to conduct voice interviews with job candidates. Think of it as having a virtual interviewer that can see, hear, speak, and respond naturally in real-time—without requiring a human recruiter to be present for every interview.

### For Non-Technical Users

**What problem does it solve?**

Recruiting teams need to interview many candidates, but scheduling and conducting interviews is time-consuming. This platform automates the initial screening process by having an AI avatar conduct structured interviews while still providing a personal, human-like experience for candidates.

**Key capabilities:**

1. **Create Custom Interviews** - Recruiters upload a job description, and the system automatically generates tailored interview questions
2. **AI Avatar Interviewers** - Choose from different interviewer personalities (empathetic, exploratory, rapport-building) with adjustable speaking speeds
3. **Video + Voice Conversations** - Candidates speak naturally to a realistic video avatar that listens, responds, and asks follow-up questions in real-time
4. **Automatic Analysis** - Every interview is transcribed and analyzed, providing scores, insights, and communication metrics
5. **Dashboard & Reports** - View all interviews, candidate responses, performance metrics, and detailed transcripts in one place

**How it works:**

**For Recruiters:**
- Log into the dashboard and see all your interviews and statistics
- Create a new interview by pasting a job description or uploading a PDF
- The AI generates relevant interview questions automatically
- Share a simple link with candidates
- Review completed interviews with scores, transcripts, and communication analysis

**For Candidates:**
- Click the interview link and enter your name
- Meet the AI avatar interviewer on screen
- Allow microphone access and speak naturally
- The avatar asks questions, listens to your answers, and responds
- After the interview, your responses are saved and analyzed

**Special Features:**

- **Risk Profile Questionnaire (RPQ)** - A specialized financial assessment tool that uses an avatar to conduct a 12-question risk tolerance assessment in English with bilingual Chinese/English answer options
- **Avatar Studio Demo** - Experience the Capco-branded avatar environment showcasing wealth and asset management scenarios
- **Tab Tracking** - Monitors if candidates switch browser tabs during interviews (useful for integrity monitoring)

---

## Technical Architecture

### Technology Stack

**Frontend:**
- **Next.js 16** (React 19) - Modern web framework with server and client components
- **TypeScript** - Type-safe code throughout
- **HeyGen LiveAvatar Web SDK** - Real-time video avatar streaming with voice interaction
- **Recharts** - Data visualization for analytics dashboard

**Backend:**
- **Next.js API Routes** - RESTful endpoints for all operations
- **OpenAI API** - Language model for question generation and response analysis
- **JSON File Store** - Local persistence (`data/` directory, no database required)

**Key Dependencies:**
- `@heygen/liveavatar-web-sdk` - Avatar session management
- `openai` - LLM integration for content generation and analysis
- `pdf-parse` - Extract text from job description PDFs
- `zod` - Runtime schema validation
- `recharts` - Chart components for dashboard

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      USER INTERFACES                         │
├──────────────────┬──────────────────┬──────────────────────┤
│   Recruiter      │   Candidate      │   Demos              │
│   Dashboard      │   Interview      │   Studio / RPQ       │
└────────┬─────────┴────────┬─────────┴───────────┬──────────┘
         │                  │                      │
         └──────────────────┼──────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Next.js App   │
                    │  API Routes    │
                    └───────┬────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
    ┌────▼─────┐    ┌──────▼──────┐   ┌──────▼────────┐
    │  JSON    │    │  OpenAI     │   │  HeyGen       │
    │  Store   │    │  LLM API    │   │  LiveAvatar   │
    └──────────┘    └─────────────┘   └───────────────┘
```

### Core Components

**Data Layer (`lib/store/`)**
- Atomic JSON file operations for interviews, responses, interviewers, feedback
- Type-safe repositories with validation
- Auto-seeding of default interviewer personas

**API Layer (`app/api/`)**
- `/api/interviews` - CRUD for interview definitions
- `/api/responses` - Save and retrieve candidate answers
- `/api/session` - Generate LiveAvatar session tokens
- `/api/generate-questions` - AI question generation from job descriptions
- `/api/analyze-communication` - Post-interview analysis
- `/api/rpq` - Risk profile questionnaire endpoints

**AI Integration (`lib/openai/` & `lib/prompts/`)**
- Question generation from job descriptions
- Response analysis and scoring
- Communication metrics extraction
- Insight generation
- Prompt templates for consistent LLM behavior

**LiveAvatar Management (`lib/liveavatar/`)**
- Session token generation
- Context creation (interview-specific conversation contexts)
- Sandbox mode handling (short session segments)

**UI Components (`components/`)**
- `dashboard.tsx` - Main recruiter view with stats
- `interview-call.tsx` - Candidate interview session with avatar
- `avatar-studio.tsx` - Original Capco demo experience
- `rpq/rpq-assessment.tsx` - Financial risk assessment
- `new-interview-page.tsx` - Interview creation wizard

### Data Flow: Creating and Running an Interview

**1. Interview Creation (Recruiter)**
```
Recruiter uploads JD
    ↓
API extracts text from PDF/input
    ↓
OpenAI generates interview questions
    ↓
API creates LiveAvatar context with questions + persona
    ↓
Store saves interview with liveAvatarContextId
    ↓
Recruiter gets shareable link
```

**2. Candidate Interview Session**
```
Candidate opens link → /call/{interviewId}
    ↓
API loads interview + checks if sandbox mode
    ↓
Request session token from LiveAvatar API
    ↓
Initialize LiveAvatar SDK in browser
    ↓
Video stream starts, microphone enabled
    ↓
Avatar asks questions, candidate speaks
    ↓
LiveAvatar SDK captures voice, sends to avatar
    ↓
Avatar responds with follow-ups
    ↓
Transcript accumulated (+ tab-switch tracking)
    ↓
Candidate ends interview
    ↓
API saves response and runs analysis
    ↓
Scores and insights generated
```

**3. Sandbox Mode (Free Tier Limitation)**

LiveAvatar free sandbox sessions last ~60 seconds. The platform splits longer interviews into segments:

```
Interview with 5 questions
    ↓
Segment 1: Question 1 (~60s)
    → Session ends, show "continue" UI
Segment 2: Question 2 (~60s)
    → Session ends, show "continue" UI
Segment 3: Question 3 (~60s)
    → ...continues until all questions complete
    ↓
Full transcript submitted once at end
```

Each segment creates an ephemeral LiveAvatar context. Non-sandbox mode runs as a single uninterrupted session.

### Key Technical Features

**Real-Time Avatar Interaction**
- WebRTC-based video streaming from HeyGen
- Voice activity detection (when avatar/user is speaking)
- Connection quality monitoring
- Automatic reconnection handling
- Keep-alive ping to maintain session

**Interview Intelligence**
- Dynamic question generation based on job requirements
- Multi-persona interviewer configurations
- Context-aware follow-up prompts
- Overall and per-question scoring (1-10)
- Communication metrics (clarity, confidence, relevance)
- Behavioral insights extraction

**Risk Profile Questionnaire (RPQ)**
- 12-question financial risk assessment
- Deterministic scoring (12-60 point scale)
- 5 risk tolerance bands (Conservative → Aggressive)
- Bilingual UI (English/Traditional Chinese)
- Voice answer matching with fallback LLM
- Anonymous assessment storage
- Regression test suite included

**Security & Monitoring**
- Tab-switch detection and tracking
- Microphone permission handling
- Session state management
- Error boundary handling

### Data Storage Structure

All data stored as JSON files in `data/` directory (gitignored):

**`interviewers.json`**
```json
{
  "id": "uuid",
  "name": "Empathetic Explorer",
  "personality": "warm and encouraging",
  "speakingRate": 1.0
}
```

**`interviews.json`**
```json
{
  "id": "uuid",
  "title": "Senior Developer Interview",
  "jobDescription": "...",
  "questions": [...],
  "interviewerId": "uuid",
  "liveAvatarContextId": "...",
  "shareUrl": "/call/uuid"
}
```

**`responses.json`**
```json
{
  "id": "uuid",
  "interviewId": "uuid",
  "candidateName": "John Doe",
  "transcript": "...",
  "overallScore": 7.5,
  "questionScores": [...],
  "insights": {...},
  "tabSwitches": 2
}
```

**`rpq-assessments.json`**
```json
{
  "id": "uuid",
  "answers": [...],
  "totalScore": 42,
  "riskProfile": "Growth",
  "timestamp": "2026-09-04T..."
}
```

### Environment Configuration

Required environment variables:

```bash
# LiveAvatar API (HeyGen)
LIVEAVATAR_API_KEY=your_heygen_api_key
LIVEAVATAR_SANDBOX=true  # Use free tier with 60s segments

# OpenAI-compatible LLM API
CUSTOM_LLM_API_KEY=your_llm_key
CUSTOM_LLM_ENDPOINT=https://api.openai.com/v1
CUSTOM_LLM_MODEL=gpt-4

# Optional: Register custom LLM with LiveAvatar for voice responses
CUSTOM_LLM_PROVIDER=openai
```

### Routes & Endpoints

**Public Pages:**
- `/` - Recruiter dashboard
- `/studio` - Avatar demo (Capco wealth management)
- `/rpq` - Risk profile questionnaire
- `/interviewers` - Manage interviewer personas
- `/interviews/new` - Create new interview
- `/interviews/{id}` - Interview details and responses
- `/call/{interviewId}` - Candidate interview session
- `/responses/{id}` - Individual response report

**API Endpoints:**
- `GET /api/interviews` - List all interviews
- `POST /api/interviews` - Create interview with questions
- `GET /api/interviews/{id}` - Get interview details
- `POST /api/session` - Generate LiveAvatar session token
- `POST /api/responses` - Save candidate response
- `GET /api/responses/{id}` - Get response with analysis
- `POST /api/generate-questions` - Generate questions from JD
- `POST /api/analyze-communication` - Analyze transcript
- `GET /api/interviewers` - List interviewer personas

### Testing

```bash
npm test  # Run Vitest suite
```

Test coverage includes:
- RPQ answer matching logic
- RPQ scoring calculations
- Edge cases for voice input parsing

### Setup & Development

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Set up LiveAvatar contexts
npm run liveavatar:setup      # Main demo context
npm run liveavatar:setup-llm  # Register custom LLM (optional)
npm run liveavatar:setup-rpq  # RPQ context

# Start development server
npm run dev

# Open http://localhost:3000
```

### Deployment Considerations

**Production checklist:**
- Set `LIVEAVATAR_SANDBOX=false` for uninterrupted sessions
- Migrate from JSON files to a database (PostgreSQL, Supabase)
- Add authentication (NextAuth.js recommended)
- Implement rate limiting on API routes
- Add CDN for static assets
- Configure proper CORS for LiveAvatar SDK
- Set up monitoring and error tracking
- Implement proper secret management
- Add backup strategy for response data

**Scalability:**
- Current architecture supports ~100 concurrent interviews
- LiveAvatar SDK handles WebRTC at client side
- Bottleneck is LiveAvatar API token generation rate
- Consider caching interview contexts
- Database migration needed for >1000 interviews

---

## Use Cases

**1. High-Volume Recruiting**
Screen hundreds of candidates efficiently with consistent interview quality

**2. Financial Services Assessments**
Conduct regulatory-compliant risk profiling with standardized questionnaires

**3. Training & Onboarding**
Practice interview scenarios with realistic avatar feedback

**4. Customer Research**
Gather qualitative feedback through conversational AI interviews

**5. Language Learning**
Practice conversations with adjustable speaking rates and personas

---

## Future Enhancement Opportunities

- Multi-language interview support
- Video recording of candidate (with consent)
- Custom avatar selection per interview
- Interview templates library
- Email notifications for recruiters
- Calendar integration for scheduling
- Mobile app version
- Real-time interview monitoring dashboard
- Integration with ATS (Applicant Tracking Systems)
- Advanced analytics and ML-based insights
- Team collaboration features
- Custom scoring rubrics per role
