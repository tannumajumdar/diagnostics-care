import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { patientApi } from '../../api/patient.api';
import { doctorApi } from '../../api/doctor.api';
import { organizationApi } from '../../api/organization.api';
import { useToast } from '../../context/ToastContext';
import { asList } from '../../utils/api-list';
import { yearsSince, ageYmdLabel, ageDaysLabel } from '../../utils/age';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { DateInput } from '../../components/ui/date-input';
import { Button } from '../../components/ui/button';
import { ArrowLeft, UserPlus, Save } from 'lucide-react';

const selectClass =
  'flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const Field: React.FC<{ label: string; required?: boolean; error?: string; children: React.ReactNode }> = ({
  label,
  required,
  error,
  children,
}) => (
  <div>
    <label className="font-semibold block mb-1 text-xs">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error && <span className="text-[11px] text-red-500 mt-1 block font-medium">{error}</span>}
  </div>
);

export const PatientFormPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    patientName: '',
    gender: '',
    age: '',
    mobile: '',
    dateOfBirth: '',
    emergencyContact: '',
    address: '',
    city: '',
    state: '',
    pinCode: '',
    referringDoctor: '',
    organization: '',
  });

  const { data: doctorsData } = useQuery({ queryKey: ['doctors'], queryFn: () => doctorApi.getAll() });
  const { data: orgsData } = useQuery({ queryKey: ['organizations'], queryFn: () => organizationApi.getAll() });

  const doctors = asList(doctorsData, 'doctors');
  const organizations = asList(orgsData, 'organizations');

  const set = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  /**
   * A date of birth is the exact answer, so it fills the age in and keeps it
   * filled. Patients who only know roughly how old they are still get the
   * plain age box.
   */
  const setDateOfBirth = (value: string) => {
    const years = yearsSince(value);
    setForm((prev) => ({ ...prev, dateOfBirth: value, age: years === null ? prev.age : String(years) }));
    setErrors((prev) => ({ ...prev, dateOfBirth: '', ...(years === null ? {} : { age: '' }) }));
  };

  // Mirrors createPatientSchema on the backend so failures surface inline
  // rather than as a generic 400.
  const validate = () => {
    const next: Record<string, string> = {};
    if (form.patientName.trim().length < 2) next.patientName = 'Patient name is required';
    if (!form.gender) next.gender = 'Gender is required';
    if (form.age === '' || Number.isNaN(Number(form.age)) || Number(form.age) < 0) {
      next.age = 'Enter a valid age';
    }
    if (form.mobile.trim().length < 10) next.mobile = 'Valid 10-digit mobile is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    try {
      const payload: Record<string, any> = {
        patientName: form.patientName.trim(),
        gender: form.gender,
        age: Number(form.age),
        mobile: form.mobile.trim(),
      };

      // Send optional fields only when filled - the backend defaults the rest.
      const optional = [
        'dateOfBirth',
        'emergencyContact',
        'address',
        'city',
        'state',
        'pinCode',
        'referringDoctor',
        'organization',
      ] as const;
      optional.forEach((key) => {
        const value = form[key].trim();
        if (value) payload[key] = value;
      });

      const created = await patientApi.create(payload);
      showToast('Patient registered successfully', 'success');

      const newId = created?.id || created?.patient?.id;
      navigate(newId ? `/patients/${newId}` : '/patients');
    } catch (err: any) {
      showToast(err?.message || 'Failed to register patient', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => navigate('/patients')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-blue-600" />
            <span>Register New Patient</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            A unique UHID is generated automatically once the record is saved.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-bold">Patient Details</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Patient Name" required>
              <Input
                value={form.patientName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('patientName', e.target.value)}
                placeholder="Full name"
                error={errors.patientName}
              />
            </Field>

            <Field label="Gender" required error={errors.gender}>
              <select className={selectClass} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Male Child">Male Child</option>
                <option value="Female Child">Female Child</option>
                <option value="Other">Other</option>
              </select>
            </Field>

            <Field label="Age" required>
              {/* With a date of birth on the form the age is a fact, not a guess,
                  so it is read out both ways: years, months and days first -
                  that is who is standing at the counter - and the running day
                  count beside it, which is what separates two children born
                  months apart. The whole years still go to the server. */}
              {form.dateOfBirth ? (
                <>
                  <div className="flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-muted/40 px-3">
                    <span className="text-xs font-semibold">{ageYmdLabel(form)}</span>
                    <span className="shrink-0 rounded-full bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {ageDaysLabel(form)}
                    </span>
                  </div>
                  <span className="mt-1 block text-[11px] text-muted-foreground">
                    From the date of birth. Clear the date to type an age.
                  </span>
                </>
              ) : (
                <Input
                  type="number"
                  min={0}
                  value={form.age}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('age', e.target.value)}
                  placeholder="Years"
                  error={errors.age}
                />
              )}
            </Field>

            <Field label="Mobile Number" required>
              <Input
                value={form.mobile}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('mobile', e.target.value)}
                placeholder="10-digit mobile"
                error={errors.mobile}
              />
            </Field>

            <Field label="Date of Birth">
              <DateInput
                max={new Date().toISOString().slice(0, 10)}
                value={form.dateOfBirth}
                onChange={setDateOfBirth}
              />
              <span className="mt-1 block text-[11px] text-muted-foreground">
                Fills the age in by itself, in years, months and days.
              </span>
            </Field>

            <Field label="Emergency Contact">
              <Input
                value={form.emergencyContact}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('emergencyContact', e.target.value)}
                placeholder="Alternate number"
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-bold">Address</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-4">
              <Field label="Street Address">
                <Input
                  value={form.address}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('address', e.target.value)}
                  placeholder="House / street / locality"
                />
              </Field>
            </div>
            <Field label="City">
              <Input
                value={form.city}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('city', e.target.value)}
              />
            </Field>
            <Field label="State">
              <Input
                value={form.state}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('state', e.target.value)}
              />
            </Field>
            <Field label="PIN Code">
              <Input
                value={form.pinCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('pinCode', e.target.value)}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b">
            <CardTitle className="text-sm font-bold">Referral &amp; Billing</CardTitle>
          </CardHeader>
          <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Referring Doctor">
              <select
                className={selectClass}
                value={form.referringDoctor}
                onChange={(e) => set('referringDoctor', e.target.value)}
              >
                <option value="">Walk-in / self referral</option>
                {doctors.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.hospital ? `${d.doctorName} - ${d.hospital}` : d.doctorName}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Organization / TPA">
              <select
                className={selectClass}
                value={form.organization}
                onChange={(e) => set('organization', e.target.value)}
              >
                <option value="">None (direct patient)</option>
                {organizations.map((o: any) => (
                  <option key={o.id} value={o.id}>
                    {o.organizationName}
                  </option>
                ))}
              </select>
            </Field>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => navigate('/patients')}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSaving} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Save className="h-4 w-4" />
            <span>Register Patient</span>
          </Button>
        </div>
      </form>
    </div>
  );
};
