
import { Language } from './types';

export const translations = {
  en: {
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
      listening: 'Listening...',
      initialMsg: (userName: string, assistantName: string) => `Hello, ${userName}! I'm your personal ${assistantName}. Ready to assist with your day.`,
      error: "I'm having trouble processing your request. Let's try again in a moment.",
      statusActive: 'Kairos is active',
      added: 'ADDED',
      accept: 'ACCEPT'
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
        button: 'Auto Schedule',
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
      recurrence: 'Recurrence',
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
      tasks: 'Матрица',
      focus: 'Фокус',
      assistant: 'Личный помощник'
    },
    chat: {
      placeholder: 'Поделитесь планами...',
      thinking: 'Кайрос планирует...',
      refining: 'Уточняю детали...',
      listening: 'Слушаю...',
      initialMsg: (userName: string, assistantName: string) => `Привет, ${userName}! Я ваш личный ${assistantName}. Готов помочь с делами.`,
      error: "Извините, возникла ошибка при обработке запроса. Попробуйте еще раз.",
      statusActive: 'Кайрос активен',
      added: 'В СПИСКЕ',
      accept: 'ПОДТВЕРДИТЬ'
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
        button: 'Авто-подбор',
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
          "I знал, что у вас получится."
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
      recurrence: 'Повторение',
      startDate: 'Дата',
      timeframe: 'Время',
      category: 'Категория',
      dayOfMonth: 'День',
      chooseDays: 'Дни недели'
    }
  }
};

export const getT = (lang: Language) => translations[lang];