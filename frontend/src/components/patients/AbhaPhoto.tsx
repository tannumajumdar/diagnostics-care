import React from 'react';
import { UserRound, X } from 'lucide-react';

/**
 * The photo from a verified ABHA, passport-sized, so the desk can check it
 * is the person at the counter. With onRemove it can be taken off the form.
 */
export const AbhaPhoto: React.FC<{
  photo?: string;
  name?: string;
  size?: 'sm' | 'md';
  onRemove?: () => void;
}> = ({ photo, name, size = 'md', onRemove }) => {
  const box = size === 'sm' ? 'h-14 w-12' : 'h-24 w-20';
  if (!photo) {
    return (
      <div className={`${box} flex shrink-0 items-center justify-center rounded-xl border bg-muted text-muted-foreground`}>
        <UserRound className="h-6 w-6" />
      </div>
    );
  }
  return (
    <div className={`relative ${box} shrink-0`}>
      <img src={photo} alt={name ? `${name} - photo` : 'Patient photo'} className="h-full w-full rounded-xl border object-cover" />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove photo"
          className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 text-muted-foreground shadow hover:text-red-600"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};
