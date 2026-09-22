import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { hasPermission, type Permission } from '../../config/roles';

interface RoleGuardProps {
  /** Any one of these is enough to render the screen. */
  require: Permission[];
  children: React.ReactNode;
}

/**
 * Route-level permission gate. The sidebar already hides what a desk cannot
 * use, but a typed URL or a stale bookmark bypasses the menu entirely - this
 * catches that case and sends the user to the unauthorised screen rather than
 * letting the page mount and fail on a 403 from every query it fires.
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({ require, children }) => {
  const { user } = useAuth();

  if (!hasPermission(user, ...require)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

/** Inline variant for hiding a single button or panel. */
export const Can: React.FC<{ do: Permission[]; children: React.ReactNode; fallback?: React.ReactNode }> = ({
  do: required,
  children,
  fallback = null,
}) => {
  const { user } = useAuth();
  return <>{hasPermission(user, ...required) ? children : fallback}</>;
};

export default RoleGuard;
