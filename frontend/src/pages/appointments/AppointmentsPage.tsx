import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentApi, CreateAppointmentPayload } from '../../api/appointment.api';
import { testApi } from '../../api/test.api';
import { doctorApi } from '../../api/doctor.api';
import { patientApi } from '../../api/patient.api';
import { AppointmentRecord, AppointmentStatus, LabTest, Doctor, Patient } from '../../types';
import { asList } from '../../utils/api-list';
import { ageLabel } from '../../utils/age';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Calendar, Plus, Search, UserCheck, Home, Building2, Clock, History, UserPlus } from 'lucide-react';

export const AppointmentsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [collectionType, setCollectionType] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Appointment Form State
  /**
   * A booking is either for someone already on the register or for a first
   * visit. Defaulting to the register matters: most callers have been before,
   * and typing their name afresh creates a second record with a second UHID,
   * which splits their history across two files and loses the older reports.
   */
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientName, setPatientName] = useState('');
  const [mobile, setMobile] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('09:00 AM');
  const [type, setType] = useState<'Lab Visit' | 'Home Collection'>('Lab Visit');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', searchTerm, collectionType, statusFilter, page],
    queryFn: () =>
      appointmentApi.getAll({
        search: searchTerm,
        collectionType: collectionType || undefined,
        status: statusFilter || undefined,
        page,
        limit: 10,
      }),
  });

  const { data: testsData } = useQuery({
    queryKey: ['tests-appointment'],
    queryFn: () => testApi.getAll({ limit: 100, status: 'Active' }),
  });

  const { data: doctorsData } = useQuery({
    queryKey: ['doctors-appointment'],
    queryFn: () => doctorApi.getAll({ limit: 100, status: 'Active' }),
  });

  // Matched on the server by name, UHID or mobile, so a patient from two years
  // ago is found as easily as one from this morning - filtering a first page
  // of results in the browser would hide everyone past the first few.
  const { data: patientsData } = useQuery({
    queryKey: ['patients-appointment', patientSearch],
    queryFn: () => patientApi.getAll({ search: patientSearch || undefined, limit: 25 }),
    enabled: mode === 'existing',
  });

  const foundPatients = asList<Patient>(patientsData, 'patients');

  // Past bills and visits, so the desk can see at a glance that this really is
  // the returning patient they meant - and whether anything is still owed.
  const { data: patientHistory } = useQuery({
    queryKey: ['patient-appointment-history', selectedPatient?.id],
    queryFn: () => patientApi.getById(selectedPatient!.id),
    enabled: !!selectedPatient?.id,
  });

  const pastInvoices = asList<any>(patientHistory?.invoices ?? [], 'invoices');
  const outstandingDue = pastInvoices.reduce((sum: number, inv: any) => sum + (inv.dueAmount || 0), 0);

  const resetForm = () => {
    setMode('existing');
    setPatientSearch('');
    setSelectedPatient(null);
    setPatientName('');
    setMobile('');
    setSelectedDoctor('');
    setSelectedTests([]);
    setType('Lab Visit');
    setAddress('');
    setNotes('');
  };

  /**
   * Copies an existing record onto the form so nothing is typed twice.
   *
   * The referring doctor only carries over when that doctor is still active on
   * the list; a doctor who has since left would otherwise be posted as an id
   * the select cannot show, leaving the field looking empty while sending a
   * stale reference.
   */
  const applyPatient = (patient: Patient | null) => {
    setSelectedPatient(patient);
    if (!patient) return;

    setPatientName(patient.patientName ?? '');
    setMobile(patient.mobile ?? '');
    setAddress(patient.address ?? '');

    const doctorId =
      typeof patient.referringDoctor === 'string'
        ? patient.referringDoctor
        : patient.referringDoctor?.id;
    const activeDoctors = asList<Doctor>(doctorsData, 'doctors');
    setSelectedDoctor(doctorId && activeDoctors.some((d) => d.id === doctorId) ? doctorId : '');
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateAppointmentPayload) => appointmentApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setIsModalOpen(false);
      alert('Appointment scheduled successfully!');
      resetForm();
    },
    onError: (err: any) => alert(err?.response?.data?.message || 'Failed to schedule appointment'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      appointmentApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'existing' && !selectedPatient) {
      alert('Pick the patient from the register, or switch to "New patient".');
      return;
    }

    createMutation.mutate({
      // Linking the booking to the record is the whole point of choosing a
      // returning patient: it is what ties the visit to their UHID, and so to
      // their earlier bills, samples and reports.
      patientId: mode === 'existing' ? selectedPatient?.id : undefined,
      patientName,
      mobile,
      doctorId: selectedDoctor || '',
      testIds: selectedTests,
      date,
      time,
      collectionType: type,
      address,
      notes,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-blue-600" />
            <span>Appointment Scheduling</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Book patient diagnostic visits, schedule phlebotomy home collection slots, and track status.
          </p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          <span>Book Appointment</span>
        </Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search appointment #, patient name, UHID, mobile..."
              className="pl-9 text-xs"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-xs"
              value={collectionType}
              onChange={(e) => {
                setCollectionType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Collection Types</option>
              <option value="Lab Visit">Lab Visit</option>
              <option value="Home Collection">Home Collection</option>
            </select>

            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-xs"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Assigned">Assigned</option>
              <option value="On The Way">On The Way</option>
              <option value="Collected">Collected</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
              <tr>
                <th className="p-3">Appointment ID</th>
                <th className="p-3">Patient & Contact</th>
                <th className="p-3">Date & Time Slot</th>
                <th className="p-3">Type</th>
                <th className="p-3">Phlebotomist / Staff</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading appointments...
                  </td>
                </tr>
              ) : data?.appointments?.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No appointments found.
                  </td>
                </tr>
              ) : (data?.appointments?.length || 0) === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No appointments found.
                  </td>
                </tr>
              ) : (
                (data?.appointments || (Array.isArray(data) ? data : [])).map((apt: AppointmentRecord) => (
                  <tr key={apt._id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono font-bold text-blue-600">{apt.appointmentId}</td>
                    <td className="p-3">
                      <div className="font-bold text-foreground">{apt.patientName}</div>
                      <div className="text-[11px] text-muted-foreground">{apt.mobile}</div>
                      {apt.patient?.uhid ? (
                        <div className="font-mono text-[11px] font-bold text-blue-600">{apt.patient.uhid}</div>
                      ) : (
                        // Worth calling out: this booking is not tied to a
                        // record, so nothing here reaches the patient's history.
                        <div className="text-[11px] text-amber-600">Not linked to a patient record</div>
                      )}
                    </td>
                    <td className="p-3 font-mono">
                      <div>{new Date(apt.date).toLocaleDateString()}</div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {apt.time}
                      </div>
                    </td>
                    <td className="p-3">
                      <Badge variant={apt.collectionType === 'Home Collection' ? 'purple' : 'secondary'}>
                        {apt.collectionType === 'Home Collection' ? (
                          <Home className="h-3 w-3 mr-1" />
                        ) : (
                          <Building2 className="h-3 w-3 mr-1" />
                        )}
                        {apt.collectionType}
                      </Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {apt.phlebotomist?.name || 'Unassigned'}
                    </td>
                    <td className="p-3">
                      <Badge
                        variant={
                          apt.status === 'Completed'
                            ? 'success'
                            : apt.status === 'Cancelled'
                            ? 'destructive'
                            : 'amber'
                        }
                      >
                        {apt.status}
                      </Badge>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {apt.status === 'Pending' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ id: apt._id, status: 'Confirmed' })}
                        >
                          Confirm
                        </Button>
                      )}
                      {apt.status !== 'Completed' && apt.status !== 'Cancelled' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500"
                          onClick={() => updateStatusMutation.mutate({ id: apt._id, status: 'Cancelled' })}
                        >
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal for Booking New Appointment */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl border space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b">
              <h2 className="text-base font-bold text-foreground">Schedule Diagnostic Appointment</h2>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="flex overflow-hidden rounded-xl border text-xs">
                <button
                  type="button"
                  onClick={() => setMode('existing')}
                  className={`flex-1 px-3 py-2 font-semibold transition ${
                    mode === 'existing'
                      ? 'bg-blue-600 text-white'
                      : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  Returning patient
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('new');
                    setSelectedPatient(null);
                    setPatientName('');
                    setMobile('');
                    setAddress('');
                  }}
                  className={`flex-1 px-3 py-2 font-semibold transition ${
                    mode === 'new' ? 'bg-blue-600 text-white' : 'bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  New patient
                </button>
              </div>

              {mode === 'existing' ? (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={patientSearch}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPatientSearch(e.target.value)}
                      placeholder="Search by name, UHID or mobile"
                      className="pl-9"
                    />
                  </div>

                  <div>
                    <label className="font-semibold block mb-1">Patient *</label>
                    <select
                      value={selectedPatient?.id || ''}
                      onChange={(e) => applyPatient(foundPatients.find((p) => p.id === e.target.value) || null)}
                      className="w-full h-10 rounded-xl border bg-background px-3"
                    >
                      <option value="">Select the patient</option>
                      {foundPatients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.patientName} · {p.uhid} · {p.mobile}
                        </option>
                      ))}
                    </select>
                    {patientSearch && foundPatients.length === 0 && (
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        Nobody on the register matches "{patientSearch}".{' '}
                        <button
                          type="button"
                          onClick={() => setMode('new')}
                          className="font-semibold text-blue-600 hover:underline"
                        >
                          Book as a new patient
                        </button>
                      </p>
                    )}
                  </div>

                  {selectedPatient && (
                    <div className="space-y-2 rounded-xl border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-bold">{selectedPatient.patientName}</p>
                          <p className="text-[12px] text-muted-foreground">
                            {ageLabel(selectedPatient)} · {selectedPatient.gender} · {selectedPatient.mobile}
                          </p>
                          <p className="font-mono text-[12px] font-bold text-blue-600">{selectedPatient.uhid}</p>
                        </div>
                        <Link
                          to={`/patients/${selectedPatient.id}/history`}
                          className="flex items-center gap-1 font-semibold text-blue-600 hover:underline"
                        >
                          <History className="h-3 w-3" /> Full history
                        </Link>
                      </div>

                      {selectedPatient.address && (
                        <p className="text-[12px] text-muted-foreground">
                          {[selectedPatient.address, selectedPatient.city, selectedPatient.state, selectedPatient.pinCode]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}

                      {pastInvoices.length > 0 && (
                        <p className="text-[12px] text-muted-foreground">
                          {pastInvoices.length} previous visit{pastInvoices.length === 1 ? '' : 's'}
                          {outstandingDue > 0 && (
                            <span className="ml-1 font-bold text-red-600">· ₹{outstandingDue} still due</span>
                          )}
                        </p>
                      )}

                      <p className="text-[12px] text-muted-foreground">
                        Details filled in from the register. Anything changed below applies to this booking only —
                        to correct the record itself,{' '}
                        <Link to={`/patients/${selectedPatient.id}`} className="font-semibold text-blue-600 hover:underline">
                          edit the patient
                        </Link>
                        .
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="flex items-center gap-1 text-[12px] text-muted-foreground">
                  <UserPlus className="h-3 w-3" /> A UHID is issued when this patient is registered at billing.
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Patient Name *</label>
                  <Input value={patientName} onChange={(e) => setPatientName(e.target.value)} required />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Mobile Number *</label>
                  <Input value={mobile} onChange={(e) => setMobile(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Appointment Type *</label>
                  <select
                    value={type}
                    onChange={(e: any) => setType(e.target.value)}
                    className="w-full h-10 rounded-xl border bg-background px-3"
                  >
                    <option value="Lab Visit">Lab Visit</option>
                    <option value="Home Collection">Home Collection</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold block mb-1">Referring Doctor</label>
                  <select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    className="w-full h-10 rounded-xl border bg-background px-3"
                  >
                    <option value="">Self Walk-in</option>
                    {(doctorsData?.doctors || (Array.isArray(doctorsData) ? doctorsData : [])).map((d: Doctor) => (
                      <option key={d.id} value={d.id}>
                        {d.doctorName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold block mb-1">Date *</label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Time Slot *</label>
                  <Input value={time} onChange={(e) => setTime(e.target.value)} placeholder="09:30 AM" required />
                </div>
              </div>

              {type === 'Home Collection' && (
                <div>
                  <label className="font-semibold block mb-1">Collection Address *</label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full home address" required />
                </div>
              )}

              <div>
                <label className="font-semibold block mb-1">Notes / Instructions</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Fasting required" />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => { setIsModalOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  Schedule Appointment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

