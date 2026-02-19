
export type Language = 'en' | 'ru';

export interface MemoryItem {
  text: string;
  timestamp: number;
}

export interface UserPreferences {
  userName: string;
  assistantName: string;
  theme: 'light' | 'dark' | 'cream';
  onboardingComplete: boolean;
}

export interface KnowledgeBase {
  user_name: string;
  background?: string;
  aesthetics?: string;
  core_stack?: string[];
  current_projects?: string[];
  interests?: string[];
  preferences?: {
    code_style?: string;
    tone?: string;
    scheduling?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface Event {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  location?: string;
  attendees?: string[];
  type: 'work' | 'personal' | 'meeting';
  source?: 'local' | 'google';
  externalId?: string;
  description?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'specific_days';
  daysOfWeek?: number[];
  dayOfMonth?: number;
}

export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface Task {
  id: string;
  title: string;
  date?: string; // Optional for drafts
  time?: string;
  category: string;
  completed: boolean;
  failed?: boolean;
  priority: TaskPriority;
  rescheduleCount?: number;
  description?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'specific_days';
  daysOfWeek?: number[];
  dayOfMonth?: number;
  estimatedMinutes?: number; 
  source?: 'local' | 'google';
  externalId?: string;
}

export interface Personality {
  trust: number;      
  respect: number;    
  strictness: number; 
  burnoutRisk: number; 
  efficiency: number;  
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isSynced?: boolean; 
  draftEvent?: Partial<Event>;
  draftTask?: Partial<Task>;
  draftReschedule?: { 
    taskId: string; 
    newDate: string; 
    reason: string;
    isExternal?: boolean; 
  };
  kairosInsight?: {
    type: 'warning' | 'encouragement' | 'tip';
    message: string;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}
