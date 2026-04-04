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
  isRoleLoading: boolean;
  userRole: AppRole | null;
  isAccountant: boolean;
  adminViewMode: boolean;
  setAdminViewMode: (v: boolean) => void;
  login: (email: string, password: string) => Promise<{ error: string | null }>;
  signup: (email: string, password: string, name: string, phone: string) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRoleLoading, setIsRoleLoading] = useState(true);
  const [userRole, setUserRole] = useState<AppRole | null>(null);
  const [isAccountant, setIsAccountant] = useState(false);
  const [adminViewMode, setAdminViewMode] = useState(false);

  const fetchUserRole = useCallback(async (userId: string) => {
    const timeoutMs = 5000;

    const { data, error } = await Promise.race([
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .maybeSingle(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('role lookup timeout')), timeoutMs)
      ),
    ]);

    if (error) {
      throw error;
    }

    if (data) {
      setUserRole(data.role as AppRole);
    } else {
      setUserRole(null);
    }
  }, []);

  const checkAccountant = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('staff_members')
        .select('position, department')
        .eq('user_id', userId)
        .maybeSingle();
      if (data && data.position?.toLowerCase() === 'accountant' && data.department?.toLowerCase() === 'office') {
        setIsAccountant(true);
      } else {
        setIsAccountant(false);
      }
    } catch {
      setIsAccountant(false);
    }
  }, []);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        setTimeout(() => {
          setIsRoleLoading(true);

          Promise.race([
            Promise.all([
              fetchUserRole(session.user.id),
              checkAccountant(session.user.id),
            ]),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('role timeout')), 3000)
            ),
          ])
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
        setIsAccountant(false);
        setAdminViewMode(false);
      }

      setIsLoading(false);
    });

    (async () => {
      const watchdog = setTimeout(() => {
        setIsLoading(false);
      }, 3000);

      try {
        const { data } = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('getSession timeout')), 2500)
          ),
        ]);
        const session = data.session;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setIsRoleLoading(true);

          try {
            await Promise.race([
              Promise.all([
                fetchUserRole(session.user.id),
                checkAccountant(session.user.id),
              ]),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('role timeout')), 3000)
              ),
            ]);
          } catch {
            setUserRole(null);
          } finally {
            setIsRoleLoading(false);
          }
        } else {
          setUserRole(null);
          setIsRoleLoading(false);
        }
      } catch {
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
  }, [fetchUserRole, checkAccountant]);

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
    const { data: validationResult, error: validationError } = await supabase
      .rpc('validate_staff_signup', { _phone: phone });

    if (validationError) {
      console.error('Validation error:', validationError);
      return { error: 'Unable to verify your phone number. Please try again.' };
    }

    if (!validationResult || validationResult.length === 0) {
      return { error: 'Your phone number is not registered. Please contact admin to be added as staff.' };
    }

    const staffData = validationResult[0];
    
    if (staffData.already_linked) {
      return { error: 'This phone number is already linked to an account.' };
    }

    const staffMemberId = staffData.staff_id;

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
      const { error: linkError } = await supabase.rpc('link_staff_to_user', {
        _staff_id: staffMemberId,
        _user_id: authData.user.id,
        _email: email,
      });

      if (linkError) {
        console.error('Error linking staff member:', linkError);
      }

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
    setIsAccountant(false);
    setAdminViewMode(false);
  }, []);

  const value: AuthContextType = {
    user,
    session,
    isAuthenticated: !!user,
    isAdmin: userRole === 'admin',
    isLoading,
    isRoleLoading,
    userRole,
    isAccountant,
    adminViewMode,
    setAdminViewMode,
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
