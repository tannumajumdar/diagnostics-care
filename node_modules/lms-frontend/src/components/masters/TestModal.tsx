import React, { useState, useEffect } from 'react';
import { LabTest, Department, ProcessingMode } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X } from 'lucide-react';

interface TestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  test?: LabTest | null;
  departments: Department[];
}

export const TestModal: React.FC<TestModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  test,
  departments,
}) => {
  const [testName, setTestName] = useState('');
  const [testCode, setTestCode] = useState('');
  const [department, setDepartment] = useState('');
  const [rate, setRate] = useState(500);
  // What the referring doctor's own copy prints, and where the work is done.
  const [referralRate, setReferralRate] = useState(500);
  const [processingMode, setProcessingMode] = useState<ProcessingMode>('In-house');
  const [outsourceLab, setOutsourceLab] = useState('');
  const [outsourceCost, setOutsourceCost] = useState(0);

  useEffect(() => {
    if (test) {
      setTestName(test.testName);
      setTestCode(test.testCode);
      setDepartment(typeof test.department === 'object' ? test.department.id : test.department);
      setRate(test.rate || 500);
      // A test saved before referral rates existed reads back at its own
      // rate, so the doctor's copy is never shown below what the centre
      // itself charges.
      setReferralRate(Number(test.referralRate) || Number(test.rate) || 0);
      setProcessingMode(test.processingMode === 'Outsource' ? 'Outsource' : 'In-house');
      setOutsourceLab(test.outsourceLab || '');
      setOutsourceCost(Number(test.outsourceCost) || 0);
    } else {
      setTestName('');
      setTestCode('');
      setDepartment(departments[0]?.id || '');
      setRate(500);
      setReferralRate(500);
      setProcessingMode('In-house');
      setOutsourceLab('');
      setOutsourceCost(0);
    }
  }, [test, isOpen, departments]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      testName,
      testCode,
      department,
      rate: Number(rate),
      referralRate: Number(referralRate) || 0,
      processingMode,
      // A test run at the bench carries no courier address, so switching it
      // back cannot leave a stale lab name printing on the sample slip.
      outsourceLab: processingMode === 'Outsource' ? outsourceLab.trim() : '',
      outsourceCost: processingMode === 'Outsource' ? Number(outsourceCost) || 0 : 0,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-3xl rounded-2xl bg-card p-6 shadow-2xl border space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b">
          <h2 className="text-base font-bold text-foreground">
            {test ? 'Edit Lab Test' : 'Add New Lab Test Catalog'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Test Name *</label>
              <Input value={testName} onChange={(e) => setTestName(e.target.value)} required />
            </div>
            <div>
              <label className="font-semibold block mb-1">Test Code *</label>
              <Input value={testCode} onChange={(e) => setTestCode(e.target.value.toUpperCase())} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Department *</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full h-10 rounded-xl border px-3 text-xs bg-background"
                required
              >
                <option value="">Select Dept</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.departmentName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Standard Rate (₹) *</label>
              <Input type="number" min={0} value={rate} onChange={(e) => setRate(Number(e.target.value))} required />
              {!test && (
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  Corporate, doctor and emergency rates start here - tune them under Rates.
                </span>
              )}
            </div>
          </div>

          {/* The referring doctor's own copy is a separate bill at a separate
              price - higher than the centre's, the difference being what the
              doctor keeps. Nothing here touches what the patient pays. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Referring Doctor&rsquo;s Rate (₹)</label>
              <Input
                type="number"
                min={0}
                value={referralRate}
                onChange={(e) => setReferralRate(Number(e.target.value))}
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {Number(referralRate) > Number(rate) ? (
                  <span className="font-semibold text-emerald-600">
                    ₹{Number(referralRate) - Number(rate)} above the standard rate - printed on the
                    doctor&rsquo;s bill only.
                  </span>
                ) : Number(referralRate) < Number(rate) ? (
                  <span className="font-semibold text-amber-600">
                    Below the standard rate - the doctor&rsquo;s bill would print under what the centre charges.
                  </span>
                ) : (
                  'Same as the standard rate. Mark it up and the difference is the doctor’s cut.'
                )}
              </span>
            </div>

            <div>
              <label className="font-semibold block mb-1">Processing *</label>
              <div className="flex overflow-hidden rounded-xl border">
                {(['In-house', 'Outsource'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setProcessingMode(mode)}
                    className={`flex-1 px-3 py-2 text-xs font-semibold transition ${
                      processingMode === mode
                        ? mode === 'Outsource'
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-600 text-white'
                        : 'bg-background text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {processingMode === 'Outsource'
                  ? 'Sample is couriered out. The desk can still flip a single bill back.'
                  : 'Run at the centre’s own bench.'}
              </span>
            </div>
          </div>

          {processingMode === 'Outsource' && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <div>
                <label className="font-semibold block mb-1">Outsourced To</label>
                <Input
                  value={outsourceLab}
                  onChange={(e) => setOutsourceLab(e.target.value)}
                  placeholder="e.g. Metropolis Reference Lab"
                />
              </div>
              <div>
                <label className="font-semibold block mb-1">Their Charge to Us (₹)</label>
                <Input
                  type="number"
                  min={0}
                  value={outsourceCost}
                  onChange={(e) => setOutsourceCost(Number(e.target.value))}
                />
                <span className="mt-1 block text-[11px] text-muted-foreground">
                  {Number(outsourceCost) > 0
                    ? `Margin on this test: ₹${Number(rate) - Number(outsourceCost)}`
                    : 'What the outside lab bills the centre for this test.'}
                </span>
              </div>
            </div>
          )}

          {/* Parameters have their own window (Edit Parameter at the top of the test list),
              laid out like the lab's desktop screen with one row per band. A
              new test left without them gets a standard sheet from its name. */}
          <p className="rounded-xl border bg-muted/20 p-3 text-[11px] text-muted-foreground">
            {test
              ? 'Parameters and their ranges are edited from Edit Parameter at the top of the test list.'
              : 'A standard parameter sheet is built from the test name - edit it afterwards from Edit Parameter.'}
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default">
              {test ? 'Save Changes' : 'Create Test'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
