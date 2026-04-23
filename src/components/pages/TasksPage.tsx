import React from 'react';
import AppLayout from '../AppLayout';
import TasksView from '../../views/TasksView';

const TasksPage: React.FC = () => (
  <AppLayout currentPath="/tasks">
    <TasksView />
  </AppLayout>
);

export default TasksPage;
