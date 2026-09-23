import React, { useState, useEffect } from 'react';
import { testApi } from '../../api/test.api';
import { rateHistoryApi } from '../../api/rateHistory.api';
import { departmentApi } from '../../api/department.api';
import { LabTest, Department, RateHistory } from '../../types';
import { UpdateRatesModal } from '../../components/masters/UpdateRatesModal';
import { RateHistoryModal } from '../../components/masters/RateHistoryModal';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Card } from '../../components/ui/card';
import { useToast } from '../../context/ToastContext';
import { asList } from '../../utils/api-list';
import { DollarSign, Search, Edit3, History } from 'lucide-react';

export const RatesPage: React.FC = () => {
  const { showToast } = useToast();
  const [tests, setTests] = useState<LabTest[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');

  const [selectedTest, setSelectedTest] = useState<LabTest | null>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [rateHistoryList, setRateHistoryList] = useState<RateHistory[]>([]);

  const fetchTests = async () => {
    try {
      setIsLoading(true);
      const data = await testApi.getAll({
        search: searchTerm,
        department: departmentFilter || undefined,
        limit: 50,
      });
      setTests(asList<LabTest>(data, 'tests'));
    } catch {
      showToast('Failed to load test rates', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    departmentApi
      .getAll({ limit: 100, status: 'Active' })
      .then((res) => setDepartments(asList<Department>(res, 'departments')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchTests();
  }, [searchTerm, departmentFilter]);

  const handleOpenUpdate = (test: LabTest) => {
    setSelectedTest(test);
    setIsUpdateModalOpen(true);
  };

  const handleOpenHistory = async (test: LabTest) => {
    setSelectedTest(test);
    try {
      const history = await rateHistoryApi.getByTestId(test.id);
      setRateHistoryList(asList<RateHistory>(history, 'history'));
      setIsHistoryModalOpen(true);
    } catch {
      showToast('Failed to fetch rate history', 'error');
    }
  };

  const handleSaveRate = async (rates: any, reason?: string) => {
    if (!selectedTest) return;
    try {
      await testApi.updateRates(selectedTest.id, rates, reason);
      showToast(`Rate updated for ${selectedTest.testName}`, 'success');
      setIsUpdateModalOpen(false);
      fetchTests();
    } catch {
      showToast('Failed to update rate', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <DollarSign className="h-6 w-6 text-emerald-600" />
          <span>Test Rate Master & Tariff Matrix</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage standard patient rates, corporate TPA tariffs, and inspect revision audit logs.
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search test name or code..."
              className="pl-9 text-xs"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            />
          </div>

          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-xs"
            value={departmentFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDepartmentFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.departmentName}
              </option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden border">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-muted/50 border-b font-semibold text-muted-foreground">
              <tr>
                <th className="p-3">Test Code & Name</th>
                <th className="p-3">Standard Rate</th>
                <th className="p-3">Patient Rate</th>
                <th className="p-3">Corporate Rate</th>
                <th className="p-3">Emergency Rate</th>
                <th className="p-3">Ref. Dr. Rate</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Loading test rate catalog...
                  </td>
                </tr>
              ) : (
                tests.map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="p-3">
                      <div className="font-bold">{t.testName}</div>
                      <div className="font-mono text-[11px] text-blue-600 font-semibold">{t.testCode}</div>
                    </td>
                    <td className="p-3 font-mono font-bold text-emerald-600">₹{t.rate}</td>
                    <td className="p-3 font-mono text-muted-foreground">₹{t.patientRate || t.rate}</td>
                    <td className="p-3 font-mono text-muted-foreground">₹{t.corporateRate || t.rate}</td>
                    <td className="p-3 font-mono text-muted-foreground">₹{t.emergencyRate || t.rate}</td>
                    {/* What the referring doctor's own copy prints - normally
                        above the standard rate, the gap being the doctor's cut. */}
                    <td className="p-3 font-mono font-semibold text-violet-600">
                      ₹{t.referralRate || t.rate}
                    </td>
                    <td className="p-3 text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => handleOpenUpdate(t)}>
                        <Edit3 className="h-4 w-4 mr-1 text-blue-600" /> Edit Rate
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleOpenHistory(t)}>
                        <History className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <UpdateRatesModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        onSubmit={handleSaveRate}
        test={selectedTest}
      />

      <RateHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={rateHistoryList}
        testName={selectedTest?.testName}
      />
    </div>
  );
};
