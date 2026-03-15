import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Profile, UserRole } from '@/types/database';
import { getProfileById, getProfileByUsername, upsertProfile } from '@/db/api';
import { toast } from 'sonner';

export interface AuthUser {
  id: string;
  email: string | null;
  username: string | null;
  created_at: string;
}

const USER_STORAGE_KEY = 'polaris_user';
const PROFILE_STORAGE_KEY = 'polaris_profile';

const readStorage = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const writeStorage = (key: string, value: unknown) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const clearStorage = (key: string) => {
  localStorage.removeItem(key);
};

const createProfileForUser = (user: AuthUser, username: string): Profile => {
  const normalized = username.trim().toLowerCase();
  const role: UserRole = normalized === 'admin' ? 'admin' : 'operator';
  const company_id = null;

  return {
    id: user.id,
    email: user.email,
    username,
    role,
    company_id,
    created_at: user.created_at,
  };
};

export async function getProfile(userId: string): Promise<Profile | null> {
  try {
    const serverProfile = await getProfileById(userId);
    if (serverProfile) {
      writeStorage(PROFILE_STORAGE_KEY, serverProfile);
      return serverProfile;
    }
  } catch (error) {
    console.warn('Failed to fetch profile from API:', error);
  }

  const storedProfile = readStorage<Profile>(PROFILE_STORAGE_KEY);
  if (storedProfile?.id === userId) {
    return storedProfile;
  }
  return null;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: Profile | null;
  loading: boolean;
  signInWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signUpWithUsername: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    const profileData = await getProfile(user.id);
    setProfile(profileData);
  };

  useEffect(() => {
    try {
      const storedUser = readStorage<AuthUser>(USER_STORAGE_KEY);
      const storedProfile = readStorage<Profile>(PROFILE_STORAGE_KEY);
      setUser(storedUser);
      setProfile(storedProfile);
    } catch (error) {
      toast.error('Failed to restore session');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  const signInWithUsername = async (username: string, _password: string) => {
    try {
      const storedUser = readStorage<AuthUser>(USER_STORAGE_KEY);
      const storedProfile = readStorage<Profile>(PROFILE_STORAGE_KEY);

      if (storedUser && storedProfile && storedUser.username === username) {
        setUser(storedUser);
        setProfile(storedProfile);
        return { error: null };
      }

      const existingProfile = await getProfileByUsername(username);
      if (existingProfile) {
        const existingUser: AuthUser = {
          id: existingProfile.id,
          email: existingProfile.email,
          username: existingProfile.username,
          created_at: existingProfile.created_at,
        };
        writeStorage(USER_STORAGE_KEY, existingUser);
        writeStorage(PROFILE_STORAGE_KEY, existingProfile);
        setUser(existingUser);
        setProfile(existingProfile);
        return { error: null };
      }

      // Placeholder auth: create a local user if none exists.
      const createdAt = new Date().toISOString();
      const newUser: AuthUser = {
        id: crypto.randomUUID(),
        email: `${username}@miaoda.com`,
        username,
        created_at: createdAt,
      };
      const newProfile = createProfileForUser(newUser, username);

      writeStorage(USER_STORAGE_KEY, newUser);
      writeStorage(PROFILE_STORAGE_KEY, newProfile);
      setUser(newUser);
      setProfile(newProfile);

      void upsertProfile(newProfile).catch((error) => {
        console.error('Failed to sync profile:', error);
      });

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signUpWithUsername = async (username: string, _password: string) => {
    return signInWithUsername(username, _password);
  };

  const signOut = async () => {
    clearStorage(USER_STORAGE_KEY);
    clearStorage(PROFILE_STORAGE_KEY);
    setUser(null);
    setProfile(null);
  };

  const contextValue = useMemo(
    () => ({
      user,
      profile,
      loading,
      signInWithUsername,
      signUpWithUsername,
      signOut,
      refreshProfile,
    }),
    [user, profile, loading]
  );

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
