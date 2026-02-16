
export type Language = 'en' | 'ru';

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

export interface Task {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string;
  category: string;
  completed: boolean;
  failed?: boolean;
  priority?: 'low' | 'medium' | 'high';
  rescheduleCount?: number;
  description?: string;
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly' | 'weekdays' | 'specific_days';
  daysOfWeek?: number[];
  dayOfMonth?: number;
  estimatedMinutes?: number; // New field for time estimation
}

export interface Personality {
  trust: number;      
  respect: number;    
  strictness: number; 
  burnoutRisk: number; // 0-100 based on density
  efficiency: number;  // 0-100 based on completion speed/consistency
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  draftEvent?: Partial<Event>;
  draftReschedule?: { 
    taskId: string; 
    newDate: string; 
    reason: string;
    isExternal?: boolean; 
  };
  agendaSummary?: {
    tasks?: Partial<Task>[];
    events?: Partial<Event>[];
  };
  kairosInsight?: {
    type: 'warning' | 'encouragement' | 'tip';
    message: string;
    burnoutDelta?: number;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
}
