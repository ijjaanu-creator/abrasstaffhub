import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'staff';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isLoading: boolean;
  /** True while we are looking up the user's app role in the database */
  isRoleLoading: boolean;
  userRole: AppRole | null;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, name: string, phone: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRoleLoading, setIsRoleLoading] = useState(false);
  const [userRole, setUserRole] = useState<AppRole | null>(null);

  const fetchUserRole = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      setUserRole(data.role as AppRole);
    } else {
      setUserRole(null);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        // Defer fetching role to avoid deadlock
        setTimeout(() => {
          setIsRoleLoading(true);
          fetchUserRole(session.user.id)
            .catch(() => {
              setUserRole(null);
            })
            .finally(() => {
              setIsRoleLoading(false);
            });
        }, 0);
      } else {
        setUserRole(null);
        setIsRoleLoading(false);
      }

      setIsLoading(false);
    });

    // THEN check for existing session
    (async () => {
      // Guard against rare cases where getSession never resolves (storage/network issues)
      const watchdog = setTimeout(() => {
        setIsLoading(false);
      }, 7000);

      const getSessionWithTimeout = async () => {
        return await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('getSession timeout')), 5000)
          ),
        ]);
      };

      try {
        const { data } = await getSessionWithTimeout();
        const session = data.session;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setIsRoleLoading(true);
          try {
            await fetchUserRole(session.user.id);
          } finally {
            setIsRoleLoading(false);
          }
        } else {
          setUserRole(null);
          setIsRoleLoading(false);
        }
      } catch {
        // If anything goes wrong (network/storage), don't block the UI forever
        setSession(null);
        setUser(null);
        setUserRole(null);
        setIsRoleLoading(false);
      } finally {
        clearTimeout(watchdog);
        setIsLoading(false);
      }
    })();

    return () => subscription.unsubscribe();
  }, [fetchUserRole]);

  const login = useCallback(async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    return { error: null };
  }, []);

  const signup = useCallback(async (
    email: string, 
    password: string, 
    name: string, 
    phone: string
  ): Promise<{ error: string | null }> => {
    // First check if phone number exists in staff_members table
    const { data: staffMember, error: staffError } = await supabase
      .from('staff_members')
      .select('id, user_id')
      .eq('phone', phone)
      .single();

    if (staffError || !staffMember) {
      return { error: 'Your phone number is not registered. Please contact admin to be added as staff.' };
    }

    if (staffMember.user_id) {
      return { error: 'This phone number is already linked to an account.' };
    }

    // Sign up the user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          name,
          phone,
        },
      },
    });

    if (authError) {
      return { error: authError.message };
    }

    if (authData.user) {
      // Link the staff member to the new user using secure function (bypasses RLS)
      const { error: linkError } = await supabase.rpc('link_staff_to_user', {
        _staff_id: staffMember.id,
        _user_id: authData.user.id,
        _email: email,
      });

      if (linkError) {
        console.error('Error linking staff member:', linkError);
      }

      // Add staff role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: authData.user.id, role: 'staff' });

      if (roleError) {
        console.error('Error adding staff role:', roleError);
      }
    }

    return { error: null };
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
  }, []);

  const value: AuthContextType = {
    user,
    session,
    isAuthenticated: !!user,
    isAdmin: userRole === 'admin',
    isLoading,
    isRoleLoading,
    userRole,
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
