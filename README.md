


<img width="1260" height="699" alt="{28878F22-CE59-46EA-B309-5DF660DEFE3B}" src="https://github.com/user-attachments/assets/c23ffeb4-3d16-4a09-9a5f-500f1efca6df" />

> **???:** "Haha, wait, he literally built a to-do list?"  
> **Me:** "But what if it was actually worth your time?"

---

### The Problem
**Productivity tools are broken.** 
Calendars tell you *when* to work, but not *what* to do. To-do lists tell you *what* to do, but not *when*. You spend more mental energy organizing your work than actually doing it. Most "AI" assistants are just chatbots that don't know who you are, or they are rigid tools that require manual data entry.

### The Solution: Kairos
**Kairos is not a tool. It is a Kind AI Responsible for Organizing Schedule.**
It bridges the gap between your Tasks (The Eisenhower Matrix) and your Time (The Calendar) using a persistent, context-aware AI agent.

It doesn't just store data; it builds a **Knowledge Base** about you—your habits, your job, your tech stack, and your energy levels—and uses that context to manage your day.

---

### Why this is different (The "Secret Sauce")

# Kairos

1.  **The Memory Agent (Contextual Awareness)**
    *   Kairos maintains a live JSON knowledge base of *who you are*.
    *   If you mention you are a "React Developer" in chat, Kairos remembers. Next time you ask to schedule a "coding session," it knows what that entails.
    *   It updates this memory in the background while you chat.
  
<img width="1260" height="695" alt="{DBCEBBE6-4184-4437-878D-7284FA8FBA65}" src="https://github.com/user-attachments/assets/e840060e-4759-43e9-bef6-ae7ab4045b37" />


2.  **The Eisenhower Matrix on Autopilot**
    *   **Input:** "I need to file taxes."
    *   **AI Action:** Instant classification. It determines if this is Urgent/Important and slots it into the correct quadrant (Do First, Schedule, Delegate, Delete).
    *   **Drag & Drop:** An interactive UI that feels tactile and satisfying.
  
<img width="1260" height="690" alt="{CF81EFD7-9A6D-47B3-91FF-EF8BCD23EA68}" src="https://github.com/user-attachments/assets/fec2feb7-e26d-406a-b128-50847fdb890b" />


3.  **One-Click Auto-Scheduling**
    *   Tasks usually die in the backlog. Kairos solves this.
    *   Click the **Auto-Schedule** button on any task. The AI reads your calendar, finds a specific gap based on your preferences (e.g., "Deep work in the morning"), and books it.

<img width="1260" height="696" alt="{059A9842-D1B6-4F09-B6E4-14EE05E0E6BA}" src="https://github.com/user-attachments/assets/f2a86f08-6e65-4180-ae94-76858d4d6be0" />

4.  **Deep Work Focus Mode**
    *   A built-in Pomodoro-style timer that locks onto a specific Task or Event.
    *   Visual progress bars and "breath" reminders to prevent burnout.

<img width="1260" height="692" alt="{B93C4B1B-028D-4B72-BF63-0C2C15A84A15}" src="https://github.com/user-attachments/assets/8eeeb836-de3e-4c30-a43a-e2092db8ad71" />


---

### Tech Stack

*   **Frontend:** React 19, Tailwind CSS (Glassmorphism UI).
*   **AI:** Google Gemini API (`gemini-3-flash-preview` for complex logic, `flash-lite` for categorization).
*   **Integration:** Google Calendar & Google Tasks (Two-way Sync).
*   **Voice:** Web Speech API for hands-free interaction.
*   **Architecture:** Local-first state management with `localStorage` persistence.

---

### Setup & Installation

1.  **Clone the repo.**
2.  **Set your API Key:**
    You need a Google Gemini API Key.
    *Note: Ensure `process.env.API_KEY` is accessible in your environment.*
3.  **Install & Run:**
    ```bash
    npm install
    npm start
    ```
    *Runs on port 8080 by default.*

---

### 🌟 Best User Experience Instructions

To get the absolute most out of Kairos, follow this flow:

1.  **The "Onboarding" Chat:**
    *   Don't just say "Hi". Tell Kairos about yourself immediately.
    *   *Example:* "I'm a backend engineer. I like to do deep work between 9 AM and 11 AM. I hate meetings after 4 PM."
    *   *Why:* The **Memory Agent** will extract these facts and use them for every future scheduling decision.
    *   Kairos learns by itself, so this part is actually very much optional!~

2.  **Use Voice for Brain Dumps:**
    *   Click the **Mic icon** in the Chat or Quick Add modal.
    *   *Action:* Ramble for 30 seconds about everything on your mind.
    *   *Result:* Kairos will parse the ramble, extract distinct tasks, categorize them by urgency, and draft them for you.

3.  **The "Auto-Schedule" Magic:**
    *   Go to the **Tasks View**.
    *   Create a task like "Write Project Proposal".
    *   Don't manually look for time. Click the **Magic Wand/Sync** icon on the task card.
    *   Kairos will find the optimal slot in your calendar and book it.

4.  **Google Sync is Mandatory:**
    *   For the full experience, click **Link Google** in the top right.
    *   This allows Kairos to see your real meetings so it never double-books you when auto-scheduling tasks.

5.  **Enter Focus Mode:**
    *   When it's time to work, go to the **Focus** tab.
    *   Select the specific task you are doing. The UI clears away all clutter. It is just you and the objective.
