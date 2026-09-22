import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { sampleApi } from '../../api/sample.api';
import { SampleRecord } from '../../types';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { TestTube, Search, Barcode, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

export const SamplesListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['samples', searchTerm, page],
    queryFn: () => sampleApi.getAll({ search: searchTerm, page, limit: 10 }),
  });

  const sampleList: SampleRecord[] = data?.samples || (Array.isArray(data) ? data : []);
  const totalPages = data?.meta?.totalPages || data?.pagination?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TestTube className="h-6 w-6 text-purple-600" />
            <span>Sample Management Directory</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Track phlebotomy sample collection, lab reception, processing queues & barcode lookups.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/samples/collection')}>
            Phlebotomy Collection Queue
          </Button>
          <Button onClick={() => navigate('/samples/pending')}>
            Lab Processing Queue
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sample ID, barcode, UHID..."
            className="pl-9 text-xs"
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </Card>

      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 border-b text-muted-foreground font-semibold">
              <tr>
                <th className="p-3">Sample ID / Barcode</th>
                <th className="p-3">Patient Profile</th>
                <th className="p-3">Lab Test</th>
                <th className="p-3">Collection Date</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading sample directory...
                  </td>
                </tr>
              ) : sampleList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No samples registered.
                  </td>
                </tr>
              ) : (
                sampleList.map((s: SampleRecord) => {
                  const patient = typeof s.patient === 'object' ? s.patient : {};
                  return (
                    <tr key={s._id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono font-bold text-blue-600">
                        <div>{s.sampleId}</div>
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Barcode className="h-3 w-3" /> {s.barcode}
                        </div>
                      </td>
                      <td className="p-3 font-bold text-foreground">
                        <div>{(patient as any).patientName || 'N/A'}</div>
                        <div className="text-[10px] font-mono text-muted-foreground">UHID: {s.uhid}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold">
                          {s.testName}
                          {s.processingMode === 'Outsource' && (
                          <Badge variant="amber" className="ml-2">
                            Out{s.outsourceLab ? ` · ${s.outsourceLab}` : ''}
                          </Badge>
                        )}
                        </div>
                        <div className="text-[10px] text-muted-foreground">{s.sampleContainer}</div>
                      </td>
                      <td className="p-3 text-muted-foreground">
                        {s.collectionDate ? new Date(s.collectionDate).toLocaleDateString() : 'Pending'}
                      </td>
                      <td className="p-3">
                        <Badge variant={s.status === 'Completed' ? 'success' : 'secondary'}>{s.status}</Badge>
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/results/entry/${s._id}`)}>
                          <Eye className="h-4 w-4 mr-1" /> Open Sample
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t text-xs">
            <div className="text-muted-foreground">
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
