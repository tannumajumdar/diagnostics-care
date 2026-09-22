import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { organizationApi } from '../../api/organization.api';
import { Organization } from '../../types';
import { Card } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Building, Search } from 'lucide-react';

export const OrganizationsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['organizations', searchTerm, page],
    queryFn: () => organizationApi.getAll({ search: searchTerm, page, limit: 10 }),
  });

  const orgsList: Organization[] = data?.organizations || (Array.isArray(data) ? data : []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Building className="h-6 w-6 text-blue-600" />
          <span>Organization & TPA Master</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Corporate clients, insurance TPAs, contracted tariffs & credit billing limits.
        </p>
      </div>

      <Card className="p-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search organization, contact person..."
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
                <th className="p-3">Organization Name</th>
                <th className="p-3">Contact Person</th>
                <th className="p-3">Contract Rate</th>
                <th className="p-3">Credit Limit</th>
                <th className="p-3">Payment Terms</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Loading organizations...
                  </td>
                </tr>
              ) : orgsList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    No organizations configured.
                  </td>
                </tr>
              ) : (
                orgsList.map((org: Organization) => (
                  <tr key={org.id} className="hover:bg-muted/30">
                    <td className="p-3 font-bold text-foreground">{org.organizationName}</td>
                    <td className="p-3">
                      <div>{org.contactPerson}</div>
                      <div className="text-[10px] text-muted-foreground">{org.mobile}</div>
                    </td>
                    <td className="p-3 font-semibold text-blue-600">{org.contractRate}</td>
                    <td className="p-3 font-mono font-bold text-emerald-600">₹{org.creditLimit}</td>
                    <td className="p-3 text-muted-foreground">{org.paymentTerms}</td>
                    <td className="p-3">
                      <Badge variant={org.status === 'Active' ? 'success' : 'destructive'}>{org.status}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
