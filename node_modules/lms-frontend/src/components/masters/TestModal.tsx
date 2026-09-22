import React, { useState, useEffect } from 'react';
import { LabTest, Department, TestParameter, ProcessingMode } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X, Plus, Trash2 } from 'lucide-react';

interface TestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  test?: LabTest | null;
  departments: Department[];
}

const blankParameter = (order: number): TestParameter => ({
  parameterName: '',
  shortName: '',
  unit: '',
  maleReferenceRange: '',
  femaleReferenceRange: '',
  childReferenceRange: '',
  method: '',
  resultType: 'Numeric',
  displayOrder: order,
});

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
  const [parameters, setParameters] = useState<TestParameter[]>([]);

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
      setParameters(Array.isArray(test.parameters) ? test.parameters.map((p) => ({ ...p })) : []);
    } else {
      setTestName('');
      setTestCode('');
      setDepartment(departments[0]?.id || '');
      setRate(500);
      setReferralRate(500);
      setProcessingMode('In-house');
      setOutsourceLab('');
      setOutsourceCost(0);
      setParameters([]);
    }
  }, [test, isOpen, departments]);

  if (!isOpen) return null;

  const addParameter = () => {
    setParameters((prev) => [...prev, blankParameter(prev.length + 1)]);
  };

  const removeParameter = (index: number) => {
    setParameters((prev) =>
      prev.filter((_, idx) => idx !== index).map((p, idx) => ({ ...p, displayOrder: idx + 1 }))
    );
  };

  const changeParameter = (index: number, field: keyof TestParameter, value: any) => {
    setParameters((prev) => prev.map((p, idx) => (idx === index ? { ...p, [field]: value } : p)));
  };

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
      // Rows left completely blank are ones someone added and then thought
      // better of - they would print as an empty line on the report.
      parameters: parameters
        .filter((p) => String(p.parameterName || '').trim())
        .map((p, idx) => ({ ...p, displayOrder: idx + 1 })),
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
                <span className="mt-1 block text-[10px] text-muted-foreground">
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
              <span className="mt-1 block text-[10px] text-muted-foreground">
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
              <span className="mt-1 block text-[10px] text-muted-foreground">
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
                <span className="mt-1 block text-[10px] text-muted-foreground">
                  {Number(outsourceCost) > 0
                    ? `Margin on this test: ₹${Number(rate) - Number(outsourceCost)}`
                    : 'What the outside lab bills the centre for this test.'}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="font-semibold block">Test Parameters ({parameters.length})</span>
                <span className="text-[10px] text-muted-foreground">
                  {parameters.length === 0 && !test
                    ? 'Leave this empty and a standard sheet is built from the test name - editable any time.'
                    : 'What result entry asks for, and what the report prints.'}
                </span>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={addParameter}>
                <Plus className="h-4 w-4 mr-1" /> Add Parameter
              </Button>
            </div>

            {parameters.map((param, idx) => (
              <div key={idx} className="p-3 border rounded-xl bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-blue-600">Parameter #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeParameter(idx)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Remove parameter"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Parameter Name *</label>
                    <Input
                      value={param.parameterName}
                      onChange={(e) => changeParameter(idx, 'parameterName', e.target.value)}
                      placeholder="e.g. Hemoglobin"
                      required
                      className="h-8 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Result Type</label>
                    <select
                      value={param.resultType}
                      onChange={(e) => changeParameter(idx, 'resultType', e.target.value)}
                      className="w-full h-8 rounded-lg border bg-background px-2 text-xs"
                    >
                      <option value="Numeric">Numeric</option>
                      <option value="Text">Text</option>
                      <option value="Dropdown">Dropdown</option>
                      <option value="Positive/Negative">Positive/Negative</option>
                      <option value="Reactive/Non-Reactive">Reactive/Non-Reactive</option>
                      <option value="Normal/Abnormal">Normal/Abnormal</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Unit</label>
                    <Input
                      value={param.unit || ''}
                      onChange={(e) => changeParameter(idx, 'unit', e.target.value)}
                      placeholder="e.g. g/dL"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Method</label>
                    <Input
                      value={param.method || ''}
                      onChange={(e) => changeParameter(idx, 'method', e.target.value)}
                      placeholder="Methodology"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Male Reference Range</label>
                    <Input
                      value={param.maleReferenceRange || ''}
                      onChange={(e) => changeParameter(idx, 'maleReferenceRange', e.target.value)}
                      placeholder="e.g. 13.5 - 17.5"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Female Reference Range</label>
                    <Input
                      value={param.femaleReferenceRange || ''}
                      onChange={(e) => changeParameter(idx, 'femaleReferenceRange', e.target.value)}
                      placeholder="e.g. 12.0 - 15.5"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground">Child Reference Range</label>
                    <Input
                      value={param.childReferenceRange || ''}
                      onChange={(e) => changeParameter(idx, 'childReferenceRange', e.target.value)}
                      placeholder="e.g. 11.0 - 14.0"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

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
