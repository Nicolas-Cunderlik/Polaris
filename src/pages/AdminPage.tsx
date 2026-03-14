import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getAllProfiles, updateProfile } from '@/db/api';
import { useAuth } from '@/contexts/AuthContext';
import type { Profile } from '@/types/database';
import { Shield, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';

const AdminPage: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.role !== 'admin') {
      toast.error('Access denied: Admin only');
      navigate('/');
      return;
    }
    loadProfiles();
  }, [profile, navigate]);

  const loadProfiles = async () => {
    try {
      const data = await getAllProfiles();
      setProfiles(data);
    } catch (error) {
      toast.error('Failed to load profiles');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await updateProfile(userId, { role: newRole as any });
      toast.success('Role updated successfully');
      loadProfiles();
    } catch (error) {
      toast.error('Failed to update role');
      console.error(error);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'destructive';
      case 'provider':
        return 'default';
      case 'operator':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-destructive/10 rounded-lg">
            <Shield className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-3xl font-bold gradient-text">Admin Panel</h1>
            <p className="text-muted-foreground">Manage user roles and permissions</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full bg-muted" />
                ))
              ) : (
                profiles.map((userProfile) => (
                  <div
                    key={userProfile.id}
                    className="p-4 border border-border rounded-lg flex items-center justify-between"
                  >
                    <div className="flex-1">
                      <div className="font-medium">{userProfile.username || userProfile.email}</div>
                      <div className="text-xs text-muted-foreground">{userProfile.email}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={getRoleBadgeVariant(userProfile.role)}>
                        {userProfile.role}
                      </Badge>
                      {userProfile.id !== profile?.id && (
                        <Select
                          value={userProfile.role}
                          onValueChange={(value) => handleRoleChange(userProfile.id, value)}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operator">Operator</SelectItem>
                            <SelectItem value="provider">Provider</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                      {userProfile.id === profile?.id && (
                        <span className="text-xs text-muted-foreground">(You)</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role Descriptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="destructive">Admin</Badge>
                <span className="text-sm font-medium">Administrator</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Full access to all features including user management and system configuration
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default">Provider</Badge>
                <span className="text-sm font-medium">Infrastructure Provider</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Can create and manage charging nodes, view analytics and transactions
              </div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="secondary">Operator</Badge>
                <span className="text-sm font-medium">Drone Operator</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Can view fleet status, monitor drones, and access analytics
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default AdminPage;
