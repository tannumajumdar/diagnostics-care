import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sampleApi } from '../../api/sample.api';
import { asList } from '../../utils/api-list';
import { LAB_QUERY_KEYS } from '../../utils/query-options';
import { SampleRecord } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { TestTube, CheckCircle2 } from 'lucide-react';

export const SampleCollectionQueuePage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['samples-collection'],
    queryFn: () => sampleApi.getAll({ status: 'Pending Collection', limit: 50 }),
  });

  // `data` comes back as a bare array, so the old `data.samples` count was
  // always zero and the queue read as empty however much was waiting in it.
  const queue = asList<SampleRecord>(data, 'samples');

  const collectMutation = useMutation({
    mutationFn: (sampleId: string) => sampleApi.updateStatus(sampleId, 'Collected'),
    onSuccess: () => {
      // A drawn specimen leaves this queue and lands on the bench's, so
      // every lab queue is re-read rather than just the one on screen.
      LAB_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      alert('Sample marked as Collected!');
    },
    onError: (err: any) => alert(err?.response?.data?.message || 'Failed to update sample status'),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <TestTube className="h-6 w-6 text-blue-600" />
          <span>Phlebotomy Sample Collection Queue</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Registered patient samples pending phlebotomy draw & container labeling.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Samples Pending Phlebotomy Draw</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 font-semibold border-b">
              <tr>
                <th className="p-3">Sample ID</th>
                <th className="p-3">Patient & UHID</th>
                <th className="p-3">Test & Container</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y border-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Loading collection queue...
                  </td>
                </tr>
              ) : queue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No samples pending collection.
                  </td>
                </tr>
              ) : (
                queue.map((s: SampleRecord) => {
                  const patient = typeof s.patient === 'object' ? s.patient : {};
                  return (
                    <tr key={s._id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-blue-600">{s.sampleId}</td>
                      <td className="p-3 font-bold">
                        <div>{patient.patientName || 'N/A'}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">UHID: {s.uhid}</div>
                      </td>
                      <td className="p-3 font-semibold">
                        {s.testName}
                        {s.processingMode === 'Outsource' && (
                          <Badge variant="amber" className="ml-2">
                            Out{s.outsourceLab ? ` · ${s.outsourceLab}` : ''}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <Badge variant="amber">{s.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          disabled={collectMutation.isPending}
                          onClick={() => collectMutation.mutate(s._id)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" /> Mark Collected
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};

