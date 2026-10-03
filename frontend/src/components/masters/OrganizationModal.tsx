import React, { useEffect, useState } from 'react';
import { Organization, ContractRate, OrgPaymentTerm } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { X } from 'lucide-react';

interface OrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  organization?: Organization | null;
}

const CONTRACT_RATES: ContractRate[] = ['Corporate', 'Standard', 'Discounted'];
const PAYMENT_TERMS: OrgPaymentTerm[] = ['Immediate', 'Net 15', 'Net 30', 'Net 45', 'Net 60'];

const empty = {
  organizationName: '',
  contactPerson: '',
  mobile: '',
  email: '',
  address: '',
  city: '',
  state: '',
  gstNumber: '',
  contractRate: 'Corporate' as ContractRate,
  discount: '0',
  creditLimit: '0',
  paymentTerms: 'Net 30' as OrgPaymentTerm,
};

const selectClass = 'w-full h-10 rounded-xl border px-3 text-xs bg-background';

/** A corporate client or insurance TPA: who to call, what rate they get, how much credit. */
export const OrganizationModal: React.FC<OrganizationModalProps> = ({ isOpen, onClose, onSubmit, organization }) => {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setForm(
      organization
        ? {
            organizationName: organization.organizationName,
            contactPerson: organization.contactPerson,
            mobile: organization.mobile,
            email: organization.email ?? '',
            address: organization.address ?? '',
            city: organization.city ?? '',
            state: organization.state ?? '',
            gstNumber: organization.gstNumber ?? '',
            contractRate: organization.contractRate ?? 'Corporate',
            discount: String(organization.discount ?? 0),
            creditLimit: String(organization.creditLimit ?? 0),
            paymentTerms: organization.paymentTerms ?? 'Net 30',
          }
        : empty
    );
  }, [organization, isOpen]);

  if (!isOpen) return null;

  const set = (key: keyof typeof empty, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  // Mirrors createOrganizationSchema so mistakes show beside the box.
  const validate = () => {
    const next: Record<string, string> = {};
    if (form.organizationName.trim().length < 2) next.organizationName = 'Enter the TPA / organization name';
    if (form.contactPerson.trim().length < 2) next.contactPerson = 'Enter a contact person';
    if (form.mobile.replace(/\D/g, '').length < 10) next.mobile = 'Enter a 10-digit mobile number';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = 'Enter a valid email';
    if (form.gstNumber.trim() && !/^[0-9]{2}[A-Z0-9]{13}$/.test(form.gstNumber.trim())) {
      next.gstNumber = 'GSTIN must be 15 characters, like 22ABCDE1234F1Z5';
    }
    const discount = Number(form.discount);
    if (form.discount === '' || Number.isNaN(discount) || discount < 0 || discount > 100) next.discount = 'Between 0 and 100';
    const credit = Number(form.creditLimit);
    if (form.creditLimit === '' || Number.isNaN(credit) || credit < 0) next.creditLimit = 'Cannot be negative';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSubmit({
        organizationName: form.organizationName.trim(),
        contactPerson: form.contactPerson.trim(),
        mobile: form.mobile.trim(),
        email: form.email.trim().toLowerCase(),
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim(),
        gstNumber: form.gstNumber.trim().toUpperCase(),
        contractRate: form.contractRate,
        discount: Number(form.discount),
        creditLimit: Number(form.creditLimit),
        paymentTerms: form.paymentTerms,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl border space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-2 border-b">
          <h2 className="text-base font-bold text-foreground">
            {organization ? 'Edit TPA / Organization' : 'Add TPA / Organization'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-accent text-muted-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs" noValidate>
          <div>
            <label className="font-semibold block mb-1">TPA / Organization Name *</label>
            <Input
              value={form.organizationName}
              onChange={(e) => set('organizationName', e.target.value)}
              placeholder="e.g. Medi Assist TPA, ABC Corporate"
              error={errors.organizationName}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Contact Person *</label>
              <Input value={form.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} error={errors.contactPerson} />
            </div>
            <div>
              <label className="font-semibold block mb-1">Mobile *</label>
              <Input
                value={form.mobile}
                inputMode="numeric"
                onChange={(e) => set('mobile', e.target.value.replace(/[^\d+]/g, '').slice(0, 13))}
                placeholder="10-digit mobile"
                error={errors.mobile}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Email</label>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} />
            </div>
            <div>
              <label className="font-semibold block mb-1">GSTIN</label>
              <Input
                value={form.gstNumber}
                onChange={(e) => set('gstNumber', e.target.value.replace(/\s/g, '').toUpperCase().slice(0, 15))}
                placeholder="22ABCDE1234F1Z5"
                className="font-mono"
                error={errors.gstNumber}
              />
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1">Address</label>
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Office address" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">City</label>
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div>
              <label className="font-semibold block mb-1">State</label>
              <Input value={form.state} onChange={(e) => set('state', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t pt-3">
            <div>
              <label className="font-semibold block mb-1">Contract Rate</label>
              <select value={form.contractRate} onChange={(e) => set('contractRate', e.target.value)} className={selectClass}>
                {CONTRACT_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="font-semibold block mb-1">Discount (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={form.discount}
                onChange={(e) => set('discount', e.target.value)}
                error={errors.discount}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold block mb-1">Credit Limit (₹)</label>
              <Input
                type="number"
                min={0}
                value={form.creditLimit}
                onChange={(e) => set('creditLimit', e.target.value)}
                error={errors.creditLimit}
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Payment Terms</label>
              <select value={form.paymentTerms} onChange={(e) => set('paymentTerms', e.target.value)} className={selectClass}>
                {PAYMENT_TERMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving}>
              {organization ? 'Save Changes' : 'Add TPA'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
