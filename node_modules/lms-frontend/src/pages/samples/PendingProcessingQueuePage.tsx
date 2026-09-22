import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { sampleApi } from '../../api/sample.api';
import { asList } from '../../utils/api-list';
import { LAB_QUERY_KEYS } from '../../utils/query-options';
import { SampleRecord } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { FlaskConical, Play } from 'lucide-react';

export const PendingProcessingQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['samples-processing'],
    queryFn: () => sampleApi.getAll({ status: 'Collected', limit: 50 }),
  });

  // `data` comes back as a bare array, so the old `data.samples` count was
  // always zero and the queue read as empty however much was waiting in it.
  const queue = asList<SampleRecord>(data, 'samples');

  const processMutation = useMutation({
    mutationFn: (sampleId: string) => sampleApi.updateStatus(sampleId, 'Processing'),
    onSuccess: (_, sampleId) => {
      // The specimen moves onto the bench, so the collection queue and the
      // workflow board have to say so too.
      LAB_QUERY_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      navigate(`/results/entry/${sampleId}`);
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-purple-600" />
          <span>Central Laboratory Processing Queue</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Collected specimen containers ready for bench analysis & technician result entry.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Collected Specimen Worklist</CardTitle>
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
                    Loading processing worklist...
                  </td>
                </tr>
              ) : queue.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No specimen containers ready for bench analysis.
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
                        <div className="text-[10px] font-mono text-muted-foreground">UHID: {s.uhid}</div>
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
                        <Badge variant="purple">{s.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          disabled={processMutation.isPending}
                          onClick={() => processMutation.mutate(s._id)}
                        >
                          <Play className="h-4 w-4 mr-1" /> Start Bench Test
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

