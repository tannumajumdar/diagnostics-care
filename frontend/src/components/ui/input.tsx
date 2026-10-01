import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  /** Classes for the wrapping div - full width unless a row needs it narrower. */
  wrapperClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', type, error, wrapperClassName = 'w-full', ...props }, ref) => {
    return (
      <div className={wrapperClassName}>
        <input
          type={type}
          className={`flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs ring-offset-background file:border-0 file:bg-transparent file:text-xs file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? 'border-red-500 focus-visible:ring-red-500' : ''
          } ${className}`}
          ref={ref}
          {...props}
        />
        {error && <span className="text-[11px] text-red-500 mt-1 block font-medium">{error}</span>}
      </div>
    );
  }
);
Input.displayName = 'Input';

