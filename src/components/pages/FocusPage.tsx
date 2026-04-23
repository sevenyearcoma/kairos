import React from 'react';
import AppLayout from '../AppLayout';
import FocusView from '../../views/FocusView';

const FocusPage: React.FC = () => (
  <AppLayout currentPath="/focus">
    <FocusView />
  </AppLayout>
);

export default FocusPage;
