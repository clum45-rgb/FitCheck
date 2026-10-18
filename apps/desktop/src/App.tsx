import { useState } from "react";
import { AuthScreen } from "./auth/AuthScreen";
import { useAuth } from "./auth/AuthProvider";
import { AppNav, type AppTab } from "./components/AppNav";
import { BrandLogo } from "./components/BrandLogo";
import { OnboardingFlow } from "./onboarding/OnboardingFlow";
import { CartScreen } from "./pages/CartScreen";
import { HomeScreen } from "./pages/HomeScreen";

export function App() {
  const { configured, session, profile, loading, profileError, signIn, signUp, refreshProfile } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [tab, setTab] = useState<AppTab>("cart");

  if (!configured) {
    return (
      <main className="message-screen">
        <p className="eyebrow">Setup required</p>
        <h1>Connect Fitspo to Supabase</h1>
        <p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>apps/desktop/.env.local</code>, then restart the dev server.</p>
      </main>
    );
  }

  if (loading) {
    return <main className="message-screen" role="status">Loading your Fitspo profile...</main>;
  }

  if (profileError) {
    return (
      <main className="message-screen">
        <p className="eyebrow">Profile unavailable</p>
        <h1>We couldn't load your account.</h1>
        <p>{profileError}</p>
        <button className="primary-button" type="button" onClick={() => void refreshProfile()}>Try again</button>
      </main>
    );
  }

  if (!session) return <AuthScreen signIn={signIn} signUp={signUp} />;

  if (!profile?.onboarding_completed || showOnboarding) {
    return (
      <OnboardingFlow
        isReplacement={showOnboarding}
        onConfirmed={async () => {
          await refreshProfile();
          setShowOnboarding(false);
        }}
      />
    );
  }

  const email = session.user.email ?? "";

  return (
    <main className="progress-screen profile-screen">
      <header className="app-header">
        <BrandLogo />
        <div className="app-header-end">
          <AppNav active={tab} onChange={setTab} />
          {email ? <span className="app-header-label app-header-email">{email}</span> : null}
        </div>
      </header>
      {tab === "cart" ? (
        <CartScreen accessToken={session.access_token} />
      ) : (
        <HomeScreen onCompleteSetup={() => setShowOnboarding(true)} />
      )}
    </main>
  );
}
