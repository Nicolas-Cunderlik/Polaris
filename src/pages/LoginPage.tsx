import React, { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plane, ShieldCheck, UserPlus } from 'lucide-react';

const LoginPage: React.FC = () => {
  const [loadingAction, setLoadingAction] = useState<'login' | 'signup' | null>(null);
  const location = useLocation();
  const { user, loading, login, signup } = useAuth();
  const returnTo = (location.state as { from?: string } | null)?.from || '/';

  const handleLogin = async () => {
    try {
      setLoadingAction('login');
      await login(returnTo);
    } catch (error) {
      toast.error('Failed to start Auth0 login');
      console.error(error);
      setLoadingAction(null);
    }
  };

  const handleSignup = async () => {
    try {
      setLoadingAction('signup');
      await signup(returnTo);
    } catch (error) {
      toast.error('Failed to start Auth0 signup');
      console.error(error);
      setLoadingAction(null);
    }
  };

  if (loading && loadingAction === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!loading && user) {
    return <Navigate to={returnTo} replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3 text-center">
          <div className="flex justify-center">
            <img src="https://i.postimg.cc/wBJsqfhs/polaris-logo.png" alt="Polaris Logo" className="h-12 w-18" />
          </div>
          <CardDescription>
            Sign in with Auth0 to access fleet monitoring, analytics, and infrastructure tools.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handleLogin} className="w-full gap-2" disabled={loadingAction !== null}>
            <ShieldCheck className="h-4 w-4" />
            {loadingAction === 'login' ? 'Redirecting...' : 'Log In with Auth0'}
          </Button>
          <Button
            onClick={handleSignup}
            variant="outline"
            className="w-full gap-2"
            disabled={loadingAction !== null}
          >
            <UserPlus className="h-4 w-4" />
            {loadingAction === 'signup' ? 'Redirecting...' : 'Sign Up with Auth0'}
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Your Auth0 identity signs you in. Polaris creates an app profile in MongoDB the first time you enter.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
