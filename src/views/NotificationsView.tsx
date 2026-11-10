import React from 'react';
import { NotificationsDashboard } from '../components/NotificationsDashboard';
import { CrewMember, Flight, Assignment, SystemUser } from '../types';

interface NotificationsViewProps {
  crew: CrewMember[];
  flights: Flight[];
  assignments: Assignment[];
  currentUser?: SystemUser;
  onLogAudit?: (action: string, details: string, severity?: 'INFO' | 'WARNING' | 'CRITICAL') => void;
  showToast?: (msg: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = (props) => {
  return <NotificationsDashboard {...props} />;
};

export default NotificationsView;
