import React, { useState, useEffect } from 'react';
import { LabTest, TestParameter } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X, Plus, Trash2 } from 'lucide-react';

interface TestParametersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (parameters: TestParameter[]) => Promise<void>;
  test: LabTest | null;
}

export const TestParametersModal: React.FC<TestParametersModalProps> = ({
  isOpen,
  onClose,
  onSave,
  test,
}) => {
  const [parameters, setParameters] = useState<TestParameter[]>([]);

  useEffect(() => {
    if (test && test.parameters) {
      setParameters(test.parameters);
    } else {
      setParameters([]);
    }
  }, [test, isOpen]);

  if (!isOpen || !test) return null;

  const handleAddParam = () => {
    setParameters((prev) => [
      ...prev,
      {
        parameterName: '',
        shortName: '',
        unit: '',
        maleReferenceRange: '',
        femaleReferenceRange: '',
        childReferenceRange: '',
        method: '',
        resultType: 'Numeric',
        displayOrder: prev.length + 1,
      },
    ]);
  };

  const handleRemoveParam = (index: number) => {
    setParameters((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleChange = (index: number, field: keyof TestParameter, value: any) => {
    const updated = [...parameters];
    updated[index] = { ...updated[index], [field]: value };
    setParameters(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(parameters);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-4xl rounded-2xl bg-card p-6 shadow-2xl border max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b">
          <div>
            <h2 className="text-base font-bold text-foreground">
              Configure Test Parameters: {test.testName}
            </h2>
            <p className="text-xs text-muted-foreground font-mono">Test Code: {test.testCode}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-4 space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-muted-foreground">
              Parameter Definitions stored in MongoDB ({parameters.length})
            </span>
            <Button type="button" variant="outline" size="sm" onClick={handleAddParam}>
              <Plus className="h-4 w-4 mr-1" /> Add Parameter
            </Button>
          </div>

          <div className="space-y-3">
            {parameters.map((param, idx) => (
              <div key={idx} className="p-3 border rounded-xl bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold font-mono text-blue-600">Parameter #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveParam(idx)}
                    className="text-red-500 hover:text-red-700 p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">Parameter Name *</label>
                    <Input
                      value={param.parameterName}
                      onChange={(e) => handleChange(idx, 'parameterName', e.target.value)}
                      placeholder="e.g. Hemoglobin"
                      required
                      className="h-8 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">Result Type</label>
                    <select
                      value={param.resultType}
                      onChange={(e) => handleChange(idx, 'resultType', e.target.value)}
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
                    <label className="text-[11px] font-semibold text-muted-foreground">Unit</label>
                    <Input
                      value={param.unit || ''}
                      onChange={(e) => handleChange(idx, 'unit', e.target.value)}
                      placeholder="e.g. g/dL"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">Method</label>
                    <Input
                      value={param.method || ''}
                      onChange={(e) => handleChange(idx, 'method', e.target.value)}
                      placeholder="Methodology"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">Male Reference Range</label>
                    <Input
                      value={param.maleReferenceRange || ''}
                      onChange={(e) => handleChange(idx, 'maleReferenceRange', e.target.value)}
                      placeholder="e.g. 13.5 - 17.5"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">Female Reference Range</label>
                    <Input
                      value={param.femaleReferenceRange || ''}
                      onChange={(e) => handleChange(idx, 'femaleReferenceRange', e.target.value)}
                      placeholder="e.g. 12.0 - 15.5"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground">Child Reference Range</label>
                    <Input
                      value={param.childReferenceRange || ''}
                      onChange={(e) => handleChange(idx, 'childReferenceRange', e.target.value)}
                      placeholder="e.g. 11.0 - 14.0"
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default">
              Save Parameters
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

