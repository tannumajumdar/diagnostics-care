import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { patientApi } from '../../api/patient.api';
import { Patient } from '../../types';
import { asList } from '../../utils/api-list';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { ageLabel } from '../../utils/age';
import { Search, X, Check, Loader2 } from 'lucide-react';

/**
 * Finding a patient who is already on the register.
 *
 * The counter used to do this in two controls: a box to type into, and a
 * dropdown underneath to then open and pick from. That is two motions for one
 * question, and with a queue at the desk the second one gets missed - the
 * receptionist types a name, sees nothing happen, and concludes the patient is
 * not registered. The matches belong under the box they were typed into.
 *
 * The register is searched on the server, so a patient is found however long
 * it grows; the first page is shown before anything is typed, which is what a
 * receptionist wants when the patient in front of them registered this morning.
 */

export interface PatientSearchSelectProps {
  value: Patient | null;
  onChange: (patient: Patient | null) => void;
  placeholder?: string;
  /** Rendered red when the form has complained this field is required. */
  invalid?: boolean;
  autoFocus?: boolean;
}

/** `Ramesh Kumar · UHID00123 · 98xxxxxx01` - how the desk reads a patient out. */
const describe = (patient: Patient) =>
  [patient.patientName, patient.uhid, patient.mobile].filter(Boolean).join(' · ');

export const PatientSearchSelect: React.FC<PatientSearchSelectProps> = ({
  value,
  onChange,
  placeholder = 'Search by name, UHID or mobile',
  invalid = false,
  autoFocus = false,
}) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Held still while the receptionist is still typing, so a six-letter name
  // is one request rather than six arriving out of order.
  const debounced = useDebouncedValue(query, 250);

  const { data, isFetching } = useQuery({
    queryKey: ['patient-search', debounced],
    queryFn: () => patientApi.getAll({ search: debounced || undefined, limit: 25 }),
    // Only while the list is on screen - the search is of no use closed.
    enabled: open,
    placeholderData: (prev: any) => prev,
  });

  const results = useMemo(() => asList<Patient>(data, 'patients'), [data]);

  // A fresh set of matches invalidates whichever row was highlighted.
  useEffect(() => setHighlight(0), [debounced, open]);

  // A patient chosen from outside this box - the desk arrived from a profile
  // link carrying ?patientId= - has to read back inside it, or the search
  // looks empty while a bill is quietly being raised against somebody.
  useEffect(() => {
    if (value) setQuery(describe(value));
  }, [value]);

  // Clicking anywhere else is the desk moving on, so the list gets out of the
  // way rather than covering the form beneath it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  // Keeps the keyboard-highlighted row in view when the list is longer than
  // the box - arrowing past the bottom edge otherwise highlights nothing.
  useEffect(() => {
    listRef.current?.children[highlight]?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  const choose = (patient: Patient) => {
    onChange(patient);
    setQuery(describe(patient));
    setOpen(false);
    inputRef.current?.blur();
  };

  const clear = () => {
    onChange(null);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return setOpen(true);
      if (!results.length) return;
      setHighlight((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
        return (next + results.length) % results.length;
      });
      return;
    }
    if (event.key === 'Enter' && open && results[highlight]) {
      // The picker is used inside forms that submit on Enter, so a keyboard
      // selection must not also fire the submit behind it.
      event.preventDefault();
      choose(results[highlight]);
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />

      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        autoFocus={autoFocus}
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          // Typing over a chosen patient means the desk is picking somebody
          // else - leaving the old one selected would bill the wrong person.
          if (value) onChange(null);
        }}
        onFocus={(e) => {
          setOpen(true);
          e.target.select();
        }}
        onKeyDown={onKeyDown}
        className={`h-10 w-full rounded-xl border bg-background pl-9 pr-16 text-xs outline-none transition placeholder:text-muted-foreground focus:ring-4 focus:ring-blue-500/10 ${
          invalid ? 'border-red-400 focus:border-red-500' : 'border-input focus:border-blue-500'
        }`}
      />

      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        {value && <Check className="h-4 w-4 text-emerald-600" />}
        {(value || query) && (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear the selected patient"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border bg-popover shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted-foreground">
              {isFetching
                ? 'Searching the register…'
                : query
                ? `No registered patient matches "${query}".`
                : 'No patients on the register yet.'}
            </p>
          ) : (
            <ul ref={listRef} role="listbox" className="max-h-72 overflow-y-auto py-1">
              {results.map((patient, index) => (
                <li key={patient.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === highlight}
                    // Fires before the input's blur, so the click is not lost
                    // to the list closing underneath the pointer.
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setHighlight(index)}
                    onClick={() => choose(patient)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition ${
                      index === highlight ? 'bg-blue-50 text-blue-900' : 'hover:bg-muted/60'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{patient.patientName}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {ageLabel(patient)} · {patient.gender} · {patient.mobile}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{patient.uhid}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
