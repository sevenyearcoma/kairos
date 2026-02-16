
import { Event, Task } from '../types';

export function isItemOnDate(item: Event | Task, targetDateStr: string): boolean {
  // If explicitly set to this date
  if (item.date === targetDateStr) return true;
  
  // If no recurrence, only the original date counts
  if (!item.recurrence || item.recurrence === 'none') return false;

  const itemDate = new Date(item.date + 'T00:00:00');
  const targetDate = new Date(targetDateStr + 'T00:00:00');
  
  // Cannot occur before the start date
  if (targetDate < itemDate) return false;

  if (item.recurrence === 'daily') return true;
  
  if (item.recurrence === 'weekdays') {
    const day = targetDate.getDay();
    return day >= 1 && day <= 5; // Monday to Friday
  }

  if (item.recurrence === 'weekly') {
    // Check if it's the same day of the week
    return itemDate.getDay() === targetDate.getDay();
  }

  if (item.recurrence === 'specific_days' && item.daysOfWeek) {
    return item.daysOfWeek.includes(targetDate.getDay());
  }
  
  if (item.recurrence === 'monthly') {
    // Check if it's the same day of the month
    // If original day was 31 and current month has 30, it might need complex logic,
    // but standard behavior is match the numeric day.
    const targetDay = targetDate.getDate();
    const itemDay = item.dayOfMonth || itemDate.getDate();
    return targetDay === itemDay;
  }
  
  return false;
}
