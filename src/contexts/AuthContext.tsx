import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import type { Profile, UserRole } from '@/types/database';
import { getProfileById, upsertProfile } from '@/db/api';
import { toast } from 'sonner';

export interface AuthUser {
  id: string;
  email: string | null;
  username: string | null;
  created_at: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  login: (returnTo?: string) => Promise<void>;
  signup: (returnTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const createProfileForUser = (user: AuthUser): Profile => {
  const username = user.username ?? user.email?.split('@')[0] ?? 'operator';
  const normalized = username.trim().toLowerCase();
  const role: UserRole =
    normalized === 'admin' ? 'admin' : normalized === 'provider' ? 'provider' : 'operator';

  const companyIdLookup: Record<string, string> = {
    provider: 'company-aurora',
    operator: 'company-skylink',
    aurora: 'company-aurora',
    skylink: 'company-skylink',
    nimbus: 'company-nimbus',
  };

  const company_id = role === 'admin' ? null : companyIdLookup[normalized] ?? 'company-aurora';

  return {
    id: user.id,
    email: user.email,
    username,
    role,
    company_id,
    created_at: user.created_at,
  };
};

const normalizeAuthUser = (auth0User: {
  sub?: string;
  email?: string;
  nickname?: string;
  name?: string;
  updated_at?: string;
}): AuthUser => ({
  id: auth0User.sub ?? '',
  email: auth0User.email ?? null,
  username: auth0User.nickname ?? auth0User.name ?? auth0User.email?.split('@')[0] ?? null,
  created_at: auth0User.updated_at ?? new Date().toISOString(),
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const {
    isAuthenticated,
    isLoading: auth0Loading,
    user: auth0User,
    loginWithRedirect,
    logout,
  } = useAuth0();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const syncProfile = async (nextUser: AuthUser) => {
    const existingProfile = await getProfileById(nextUser.id);
    if (existingProfile) {
      setProfile(existingProfile);
      return;
    }

    const createdProfile = await upsertProfile(createProfileForUser(nextUser));
    setProfile(createdProfile);
  };

  useEffect(() => {
    if (auth0Loading) {
      return;
    }

    if (!isAuthenticated || !auth0User?.sub) {
      setUser(null);
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    const nextUser = normalizeAuthUser(auth0User);
    setUser(nextUser);
    setProfileLoading(true);

    void syncProfile(nextUser)
      .catch((error) => {
        toast.error('Failed to sync profile');
        console.error(error);
      })
      .finally(() => {
        setProfileLoading(false);
      });
  }, [auth0Loading, isAuthenticated, auth0User]);

  const login = async (returnTo = window.location.pathname) => {
    await loginWithRedirect({
      appState: { returnTo },
      authorizationParams: {
        redirect_uri: window.location.origin,
        prompt: 'login',
      },
    });
  };

  const signup = async (returnTo = window.location.pathname) => {
    await loginWithRedirect({
      appState: { returnTo },
      authorizationParams: {
        redirect_uri: window.location.origin,
        prompt: 'login',
        screen_hint: 'signup',
      },
    });
  };

  const signOut = async () => {
    setUser(null);
    setProfile(null);
    await logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  };

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    try {
      const profileData = await getProfileById(user.id);
      if (profileData) {
        setProfile(profileData);
        return;
      }

      const createdProfile = await upsertProfile(createProfileForUser(user));
      setProfile(createdProfile);
    } catch (error) {
      toast.error('Failed to refresh profile');
      console.error(error);
    }
  };

  const loading = auth0Loading || profileLoading;

  const contextValue = useMemo(
    () => ({
      user,
      profile,
      loading,
      login,
      signup,
      signOut,
      refreshProfile,
    }),
    [user, profile, loading]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
