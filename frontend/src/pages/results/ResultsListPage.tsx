import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { resultApi } from '../../api/result.api';
import { ResultRecord } from '../../types';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { FileText, Search, Eye, ChevronLeft, ChevronRight, Download } from 'lucide-react';

export const ResultsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['results', searchTerm, page],
    queryFn: () => resultApi.getAll({ search: searchTerm, page, limit: 10 }),
  });

  const resultsList: ResultRecord[] = data?.results || (Array.isArray(data) ? data : []);
  const totalPages = data?.meta?.totalPages || data?.pagination?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-blue-600" />
            <span>Diagnostic Results Registry</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Review test parameter results, pathologist verification status, and PDF diagnostic reports.
          </p>
        </div>
        <Button onClick={() => navigate('/results/pending')} variant="outline" className="gap-2">
          <span>Pathologist Verification Queue</span>
        </Button>
      </div>

      <Card className="p-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search result ID, UHID..."
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
            <thead className="bg-muted/50 border-b font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Result ID</th>
                <th className="p-3">Patient Profile</th>
                <th className="p-3">Status</th>
                <th className="p-3">Entered By</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y border-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Loading diagnostic results...
                  </td>
                </tr>
              ) : resultsList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No result records found.
                  </td>
                </tr>
              ) : (
                resultsList.map((r: ResultRecord) => {
                  const patient = typeof r.patient === 'object' ? r.patient : {};
                  return (
                    <tr key={r._id} className="hover:bg-muted/30">
                      <td className="p-3 font-mono font-bold text-blue-600">{r.resultId}</td>
                      <td className="p-3 font-bold">
                        <div>{(patient as any).patientName || 'N/A'}</div>
                        <div className="text-[11px] font-mono text-muted-foreground">UHID: {r.uhid}</div>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            r.status === 'Approved' || r.status === 'Final'
                              ? 'success'
                              : r.status === 'Rejected'
                              ? 'destructive'
                              : 'amber'
                          }
                        >
                          {r.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{r.enteredBy?.name || 'Technician'}</td>
                      <td className="p-3 text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => navigate(`/results/report/${r._id}`)}>
                          <Eye className="h-4 w-4 mr-1" /> Report View
                        </Button>
                        <a
                          href={resultApi.getPDFUrl(r._id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-md text-xs font-semibold h-8 px-3 border border-input bg-background hover:bg-accent transition-colors"
                        >
                          <Download className="h-4 w-4 mr-1 text-emerald-600" /> PDF
                        </a>
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
