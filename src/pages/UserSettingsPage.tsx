import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building2, BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { associateProfileCompany, createCompany, getCompanies, leaveCompany } from '@/db/api';
import type { Company } from '@/types/database';

const UserSettingsPage: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      const data = await getCompanies();
      setCompanies(data);
    } catch (error) {
      toast.error('Failed to load companies');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinCompany = async () => {
    if (!profile?.id) return;
    if (!selectedCompanyId) {
      toast.error('Select a company to join');
      return;
    }

    setSubmitting(true);
    try {
      await associateProfileCompany(profile.id, selectedCompanyId);
      await refreshProfile();
      toast.success('Company registration completed');
    } catch (error: any) {
      toast.error(error.message || 'Failed to join company');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!profile?.id) return;
    if (!newCompanyName.trim()) {
      toast.error('Enter a company name');
      return;
    }

    setSubmitting(true);
    try {
      const company = await createCompany(newCompanyName.trim());
      await associateProfileCompany(profile.id, company.id);
      await refreshProfile();
      await loadCompanies();
      setNewCompanyName('');
      toast.success('Company created and linked to your account');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create company');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLeaveCompany = async () => {
    if (!profile?.id || !profile?.company_id) return;

    setLeaving(true);
    try {
      await leaveCompany(profile.id);
      await refreshProfile();
      toast.success('You have left the company');
    } catch (error: any) {
      toast.error(error.message || 'Failed to leave company');
    } finally {
      setLeaving(false);
    }
  };

  const currentCompany = companies.find((company) => company.id === profile?.company_id);

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text">User Settings</h1>
          <p className="text-muted-foreground">Manage your company registration and profile</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5" />
              Current Company
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profile?.company_id ? (
              <div className="space-y-3 text-sm">
                <div>
                  <div className="font-medium">{currentCompany?.name || 'Assigned company'}</div>
                  <div className="text-xs text-muted-foreground">
                    You can leave the company without affecting its data.
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={handleLeaveCompany}
                  disabled={leaving}
                >
                  {leaving ? 'Leaving...' : 'Leave Company'}
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                You are not registered with a company yet.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Join Existing Company
              </CardTitle>
              <CardDescription>Pick a company to associate with your account.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label>Company</Label>
                <Select
                  value={selectedCompanyId}
                  onValueChange={setSelectedCompanyId}
                  disabled={!!profile?.company_id || loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loading ? 'Loading companies...' : 'Select company'} />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleJoinCompany}
                disabled={!!profile?.company_id || submitting}
              >
                {submitting ? 'Submitting...' : 'Join Company'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Register New Company
              </CardTitle>
              <CardDescription>Register a new company (duplicates are disallowed).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  placeholder="e.g., Horizon Logistics"
                  value={newCompanyName}
                  onChange={(event) => setNewCompanyName(event.target.value)}
                  disabled={!!profile?.company_id}
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreateCompany}
                disabled={!!profile?.company_id || submitting}
              >
                {submitting ? 'Submitting...' : 'Create Company'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default UserSettingsPage;
