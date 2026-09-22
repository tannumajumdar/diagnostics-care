import React, { useState, useEffect } from 'react';
import { Doctor, Department } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X } from 'lucide-react';

interface DoctorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  doctor?: Doctor | null;
  departments: Department[];
}

export const DoctorModal: React.FC<DoctorModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  doctor,
  departments,
}) => {
  const [doctorName, setDoctorName] = useState('');
  const [department, setDepartment] = useState('');
  const [degree, setDegree] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [hospital, setHospital] = useState('');
  const [paymentTerm, setPaymentTerm] = useState('Monthly');
  const [discountPercentage, setDiscountPercentage] = useState(10);

  useEffect(() => {
    if (doctor) {
      setDoctorName(doctor.doctorName);
      setDepartment(typeof doctor.department === 'object' ? doctor.department.id : doctor.department);
      setDegree(doctor.degree || '');
      setSpecialty(doctor.specialty || '');
      setMobile(doctor.mobile);
      setEmail(doctor.email || '');
      setHospital(doctor.hospital || '');
      setPaymentTerm(doctor.paymentTerm || 'Monthly');
      setDiscountPercentage(doctor.discountPercentage || 10);
    } else {
      setDoctorName('');
      setDepartment(departments[0]?.id || '');
      setDegree('');
      setSpecialty('');
      setMobile('');
      setEmail('');
      setHospital('');
      setPaymentTerm('Monthly');
      setDiscountPercentage(10);
    }
  }, [doctor, isOpen, departments]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      doctorName,
      department,
      degree,
      specialty,
      mobile,
      email,
      hospital,
      paymentTerm,
      discountPercentage: Number(discountPercentage),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl border space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b">
          <h2 className="text-base font-bold text-foreground">
            {doctor ? 'Edit Doctor Profile' : 'Register Referring Doctor'}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-accent text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Doctor Name *</label>
              <Input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} required />
            </div>

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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Degree / Qualification</label>
              <Input value={degree} onChange={(e) => setDegree(e.target.value)} placeholder="e.g. MD, MBBS" />
            </div>
            <div>
              <label className="font-semibold block mb-1">Specialty</label>
              <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} placeholder="e.g. Pathology" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Mobile *</label>
              <Input value={mobile} onChange={(e) => setMobile(e.target.value)} required />
            </div>
            <div>
              <label className="font-semibold block mb-1">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1">Hospital / Clinic Name</label>
            <Input value={hospital} onChange={(e) => setHospital(e.target.value)} placeholder="Hospital affiliation" />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="default">
              {doctor ? 'Save Changes' : 'Register Doctor'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

