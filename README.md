# AI Interviewer

An intelligent, voice-driven AI recruiter application that parses resumes, LinkedIn profiles, and GitHub activity to conduct personalized technical interviews.

## Features

- **Profile Fusion**: Combines Resume (PDF), LinkedIn (PDF), and GitHub activity into a single candidate profile.
- **Voice-Driven Interviews**: Uses real-time text-to-speech and speech-to-text to conduct voice interviews.
- **AI-Powered Evaluation**: Generates detailed candidate performance reports and structured feedback using Gemini.
- **Monorepo Architecture**: Clean separation between frontend, backend, and shared configurations.

## Project Structure

- `apps/backend`: Express & WebSocket server integrated with Bun and Gemini API.
- `apps/frontend`: React application using Bun, Tailwind CSS, and Shadcn UI.
- `packages/eslint-config`: Shared ESLint configurations.
- `packages/typescript-config`: Shared TypeScript configurations.
- `packages/ui`: Shared UI components.

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.3.11 or later)
- PostgreSQL database
- Gemini API Key

### Installation

1. Install dependencies at the root:
   ```bash
   bun install
   ```

2. Configure environment variables in `apps/backend/.env`.

3. Run migrations and start the development server:
   ```bash
   bun dev
   ```

## License

MIT License