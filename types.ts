
export type Language = 'en' | 'ru';

export interface MemoryItem {
  text: string;
  embedding: number[];
  timestamp: number;
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
  isSynced?: boolean; // Persistently track if the draft in this message was added
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