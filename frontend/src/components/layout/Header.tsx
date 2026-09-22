import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/button';
import { LogOut, User as UserIcon, Bell } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-14 border-b bg-card px-6 flex items-center justify-between text-xs">
      <div className="flex items-center gap-2 font-semibold text-muted-foreground">
        <span>Laboratory Operational System</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 border-r pr-4">
          <div className="h-7 w-7 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center font-bold">
            <UserIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="font-bold text-foreground leading-tight">{user?.name || 'User'}</p>
            <p className="text-[10px] text-blue-600 font-mono leading-tight">{user?.role || 'Staff'}</p>
          </div>
        </div>

        <Button variant="ghost" size="sm" onClick={logout} className="gap-1.5 text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" />
          <span>Logout</span>
        </Button>
      </div>
    </header>
  );
};

