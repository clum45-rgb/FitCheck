import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export type UserProfile = {
  id: string;
  display_name: string | null;
  onboarding_completed: boolean;
};

export type AuthActionResult = {
  error: string | null;
  needsEmailConfirmation?: boolean;
};

type AuthContextValue = {
  configured: boolean;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileError: string | null;
  signIn: (email: string, password: string) => Promise<AuthActionResult>;
  signUp: (displayName: string, email: string, password: string) => Promise<AuthActionResult>;
  signOut: () => Promise<AuthActionResult>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function ensureProfile(user: User): Promise<UserProfile> {
  if (!supabase) throw new Error("Supabase is not configured.");

  const profileFields = "id, display_name, onboarding_completed";
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select(profileFields)
    .eq("id", user.id)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      display_name: user.user_metadata?.display_name ?? null,
    })
    .select(profileFields)
    .single();

  if (!insertError) return created;

  const { data: concurrentProfile, error: retryError } = await supabase
    .from("profiles")
    .select(profileFields)
    .eq("id", user.id)
    .maybeSingle();

  if (!retryError && concurrentProfile) return concurrentProfile;
  throw insertError;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const syncSession = useCallback(async (nextSession: Session | null, isActive: () => boolean) => {
    setSession(nextSession);
    setProfileError(null);

    if (!nextSession) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const nextProfile = await ensureProfile(nextSession.user);
      if (!isActive()) return;
      setProfile(nextProfile);
      setLoading(false);
    } catch (error) {
      if (!isActive()) return;
      setProfileError(error instanceof Error ? error.message : "Could not load your profile.");
      setProfile(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    let updateId = 0;
    const applySession = (nextSession: Session | null) => {
      const currentUpdate = ++updateId;
      void syncSession(nextSession, () => active && currentUpdate === updateId);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => applySession(nextSession), 0);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setProfileError(error.message);
        setLoading(false);
        return;
      }
      applySession(data.session);
    });

    return () => {
      active = false;
      updateId += 1;
      subscription.unsubscribe();
    };
  }, [syncSession]);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthActionResult> => {
    if (!supabase) return { error: "Supabase is not configured." };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signUp = useCallback(async (
    displayName: string,
    email: string,
    password: string,
  ): Promise<AuthActionResult> => {
    if (!supabase) return { error: "Supabase is not configured." };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName.trim() || null } },
    });
    return {
      error: error?.message ?? null,
      needsEmailConfirmation: !error && !data.session,
    };
  }, []);

  const signOut = useCallback(async (): Promise<AuthActionResult> => {
    if (!supabase) return { error: "Supabase is not configured." };
    const { error } = await supabase.auth.signOut();
    return { error: error?.message ?? null };
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setProfileError(null);
    try {
      setProfile(await ensureProfile(session.user));
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not load your profile.");
    } finally {
      setLoading(false);
    }
  }, [session]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: isSupabaseConfigured,
    session,
    profile,
    loading,
    profileError,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  }), [session, profile, loading, profileError, signIn, signUp, signOut, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used within AuthProvider.");
  return value;
}
