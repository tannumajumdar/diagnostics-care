import React, { useEffect, useState } from 'react';
import { LabTest, RateSet } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X } from 'lucide-react';

interface UpdateRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (rates: any, reason?: string) => Promise<void>;
  onSave?: (ratesData: RateSet & { reason?: string }) => Promise<void>;
  test: LabTest | null;
}

export const UpdateRatesModal: React.FC<UpdateRatesModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onSave,
  test,
}) => {
  const [rate, setRate] = useState(test?.rate || 0);
  // The doctor's own copy prints this one, and it is meant to sit above the
  // centre's rate - the difference is what the referring doctor keeps.
  const [referralRate, setReferralRate] = useState(
    Number(test?.referralRate) || Number(test?.rate) || 0
  );
  const [reason, setReason] = useState('');

  // The modal is mounted once and reused for every test, so without this the
  // second test the admin opens is shown the first one's rates.
  useEffect(() => {
    setRate(Number(test?.rate) || 0);
    setReferralRate(Number(test?.referralRate) || Number(test?.rate) || 0);
    setReason('');
  }, [test, isOpen]);

  if (!isOpen || !test) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      rate: Number(rate),
      patientRate: Number(rate),
      corporateRate: Number(rate),
      doctorRate: Number(rate),
      emergencyRate: Number(rate),
      referralRate: Number(referralRate),
      reason,
    };

    if (onSave) {
      onSave(payload);
    } else if (onSubmit) {
      onSubmit({ rate: Number(rate), referralRate: Number(referralRate) }, reason);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl border space-y-4">
        <div className="flex items-center justify-between pb-2 border-b">
          <h2 className="text-base font-bold text-foreground">Update Rate for {test.testName}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">New Standard Rate ($)</label>
            <Input type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} required />
          </div>

          <div>
            <label className="font-semibold block mb-1">Referring Doctor&rsquo;s Rate (₹)</label>
            <Input
              type="number"
              min={0}
              value={referralRate}
              onChange={(e) => setReferralRate(Number(e.target.value))}
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              {Number(referralRate) > Number(rate)
                ? `₹${Number(referralRate) - Number(rate)} above the standard rate - printed on the doctor's bill only.`
                : Number(referralRate) < Number(rate)
                ? "Below the standard rate - the doctor's bill would print under what the centre charges."
                : 'Same as the standard rate. Mark it up and the difference is the doctor’s cut.'}
            </span>
          </div>

          <div>
            <label className="font-semibold block mb-1">Reason for Adjustment</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual revision" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default">
              Update Rate
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

