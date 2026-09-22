import React from 'react';
import { RateHistory } from '../../types';
import { Button } from '../ui/button';
import { X, History } from 'lucide-react';

interface RateHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: RateHistory[];
  testName?: string;
}

export const RateHistoryModal: React.FC<RateHistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  testName,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl bg-card p-6 shadow-2xl border max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-blue-600" />
            <h2 className="text-base font-bold text-foreground">Rate History: {testName}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-3 text-xs">
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground p-6">No previous rate modifications logged.</p>
          ) : (
            history.map((h, idx) => (
              <div key={idx} className="p-3 border rounded-xl bg-muted/20 space-y-1">
                <div className="flex items-center justify-between font-semibold">
                  <span>
                    Old Rate: ₹{h.previousRates?.rate} &rrarr; New Rate: ₹{h.newRates?.rate}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(h.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-muted-foreground">By: {h.changedBy?.name}</p>
                {h.reason && <p className="text-muted-foreground font-mono">Reason: {h.reason}</p>}
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-3 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

