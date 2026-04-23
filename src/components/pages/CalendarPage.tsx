import React from 'react';
import AppLayout from '../AppLayout';
import CalendarView from '../../views/CalendarView';

const CalendarPage: React.FC = () => (
  <AppLayout currentPath="/calendar">
    <CalendarView />
  </AppLayout>
);

export default CalendarPage;
