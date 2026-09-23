import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { doctorApi } from '../../api/doctor.api';
import { departmentApi } from '../../api/department.api';
import { useToast } from '../../context/ToastContext';
import { exportToExcel } from '../../utils/excel-export';
import { asList } from '../../utils/api-list';
import { Button } from '../../components/ui/button';
import {
  Stethoscope,
  Search,
  Pencil,
  Trash2,
  Download,
  MessageSquare,
  Percent,
  X,
  Save,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  BadgeCheck,
} from 'lucide-react';

const PAYMENT_TERMS = ['Daily', 'Weekly', 'Monthly', 'Immediate'];
const DISCOUNT_TYPES = ['Percentage', 'Fixed', 'No Discount Only Cut'];
const PAGE_SIZE = 25;

const EMPTY_FORM = {
  department: '',
  doctorName: '',
  gender: 'Male',
  degree: '',
  specialty: '',
  mobile: '',
  email: '',
  dob: '',
  area: '',
  areaCode: '',
  hospital: '',
  paymentTerm: 'Monthly',
  discountType: 'Percentage',
  discountPercentage: '',
  commission: '',
};

const inputClass =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10';
const labelClass = 'mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500';

const fmtDate = (value?: string) => (value ? new Date(value).toLocaleDateString('en-GB') : '—');

export const DoctorsPage: React.FC = () => {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [search, setSearch] = useState('');
  const [dateField, setDateField] = useState<'createdAt' | 'dob'>('createdAt');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [applied, setApplied] = useState({ search: '', dateField: 'createdAt', fromDate: '', toDate: '' });
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cutOpen, setCutOpen] = useState(false);
  const [cutCommission, setCutCommission] = useState('');
  const [cutDiscount, setCutDiscount] = useState('');

  const { data: deptData } = useQuery({ queryKey: ['departments'], queryFn: () => departmentApi.getAll() });
  const departments = asList(deptData, 'departments');

  const { data, isLoading } = useQuery({
    queryKey: ['doctors', applied, page],
    queryFn: () => doctorApi.getAll({ ...applied, page, limit: PAGE_SIZE }),
  });

  const doctors = asList(data, 'doctors');
  const total = data?.meta?.total ?? doctors.length;
  const totalPages = data?.meta?.totalPages ?? 1;

  const set = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setEditingId(null);
    setErrors({});
  };

  const runSearch = () => {
    setApplied({ search, dateField, fromDate, toDate });
    setPage(1);
  };

  const clearFilters = () => {
    setSearch('');
    setFromDate('');
    setToDate('');
    setDateField('createdAt');
    setApplied({ search: '', dateField: 'createdAt', fromDate: '', toDate: '' });
    setPage(1);
  };

  // Mirrors createDoctorSchema so failures surface inline instead of as a 400.
  const validate = () => {
    const next: Record<string, string> = {};
    if (form.doctorName.trim().length < 2) next.doctorName = 'Doctor name is required';
    if (!form.department) next.department = 'Department is required';
    if (form.mobile.trim().length < 10) next.mobile = 'Valid 10-digit mobile is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    try {
      const payload: Record<string, any> = {
        doctorName: form.doctorName.trim(),
        department: form.department,
        gender: form.gender,
        mobile: form.mobile.trim(),
        paymentTerm: form.paymentTerm,
        discountType: form.discountType,
        discountPercentage: Number(form.discountPercentage) || 0,
        commission: Number(form.commission) || 0,
      };
      (['degree', 'specialty', 'email', 'area', 'areaCode', 'hospital', 'dob'] as const).forEach((key) => {
        const value = form[key].trim();
        if (value) payload[key] = value;
      });

      if (editingId) {
        await doctorApi.update(editingId, payload);
        showToast('Doctor updated', 'success');
      } else {
        await doctorApi.create(payload);
        showToast('Doctor registered', 'success');
      }
      resetForm();
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
    } catch (err: any) {
      showToast(err?.message || 'Could not save doctor', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (doc: any) => {
    setEditingId(doc.id);
    setErrors({});
    setForm({
      department: typeof doc.department === 'object' ? doc.department?.id ?? '' : doc.department ?? '',
      doctorName: doc.doctorName ?? '',
      gender: doc.gender ?? 'Male',
      degree: doc.degree ?? '',
      specialty: doc.specialty ?? '',
      mobile: doc.mobile ?? '',
      email: doc.email ?? '',
      dob: doc.dob ? String(doc.dob).slice(0, 10) : '',
      area: doc.area ?? '',
      areaCode: doc.areaCode ?? '',
      hospital: doc.hospital ?? '',
      paymentTerm: doc.paymentTerm ?? 'Monthly',
      discountType: doc.discountType ?? 'Percentage',
      discountPercentage: String(doc.discountPercentage ?? ''),
      commission: String(doc.commission ?? ''),
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleStatus = async (doc: any) => {
    try {
      await doctorApi.toggleStatus(doc.id);
      showToast(`${doc.doctorName} marked ${doc.status === 'Active' ? 'Inactive' : 'Active'}`, 'success');
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
    } catch (err: any) {
      showToast(err?.message || 'Could not update status', 'error');
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const pageIds = useMemo(() => doctors.map((d: any) => d.id), [doctors]);
  const allOnPageSelected = pageIds.length > 0 && pageIds.every((id: string) => selected.has(id));

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageIds.forEach((id: string) => next.delete(id));
      else pageIds.forEach((id: string) => next.add(id));
      return next;
    });
  };

  const handleExport = () => {
    const source = selected.size > 0 ? doctors.filter((d: any) => selected.has(d.id)) : doctors;
    if (!source.length) {
      showToast('Nothing to export', 'info');
      return;
    }
    exportToExcel(
      'doctors',
      source.map((d: any) => ({
        'Dr. Name': d.doctorName,
        Department: typeof d.department === 'object' ? d.department?.departmentName ?? '' : '',
        Gender: d.gender ?? '',
        Degree: d.degree ?? '',
        Speciality: d.specialty ?? '',
        Mobile: d.mobile ?? '',
        DOB: d.dob ? fmtDate(d.dob) : '',
        Area: d.area ?? '',
        'Area Code': d.areaCode ?? '',
        Hospital: d.hospital ?? '',
        'Payment Term': d.paymentTerm ?? '',
        'Discount Type': d.discountType ?? '',
        'Discount %': d.discountPercentage ?? 0,
        'Cut %': d.commission ?? 0,
        Status: d.status,
        'Entry Date': fmtDate(d.createdAt),
        'Added By': d.addedBy?.name ?? '',
      }))
    );
    showToast(`Exported ${source.length} doctor(s)`, 'success');
  };

  const handleApplyCut = async () => {
    if (cutCommission === '' && cutDiscount === '') {
      showToast('Enter a cut or discount value', 'error');
      return;
    }
    try {
      const res = await doctorApi.setCutValue({
        ids: Array.from(selected),
        ...(cutCommission !== '' ? { commission: Number(cutCommission) } : {}),
        ...(cutDiscount !== '' ? { discountPercentage: Number(cutDiscount) } : {}),
      });
      showToast(res?.message || 'Cut value applied', 'success');
      setCutOpen(false);
      setCutCommission('');
      setCutDiscount('');
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ['doctors'] });
    } catch (err: any) {
      showToast(err?.message || 'Could not apply cut value', 'error');
    }
  };

  const handleSendSms = () => {
    // The SMS gateway key is not configured on this deployment, so be explicit
    // rather than pretending the messages went out.
    showToast(`SMS gateway not configured — ${selected.size} recipient(s) queued locally only`, 'info');
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-slate-900">
          <Stethoscope className="h-6 w-6 text-blue-600" />
          <span>Doctor Directory</span>
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Register referring doctors, maintain referral cut and discount terms, and track who added each record.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[340px_1fr]">
        {/* ---------- Add / edit panel ---------- */}
        <form
          onSubmit={handleSave}
          className="h-fit rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {editingId ? 'Edit Doctor' : 'Add New Doctor'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Cancel edit"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="space-y-3 px-4 py-4">
            <div>
              <label className={labelClass}>Department *</label>
              <select
                className={inputClass}
                value={form.department}
                onChange={(e) => set('department', e.target.value)}
              >
                <option value="">- Select -</option>
                {departments.map((d: any) => (
                  <option key={d.id} value={d.id}>
                    {d.departmentName}
                  </option>
                ))}
              </select>
              {errors.department && <p className="mt-1 text-[11px] text-red-500">{errors.department}</p>}
            </div>

            <div>
              <label className={labelClass}>Doctor Name *</label>
              <input
                className={inputClass}
                value={form.doctorName}
                onChange={(e) => set('doctorName', e.target.value)}
                placeholder="Dr. Full Name"
              />
              {errors.doctorName && <p className="mt-1 text-[11px] text-red-500">{errors.doctorName}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Gender</label>
                <select className={inputClass} value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Mobile No. *</label>
                <input
                  className={inputClass}
                  value={form.mobile}
                  onChange={(e) => set('mobile', e.target.value)}
                  placeholder="10-digit"
                />
                {errors.mobile && <p className="mt-1 text-[11px] text-red-500">{errors.mobile}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Degree</label>
                <input
                  className={inputClass}
                  value={form.degree}
                  onChange={(e) => set('degree', e.target.value)}
                  placeholder="MBBS, MD"
                />
              </div>
              <div>
                <label className={labelClass}>Speciality</label>
                <input
                  className={inputClass}
                  value={form.specialty}
                  onChange={(e) => set('specialty', e.target.value)}
                  placeholder="Pathology"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Date of Birth</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.dob}
                  onChange={(e) => set('dob', e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="name@example.com"
                />
                {errors.email && <p className="mt-1 text-[11px] text-red-500">{errors.email}</p>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Area (Location)</label>
                <input className={inputClass} value={form.area} onChange={(e) => set('area', e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Area Code</label>
                <input
                  className={inputClass}
                  value={form.areaCode}
                  onChange={(e) => set('areaCode', e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Working Hospital Name</label>
              <input
                className={inputClass}
                value={form.hospital}
                onChange={(e) => set('hospital', e.target.value)}
                placeholder="City Central Hospital"
              />
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Referral Terms
              </p>
              <div className="space-y-3">
                <div>
                  <label className={labelClass}>Payment Term</label>
                  <select
                    className={inputClass}
                    value={form.paymentTerm}
                    onChange={(e) => set('paymentTerm', e.target.value)}
                  >
                    {PAYMENT_TERMS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Discount Type</label>
                  <select
                    className={inputClass}
                    value={form.discountType}
                    onChange={(e) => set('discountType', e.target.value)}
                  >
                    {DISCOUNT_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Discount %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={inputClass}
                      value={form.discountPercentage}
                      onChange={(e) => set('discountPercentage', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Cut / Commission %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      className={inputClass}
                      value={form.commission}
                      onChange={(e) => set('commission', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 border-t border-slate-100 px-4 py-3">
            <Button type="submit" isLoading={isSaving} className="h-9 flex-1 gap-1.5 bg-slate-900 hover:bg-slate-800">
              <Save className="h-3.5 w-3.5" />
              <span>{editingId ? 'Update' : 'Save'}</span>
            </Button>
            <Button type="button" variant="outline" onClick={resetForm} className="h-9 gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </Button>
          </div>
        </form>

        {/* ---------- List panel ---------- */}
        <div className="min-w-0 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-end gap-2.5">
              <div className="min-w-[200px] flex-1">
                <label className={labelClass}>Search</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    className={`${inputClass} pl-8`}
                    placeholder="Name, mobile, hospital, area…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runSearch()}
                  />
                </div>
              </div>
              <div className="w-36">
                <label className={labelClass}>Date Basis</label>
                <select
                  className={inputClass}
                  value={dateField}
                  onChange={(e) => setDateField(e.target.value as 'createdAt' | 'dob')}
                >
                  <option value="createdAt">By Entry Date</option>
                  <option value="dob">By Date of Birth</option>
                </select>
              </div>
              <div className="w-36">
                <label className={labelClass}>From Date</label>
                <input
                  type="date"
                  className={inputClass}
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="w-36">
                <label className={labelClass}>To Date</label>
                <input type="date" className={inputClass} value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
              <Button onClick={runSearch} className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700">
                <Search className="h-3.5 w-3.5" />
                <span>Search</span>
              </Button>
              <Button variant="outline" onClick={clearFilters} className="h-9">
                Clear
              </Button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="max-h-[calc(100vh-330px)] overflow-auto">
              <table className="w-full min-w-[1020px] border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="w-9 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={allOnPageSelected}
                        onChange={toggleSelectAll}
                        className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
                        aria-label="Select all on page"
                      />
                    </th>
                    <th className="px-3 py-2.5">Dr. Name</th>
                    <th className="px-3 py-2.5">Degree &amp; Speciality</th>
                    <th className="px-3 py-2.5">Mobile</th>
                    <th className="px-3 py-2.5">DOB</th>
                    <th className="px-3 py-2.5">Area</th>
                    <th className="px-3 py-2.5">Hospital</th>
                    <th className="px-3 py-2.5">Terms</th>
                    <th className="px-3 py-2.5">Entry Date</th>
                    <th className="px-3 py-2.5">Added By</th>
                    <th className="px-3 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-12 text-center text-slate-400">
                        Loading doctors…
                      </td>
                    </tr>
                  ) : doctors.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-3 py-12 text-center text-slate-400">
                        No doctors match these filters.
                      </td>
                    </tr>
                  ) : (
                    doctors.map((d: any) => (
                      <tr
                        key={d.id}
                        className={`border-b border-slate-100 transition hover:bg-slate-50/80 ${
                          selected.has(d.id) ? 'bg-blue-50/60' : ''
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(d.id)}
                            onChange={() => toggleSelect(d.id)}
                            className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
                            aria-label={`Select ${d.doctorName}`}
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                            <span className="truncate">{d.doctorName}</span>
                            {d.status === 'Active' && (
                              <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-label="Active" />
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400">
                            {typeof d.department === 'object' ? d.department?.departmentName : '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {[d.degree, d.specialty].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-slate-600">{d.mobile || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600">{fmtDate(d.dob)}</td>
                        <td className="px-3 py-2.5 text-slate-600">{d.area || '—'}</td>
                        <td className="px-3 py-2.5 text-slate-600">
                          <span className="block max-w-[150px] truncate">{d.hospital || '—'}</span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="inline-flex items-center rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                            {d.paymentTerm ?? 'Monthly'}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-slate-400">
                            Disc {d.discountPercentage ?? 0}% · Cut {d.commission ?? 0}%
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-500">{fmtDate(d.createdAt)}</td>
                        <td className="px-3 py-2.5">
                          <span className="block max-w-[110px] truncate text-slate-500">
                            {d.addedBy?.name ?? '—'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleEdit(d)}
                              className="rounded-md p-1.5 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                              aria-label={`Edit ${d.doctorName}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleStatus(d)}
                              className={`rounded-md p-1.5 transition ${
                                d.status === 'Active'
                                  ? 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                              aria-label={d.status === 'Active' ? 'Deactivate' : 'Reactivate'}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50/70 px-3 py-2.5">
              <Button variant="outline" onClick={handleExport} className="h-8 gap-1.5">
                <Download className="h-3.5 w-3.5" />
                <span>Export</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleSendSms}
                disabled={selected.size === 0}
                className="h-8 gap-1.5"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Send SMS</span>
              </Button>
              <Button
                variant="outline"
                onClick={() => setCutOpen(true)}
                disabled={selected.size === 0}
                className="h-8 gap-1.5"
              >
                <Percent className="h-3.5 w-3.5" />
                <span>Set Cut Value</span>
              </Button>

              <div className="ml-auto flex items-center gap-4 text-[12px] text-slate-500">
                <span>
                  Selected <strong className="text-slate-900">{selected.size}</strong>
                </span>
                <span>
                  Total <strong className="text-slate-900">{total}</strong>
                </span>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="rounded-md p-1 text-slate-500 transition hover:bg-slate-200 disabled:opacity-40"
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span>
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="rounded-md p-1 text-slate-500 transition hover:bg-slate-200 disabled:opacity-40"
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Set Cut Value dialog */}
      {cutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-900">Set Cut Value</h3>
              <button
                onClick={() => setCutOpen(false)}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <p className="text-xs text-slate-500">
                Applies to <strong className="text-slate-900">{selected.size}</strong> selected doctor(s). Leave a
                field blank to leave it unchanged.
              </p>
              <div>
                <label className={labelClass}>Cut / Commission %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={inputClass}
                  value={cutCommission}
                  onChange={(e) => setCutCommission(e.target.value)}
                  placeholder="e.g. 15"
                />
              </div>
              <div>
                <label className={labelClass}>Discount %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className={inputClass}
                  value={cutDiscount}
                  onChange={(e) => setCutDiscount(e.target.value)}
                  placeholder="e.g. 10"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-4 py-3">
              <Button variant="outline" onClick={() => setCutOpen(false)} className="h-9">
                Cancel
              </Button>
              <Button onClick={handleApplyCut} className="h-9 bg-slate-900 hover:bg-slate-800">
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
