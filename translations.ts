
import { Language } from './types';

export const translations = {
  en: {
    common: {
      syncing: 'Syncing...',
      syncedAt: 'Last synced at',
      syncNow: 'SYNC NOW',
      linkGoogle: 'Link Google',
      google: 'GOOGLE',
      disconnect: 'Disconnect',
      update: 'Update',
      cancel: 'Cancel',
      save: 'Save',
      delete: 'Delete',
      edit: 'Edit',
      details: 'View Details',
      weekDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      shortWeekDays: ['M', 'T', 'W', 'T', 'F', 'S', 'S']
    },
    nav: {
      secretary: 'Secretary',
      calendar: 'Calendar',
      tasks: 'Drafts',
      focus: 'Focus',
      assistant: 'Personal Assistant'
    },
    chat: {
      placeholder: 'Tell me your plans...',
      thinking: 'Kairos is planning...',
      refining: 'Refining details...',
      updatingMemory: 'Updating context...',
      listening: 'Listening...',
      initialMsg: (userName: string, assistantName: string) => `Hello, ${userName}! I'm your personal ${assistantName}. Ready to assist with your day.`,
      error: "I'm having trouble processing your request. Let's try again in a moment.",
      statusActive: 'Kairos is active',
      added: 'ADDED',
      accept: 'ACCEPT',
      capacity: (events: number, tasks: number) => `Capacity: ${events} Events, ${tasks} Tasks Today`,
      initializing: 'Initializing Secretary...',
      clearChat: 'Clear Conversation',
      clearConfirm: 'Clear this conversation? The context in memory will remain, but chat history will be deleted.'
    },
    settings: {
      title: 'Identity',
      userName: 'Your Name',
      assistantName: 'Assistant Name',
      save: 'Save Identity',
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
      title: 'Matrix',
      activeFor: 'Eisenhower Board',
      newTask: 'New Draft',
      cancel: 'Cancel',
      accept: 'Add to Board',
      analyzing: 'ANALYZING...',
      today: 'Today',
      tomorrow: 'Tomorrow',
      abandoned: 'Abandoned Plans',
      upcoming: 'Upcoming',
      completed: 'Completed',
      noTasks: 'Empty Quadrant',
      placeholder: 'What needs to be done?',
      postpone: 'Move to Tomorrow',
      abandon: 'Abandoned',
      categories: ['Work', 'Personal', 'Meeting', 'Finance'],
      routines: 'Daily Rituals',
      oneOffs: 'Specific Objectives',
      viewList: 'List View',
      viewKanban: 'Board View',
      colBacklog: 'Backlog',
      colToday: 'Today',
      colTomorrow: 'Tomorrow',
      colDone: 'Done',
      moveTo: 'Move priority',
      autoSchedule: {
        button: 'Schedule',
        finding: 'Finding slot...',
        success: 'Scheduled',
        fail: 'No time found'
      },
      menu: {
        manual: 'Manual Schedule',
        delete: 'Delete Draft',
        move: 'Change Priority'
      },
      priorities: {
        urgent: 'Do First (Urgent & Important)',
        high: 'Schedule (Important & Not Urgent)',
        normal: 'Delegate (Urgent & Not Important)',
        low: 'Eliminate (Not Urgent & Not Important)'
      },
      promote: {
        button: 'Schedule',
        modalTitle: 'Schedule Event',
        confirm: 'Add to Calendar'
      },
      kanban: {
        planning: 'Planning',
        todo: 'To Do',
        inProgress: 'In Progress',
        done: 'Done'
      },
      feedback: {
        success: "Excellent work.",
        strict: "Task finished. Efficiency is non-negotiable.",
        warm: [
          "I'm so proud of you!",
          "Beautifully handled, friend.",
          "You're shining today.",
          "One more win for us!",
          "I knew you had this."
        ],
        fail: "That's okay. Let's reset and try again."
      }
    },
    focus: {
      title: 'Focus',
      selectObjective: 'Select an objective',
      clearAgenda: 'Agenda clear.',
      intervalComplete: 'Interval Complete',
      takeBreath: "Take a breath.",
      markFinished: 'Finish',
      continue: 'Continue',
      currentIntention: 'Intention',
      commence: 'Start',
      pause: 'Pause'
    },
    modal: {
      calendarEvent: 'Calendar Event',
      agendaTask: 'Agenda Task',
      acknowledged: 'Acknowledged',
      update: 'Update',
      notes: 'Notes & Links',
      noNotes: 'No notes.',
      notesPlaceholder: 'Paste links or extra details here...',
      recurrence: 'Recurrence',
      startDate: 'Start Date',
      timeframe: 'Timeframe',
      category: 'Category',
      dayOfMonth: 'Day of Month',
      chooseDays: 'Choose Days',
      synced: 'SYNCED'
    },
    recurrence: {
      none: 'One-time',
      daily: 'Every Day',
      weekdays: 'Weekdays (M-F)',
      weekly: 'Weekly (Same Day)',
      specific_days: 'Specific Days of Week',
      monthly: 'Monthly (Same Date)',
      weeklyLabel: (days: string) => `Weekly on: ${days || 'No days selected'}`
    },
    privacy: {
      title: "Welcome to Kairos",
      description: "Kairos is designed to help you organize your life with kindness. To provide personalized assistance, we process your schedule and tasks locally and via secure AI services.",
      agreement: "By continuing, you acknowledge that you have read and agree to our ",
      policyLink: "Privacy Policy",
      accept: "I Agree & Continue"
    }
  },
  ru: {
    common: {
      syncing: 'Синхронизация...',
      syncedAt: 'Обновлено',
      syncNow: 'ОБНОВИТЬ',
      linkGoogle: 'Привязать Google',
      google: 'GOOGLE',
      disconnect: 'Отключить',
      update: 'Обновить',
      cancel: 'Отмена',
      save: 'Сохранить',
      delete: 'Удалить',
      edit: 'Редактировать',
      details: 'Подробнее',
      weekDays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
      shortWeekDays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
    },
    nav: {
      secretary: 'Секретарь',
      calendar: 'Календарь',
      tasks: 'Матрица',
      focus: 'Фокус',
      assistant: 'Личный помощник'
    },
    chat: {
      placeholder: 'Поделитесь планами...',
      thinking: 'Кайрос планирует...',
      refining: 'Уточняю детали...',
      updatingMemory: 'Обновляю контекст...',
      listening: 'Слушаю...',
      initialMsg: (userName: string, assistantName: string) => `Привет, ${userName}! Я ваш личный ${assistantName}. Готов помочь с делами.`,
      error: "Извините, возникла ошибка при обработке запроса. Попробуйте еще раз.",
      statusActive: 'Кайрос активен',
      added: 'В СПИСКЕ',
      accept: 'ПОДТВЕРДИТЬ',
      capacity: (events: number, tasks: number) => `Загрузка: Событий — ${events}, Задач — ${tasks}`,
      initializing: 'Запуск Секретаря...',
      clearChat: 'Очистить чат',
      clearConfirm: 'Очистить переписку? Контекст останется в памяти, но сообщения будут удалены.'
    },
    settings: {
      title: 'Личность',
      userName: 'Ваше имя',
      assistantName: 'Имя помощника',
      save: 'Сохранить',
    },
    calendar: {
      linkGoogle: 'Привязать Google',
      linked: 'Привязано',
      objectives: 'Цели',
      noPlans: 'Планов нет',
      quickAdd: 'Быстрое добавление',
      addSchedule: 'В график',
      event: 'Событие',
      task: 'Задача',
      eventTitle: 'Название?',
      taskDesc: 'Описание?'
    },
    tasks: {
      title: 'Матрица',
      activeFor: 'Эйзенхауэр',
      newTask: 'Новая идея',
      cancel: 'Отмена',
      accept: 'Добавить',
      analyzing: 'АНАЛИЗ...',
      today: 'Сегодня',
      tomorrow: 'Завтра',
      abandoned: 'Заброшено',
      upcoming: 'Предстоящие',
      completed: 'Завершено',
      noTasks: 'Квадрант пуст',
      placeholder: 'Что нужно сделать?',
      postpone: 'На завтра',
      abandon: 'Заброшено',
      categories: ['Работа', 'Личное', 'Встреча', 'Финансы'],
      routines: 'Ритуалы',
      oneOffs: 'Конкретные цели',
      viewList: 'Список',
      viewKanban: 'Доска',
      colBacklog: 'Бэклог',
      colToday: 'Сегодня',
      colTomorrow: 'Завтра',
      colDone: 'Готово',
      moveTo: 'Переместить...',
      autoSchedule: {
        button: 'В График',
        finding: 'Ищу время...',
        success: 'Запланировано',
        fail: 'Нет времени'
      },
      menu: {
        manual: 'Выбрать время',
        delete: 'Удалить',
        move: 'Сменить приоритет'
      },
      priorities: {
        urgent: 'Сделать (Важно и Срочно)',
        high: 'Планировать (Важно, не Срочно)',
        normal: 'Делегировать (Срочно, не Важно)',
        low: 'Удалить (Не Важно, не Срочно)'
      },
      promote: {
        button: 'В календарь',
        modalTitle: 'Назначить время',
        confirm: 'Создать событие'
      },
      kanban: {
        planning: 'План',
        todo: 'Сделать',
        inProgress: 'В процессе',
        done: 'Готово'
      },
      feedback: {
        success: "Отличная работа.",
        strict: "Задача выполнена. Эффективность превыше всего.",
        warm: [
          "Я так горжусь тобой!",
          "Прекрасно справились, друг.",
          "Сегодня вы сияете.",
          "Еще одна победа для нас!",
          "Ты справляешься отлично."
        ],
        fail: "Ничего страшного. Давайте попробуем снова."
      }
    },
    focus: {
      title: 'Фокус',
      selectObjective: 'Выберите цель',
      clearAgenda: 'Список пуст.',
      intervalComplete: 'Интервал завершен',
      takeBreath: 'Сделайте вдох.',
      markFinished: 'Завершить',
      continue: 'Продолжить',
      currentIntention: 'Намерение',
      commence: 'Начать',
      pause: 'Пауза'
    },
    modal: {
      calendarEvent: 'Событие',
      agendaTask: 'Задача',
      acknowledged: 'Принято',
      update: 'Обновить',
      notes: 'Заметки',
      noNotes: 'Заметок нет.',
      notesPlaceholder: 'Вставьте ссылки или детали...',
      recurrence: 'Повторение',
      startDate: 'Дата',
      timeframe: 'Время',
      category: 'Категория',
      dayOfMonth: 'День',
      chooseDays: 'Дни недели',
      synced: 'СИНХРОНИЗИРОВАНО'
    },
    recurrence: {
      none: 'Разово',
      daily: 'Каждый день',
      weekdays: 'Будни (Пн-Пт)',
      weekly: 'Еженедельно',
      specific_days: 'Выбранные дни',
      monthly: 'Ежемесячно',
      weeklyLabel: (days: string) => `Еженедельно: ${days || 'Дни не выбраны'}`
    },
    privacy: {
      title: "Добро пожаловать в Kairos",
      description: "Kairos создан, чтобы помочь вам организовать жизнь с заботой. Для предоставления персонализированной помощи мы обрабатываем ваш график и задачи локально и через защищенные AI-сервисы.",
      agreement: "Продолжая, вы подтверждаете, что ознакомились и согласны с нашей ",
      policyLink: "Политикой конфиденциальности",
      accept: "Принять и продолжить"
    }
  }
};

export const getT = (lang: Language) => translations[lang];