
import { Language } from './types';

export const translations = {
  en: {
    nav: {
      secretary: 'Secretary',
      calendar: 'Calendar',
      tasks: 'Tasks',
      focus: 'Focus',
      assistant: 'Scheduling Assistant'
    },
    chat: {
      placeholder: 'Tell me your plans...',
      analyzing: 'Kairos is thinking...',
      recommendation: 'Secretary Recommendation',
      syncNow: 'Synchronize Now',
      insight: 'Kairos Insight',
      initialMsg: "Good morning. I've analyzed your schedule. How can I help you today?",
      eveningSummaryTitle: 'Evening Summary',
      generatingSummary: 'Generating your evening summary...'
    },
    calendar: {
      linkGoogle: 'Link Google',
      linked: 'Linked',
      objectives: 'Objectives',
      noPlans: 'No plans found',
      quickAdd: 'Quick Add',
      addSchedule: 'Add to Schedule',
      event: 'Event',
      task: 'Task',
      eventTitle: 'Event title?',
      taskDesc: 'Task description?'
    },
    tasks: {
      title: 'Objectives',
      activeFor: 'Active for',
      newTask: 'New Task',
      cancel: 'Cancel',
      accept: 'Accept Task',
      today: 'Today',
      tomorrow: 'Tomorrow',
      abandoned: 'Abandoned Plans',
      upcoming: 'Upcoming',
      completed: 'Completed',
      noTasks: 'No tasks currently assigned',
      placeholder: 'Target objective for today?',
      postpone: 'Move to Tomorrow',
      abandon: 'Failed - Missed Deadline',
      categories: ['Work', 'Personal', 'Meeting', 'Finance'],
      routines: 'Daily Rituals & Routines',
      oneOffs: 'Specific Objectives'
    },
    focus: {
      title: 'Focus',
      selectObjective: 'Select an objective',
      clearAgenda: 'Your agenda is clear.',
      intervalComplete: 'Interval Complete',
      takeBreath: "Take a breath. You've made progress.",
      markFinished: 'Mark Finished',
      continue: 'Continue Focus',
      currentIntention: 'Current Intention',
      commence: 'Commence',
      pause: 'Pause'
    },
    modal: {
      calendarEvent: 'Calendar Event',
      agendaTask: 'Agenda Task',
      acknowledged: 'Acknowledged',
      update: 'Update Schedule',
      notes: 'Contextual Notes & Links',
      noNotes: 'No additional notes provided.',
      recurrence: 'Recurrence Pattern',
      startDate: 'Start Date',
      timeframe: 'Timeframe',
      category: 'Category',
      dayOfMonth: 'Day of Month',
      chooseDays: 'Choose Days'
    }
  },
  ru: {
    nav: {
      secretary: 'Секретарь',
      calendar: 'Календарь',
      tasks: 'Задачи',
      focus: 'Фокус',
      assistant: 'Ассистент по планированию'
    },
    chat: {
      placeholder: 'Поделитесь планами...',
      analyzing: 'Кайрос думает...',
      recommendation: 'Рекомендация секретаря',
      syncNow: 'Синхронизировать',
      insight: 'Инсайт Кайрос',
      initialMsg: "Доброе утро. Я проанализировал ваше расписание. Чем могу помочь сегодня?",
      eveningSummaryTitle: 'Вечерний итог',
      generatingSummary: 'Готовлю ваш вечерний итог...'
    },
    calendar: {
      linkGoogle: 'Привязать Google',
      linked: 'Привязано',
      objectives: 'Цели',
      noPlans: 'Планов пока нет',
      quickAdd: 'Быстрое добавление',
      addSchedule: 'Добавить в график',
      event: 'Событие',
      task: 'Задача',
      eventTitle: 'Название события?',
      taskDesc: 'Описание задачи?'
    },
    tasks: {
      title: 'Цели',
      activeFor: 'Активно на',
      newTask: 'Новая задача',
      cancel: 'Отмена',
      accept: 'Принять задачу',
      today: 'Сегодня',
      tomorrow: 'Завтра',
      abandoned: 'Заброшенные планы',
      upcoming: 'Предстоящие',
      completed: 'Завершено',
      noTasks: 'Задач пока не назначено',
      placeholder: 'Ваша цель на сегодня?',
      postpone: 'Перенести на завтра',
      abandon: 'Провалено - дедлайн пропущен',
      categories: ['Работа', 'Личное', 'Встреча', 'Финансы'],
      routines: 'Ежедневные ритуалы и привычки',
      oneOffs: 'Конкретные цели'
    },
    focus: {
      title: 'Фокус',
      selectObjective: 'Выберите цель',
      clearAgenda: 'Ваш список дел пуст.',
      intervalComplete: 'Интервал завершен',
      takeBreath: 'Сделайте вдох. Вы продвинулись вперед.',
      markFinished: 'Завершить задачу',
      continue: 'Продолжить фокус',
      currentIntention: 'Текущее намерение',
      commence: 'Начать',
      pause: 'Пауза'
    },
    modal: {
      calendarEvent: 'Событие календаря',
      agendaTask: 'Задача из списка',
      acknowledged: 'Принято',
      update: 'Обновить график',
      notes: 'Заметки и ссылки',
      noNotes: 'Дополнительных заметок нет.',
      recurrence: 'Повторение',
      startDate: 'Дата начала',
      timeframe: 'Время',
      category: 'Категория',
      dayOfMonth: 'День месяца',
      chooseDays: 'Выберите дни'
    }
  }
};

export const getT = (lang: Language) => translations[lang];
