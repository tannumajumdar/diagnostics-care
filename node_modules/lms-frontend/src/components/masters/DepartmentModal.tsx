import React, { useState, useEffect } from 'react';
import { Department } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X } from 'lucide-react';

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  department?: Department | null;
}

export const DepartmentModal: React.FC<DepartmentModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  department,
}) => {
  const [departmentName, setDepartmentName] = useState('');
  const [departmentCode, setDepartmentCode] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (department) {
      setDepartmentName(department.departmentName);
      setDepartmentCode(department.departmentCode);
      setDescription(department.description || '');
    } else {
      setDepartmentName('');
      setDepartmentCode('');
      setDescription('');
    }
  }, [department, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ departmentName, departmentCode, description });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl border space-y-4">
        <div className="flex items-center justify-between pb-2 border-b">
          <h2 className="text-base font-bold text-foreground">
            {department ? 'Edit Department' : 'Create New Department'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold block mb-1">Department Name *</label>
            <Input
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              placeholder="e.g. Pathology, Biochemistry"
              required
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Department Code *</label>
            <Input
              value={departmentCode}
              onChange={(e) => setDepartmentCode(e.target.value.toUpperCase())}
              placeholder="e.g. PATH, BIO"
              required
            />
          </div>

          <div>
            <label className="font-semibold block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Department notes..."
              className="w-full p-2 border rounded-md bg-background text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default">
              {department ? 'Save Changes' : 'Create Department'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

