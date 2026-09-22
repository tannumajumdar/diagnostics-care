import React from 'react';
import { Calendar } from 'lucide-react';

/**
 * A date box the desk can type into, day first.
 *
 * The native date input prints the month first on a machine set to US English,
 * so `03/12/2026` reads as March at the counter that meant the twelfth. This
 * one always shows and takes `dd/mm/yyyy`, and still hands the form the plain
 * `yyyy-mm-dd` the server stores. The calendar button opens the browser's own
 * picker for the people who would rather click than type.
 */

const toDisplay = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

/** `dd/mm/yyyy` back to `yyyy-mm-dd`, or '' while the date is not a real one. */
const toIso = (text: string): string => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return '';
  const [, dd, mm, yyyy] = m;
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  const date = new Date(year, month - 1, day);
  // 31/02 rolls over to March by itself, so check the date kept what it was given.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return '';
  return `${yyyy}-${mm}-${dd}`;
};

/** Slashes as the digits arrive, so nobody has to reach for the `/` key. */
const mask = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('/');
};

export interface DateInputProps {
  /** `yyyy-mm-dd`, the shape the form and the server both keep. */
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  min,
  max,
  error,
  disabled,
  className = '',
  placeholder = 'dd/mm/yyyy',
}) => {
  const [text, setText] = React.useState(() => toDisplay(value));
  const pickerRef = React.useRef<HTMLInputElement>(null);

  // The form owns the value: a reset or a record loaded into it has to show up
  // here. Half-typed text parses to '' and so does an empty value, which is why
  // this never snatches the box back while someone is still typing.
  React.useEffect(() => {
    if (toIso(text) !== value) setText(toDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleText = (raw: string) => {
    const next = mask(raw);
    setText(next);
    const iso = toIso(next);
    // An unfinished date leaves the form's value alone; clearing the box clears it.
    if (iso) onChange(iso);
    else if (next === '' && value) onChange('');
  };

  const openPicker = () => {
    const el = pickerRef.current;
    if (!el || disabled) return;
    try {
      if (typeof el.showPicker === 'function') el.showPicker();
      else el.click();
    } catch {
      el.click();
    }
  };

  return (
    <div className="w-full">
      <div className="relative">
        <input
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => handleText(e.target.value)}
          onBlur={() => setText(toDisplay(value))}
          placeholder={placeholder}
          disabled={disabled}
          className={`flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 pr-9 text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${
            error ? 'border-red-500 focus-visible:ring-red-500' : ''
          } ${className}`}
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          tabIndex={-1}
          aria-label="Open calendar"
          className="absolute right-0 top-0 flex h-10 w-9 items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <Calendar className="h-4 w-4" />
        </button>
        {/* The browser's picker, parked under the button. It stays in the layout
            because a display:none input has no picker to open. */}
        <input
          ref={pickerRef}
          type="date"
          value={value}
          min={min}
          max={max}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            setText(toDisplay(e.target.value));
            onChange(e.target.value);
          }}
          className="pointer-events-none absolute bottom-0 right-2 h-px w-px opacity-0"
        />
      </div>
      {error && <span className="text-[10px] text-red-500 mt-1 block font-medium">{error}</span>}
    </div>
  );
};
