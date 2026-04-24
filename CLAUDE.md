# Kairos - Project Guidelines for AI Assistants

## Project Context & Mission
Kairos is a local-first, privacy-focused "Kind AI" assistant specifically designed to support users with ADHD and CPTSD. Our core goal is to reduce cognitive load, executive dysfunction, and scheduling anxiety. The app acts as a supportive mentor that bridges the gap between tasks and time.

### UX/UI Philosophy for Neurodivergence
- **Low Cognitive Load**: Interfaces must be uncluttered. Do not overwhelm the user with too many choices on a single screen.
- **Forgiving Workflows**: Make it easy to reschedule, undo, or move tasks without guilt-inducing red text or aggressive overdue notifications.
- **Empathetic Interactions**: The AI persona should be adaptable but default to kind, supportive, and slightly witty. No judgment.
- **Aesthetics**: We use a "Glassmorphism" aesthetic with soft, harmonious colors, smooth gradients, and subtle micro-animations to create a premium, calming environment.

## Technology Stack
- **Web Core**: Astro 5, React 19.
- **Styling**: Tailwind CSS v4 (using `@tailwindcss/vite` and CSS-native config in `src/styles/global.css`).
- **State Management**: `nanostores` (v1.3) and `@nanostores/persistent`.
- **AI Integration**: Google Gemini API (`@google/genai`) for NLP extraction (e.g., pulling tasks from voice transcripts).
- **Mobile Companion**: Expo (React Native) located in the `/mobile` directory.

## Architecture & Data Persistence
- **Local-First**: Data (Events, Tasks, Chats) is persisted locally via `localStorage` using `persistentAtom` from nanostores (e.g., `kairos_events`, `kairos_tasks`). 
- **Google Sync**: We support syncing with Google Calendar and Tasks. Ensure sync logic does not destructively overwrite local data if the API fails or filters out past events.
- **Client Hydration**: Because we use Astro, nanostore states are evaluated on the client. UI components must safely consume stores via `useStore`.

## Important Commands
- **Web Dev**: `npm run dev`
- **Web Build**: `npm run build`
- **Expo (Mobile) Start**: `npm run expo` or `npm run mobile`
- **Expo iOS/Android**: `npm run expo:ios` / `npm run expo:android`

## Coding Rules
1. Never break the Glassmorphism UI by adding harsh, solid background colors. Use backdrop-blur utilities.
2. Keep `src/stores/app.ts` as the single source of truth for global state.
3. When writing Astro components, remember that React components need `client:load` or `client:only` directives if they rely on browser APIs like `localStorage` or `window`.
4. If modifying the mobile app, respect React Native constraints and ensure parity with the web's design tokens.

## Code Maintenance & Legacy Debt Reduction
To ensure Kairos remains scalable and easy to maintain, all contributors (human and AI) must follow these best practices for code hygiene and technical debt reduction:
- **Type Safety**: Maintain strict TypeScript interfaces (`src/types.ts`). Avoid `any` types. When refactoring legacy code, your first step should be enforcing strong types.
- **Component Refactoring**: If a React component exceeds 250 lines or handles multiple distinct UI concerns, extract sub-components into a `components/` subdirectory.
- **State Logic Decoupling**: Keep business logic out of UI components. Move data transformation and state mutations into nanostore action functions (e.g., inside `app.ts` or a dedicated store file).
- **Dead Code Elimination**: Proactively remove unused Tailwind classes, stale imports, and orphaned functions during every touchpoint.
- **Legacy Debt Reducer Tooling**: When instructed to "reduce legacy debt," focus on migrating outdated patterns (e.g., old Astro/Tailwind integrations) to our current stack standards, deduplicating utility functions, and centralizing magic strings into constants.
