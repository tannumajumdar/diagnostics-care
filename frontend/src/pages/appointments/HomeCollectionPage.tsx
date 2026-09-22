import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { appointmentApi } from '../../api/appointment.api';
import { userApi } from '../../api/user.api';
import { AppointmentRecord, AppointmentStatus, User } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { asList } from '../../utils/api-list';
import { Home, UserCheck, Navigation, CheckCircle2, ArrowRight } from 'lucide-react';

export const HomeCollectionPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentRecord | null>(null);
  const [phlebotomistId, setPhlebotomistId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['home-collections'],
    queryFn: () => appointmentApi.getAll({ collectionType: 'Home Collection', limit: 50 }),
  });

  // A dedicated endpoint: the front desk assigns draws without being able to
  // read the whole staff register. The list arrives already filtered to
  // active collection staff.
  const { data: usersData } = useQuery({
    queryKey: ['collectors'],
    queryFn: () => userApi.getCollectors(),
  });

  const phlebotomists = asList<User>(usersData, 'users');

  const assignMutation = useMutation({
    mutationFn: ({ id, user }: { id: string; user: { userId: string; name: string } }) =>
      appointmentApi.assignPhlebotomist(id, user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-collections'] });
      setSelectedAppointment(null);
      alert('Phlebotomist assigned successfully!');
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      appointmentApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['home-collections'] });
    },
  });

  const handleAssignSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment || !phlebotomistId) return;
    const targetUser = phlebotomists.find((u: User) => u.id === phlebotomistId);
    if (!targetUser) return;

    assignMutation.mutate({
      id: selectedAppointment._id,
      user: { userId: targetUser.id, name: targetUser.name },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Home className="h-6 w-6 text-purple-600" />
          <span>Home Collection Phlebotomy Queue</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Field phlebotomist assignment & live sample collection workflow progression.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
        <Card className="p-3 bg-blue-50/50 border-blue-200">
          <p className="text-muted-foreground font-semibold">1. Assigned</p>
          <p className="text-xs text-muted-foreground">Phlebotomist designated for home visit.</p>
        </Card>
        <Card className="p-3 bg-purple-50/50 border-purple-200">
          <p className="text-muted-foreground font-semibold">2. On The Way</p>
          <p className="text-xs text-muted-foreground">Phlebotomist dispatched to patient address.</p>
        </Card>
        <Card className="p-3 bg-amber-50/50 border-amber-200">
          <p className="text-muted-foreground font-semibold">3. Collected</p>
          <p className="text-xs text-muted-foreground">Sample drawn & sealed in specimen container.</p>
        </Card>
        <Card className="p-3 bg-emerald-50/50 border-emerald-200">
          <p className="text-muted-foreground font-semibold">4. Submitted</p>
          <p className="text-xs text-muted-foreground">Specimen delivered to central laboratory.</p>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Home Collection Appointments Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 font-semibold border-b">
              <tr>
                <th className="p-3">Appointment ID</th>
                <th className="p-3">Patient & Contact</th>
                <th className="p-3">Collection Address</th>
                <th className="p-3">Date & Slot</th>
                <th className="p-3">Assigned Phlebotomist</th>
                <th className="p-3">Workflow Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y border-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading home collection queue...
                  </td>
                </tr>
              ) : (data?.appointments?.length || 0) === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    No home collection bookings registered.
                  </td>
                </tr>
              ) : (
                (data?.appointments || (Array.isArray(data) ? data : [])).map((apt: AppointmentRecord) => (
                  <tr key={apt._id} className="hover:bg-muted/30">
                    <td className="p-3 font-mono font-bold text-blue-600">{apt.appointmentId}</td>
                    <td className="p-3">
                      <div className="font-bold">{apt.patientName}</div>
                      <div className="text-[10px] text-muted-foreground">{apt.mobile}</div>
                    </td>
                    <td className="p-3 text-muted-foreground max-w-xs truncate">{apt.address || 'N/A'}</td>
                    <td className="p-3 font-mono">
                      {new Date(apt.date).toLocaleDateString()} @ {apt.time}
                    </td>
                    <td className="p-3">
                      {apt.phlebotomist?.name ? (
                        <Badge variant="secondary">{apt.phlebotomist.name}</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedAppointment(apt)}
                          className="h-7 text-[11px]"
                        >
                          <UserCheck className="h-3 w-3 mr-1" /> Assign Staff
                        </Button>
                      )}
                    </td>
                    <td className="p-3">
                      <Badge variant="purple">{apt.status}</Badge>
                    </td>
                    <td className="p-3 text-right space-x-1">
                      {apt.status === 'Assigned' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ id: apt._id, status: 'On The Way' })}
                        >
                          <Navigation className="h-3 w-3 mr-1" /> Dispatched
                        </Button>
                      )}
                      {apt.status === 'On The Way' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatusMutation.mutate({ id: apt._id, status: 'Collected' })}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" /> Collected
                        </Button>
                      )}
                      {apt.status === 'Collected' && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => updateStatusMutation.mutate({ id: apt._id, status: 'Submitted' })}
                        >
                          <ArrowRight className="h-3 w-3 mr-1" /> Submit to Lab
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Assign Phlebotomist Modal */}
      {selectedAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-card p-6 shadow-2xl border space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
              <h2 className="text-base font-bold text-foreground">
                Assign Phlebotomist: {selectedAppointment.appointmentId}
              </h2>
              <button onClick={() => setSelectedAppointment(null)} className="text-muted-foreground hover:text-foreground">
                ✕
              </button>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold block mb-1">Select Field Phlebotomist / Staff *</label>
                <select
                  value={phlebotomistId}
                  onChange={(e) => setPhlebotomistId(e.target.value)}
                  className="w-full h-10 rounded-xl border bg-background px-3"
                  required
                >
                  <option value="">Select Staff Member</option>
                  {phlebotomists.map((u: User) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role}) - {u.mobile}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={() => setSelectedAppointment(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={assignMutation.isPending}>
                  Assign Staff
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

