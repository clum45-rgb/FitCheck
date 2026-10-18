import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  approveMatch,
  fetchMatches,
  navigateCurrentTab,
  removeFromCart,
  scanCurrentPage,
} from "../lib/placeholderActions";
import type { Match, StyleProfile } from "../types";
import { AuthScreen } from "./components/AuthScreen";
import { CurrentPageCard } from "./components/CurrentPageCard";
import { ErrorNotice } from "./components/ErrorNotice";
import { Header } from "./components/Header";
import { ProductCard } from "./components/ProductCard";
import { ProfileSummary } from "./components/ProfileSummary";
import { RecommendationsEmptyState } from "./components/RecommendationsEmptyState";
import { SettingsPanel } from "./components/SettingsPanel";
import { StylePreferencesModal } from "./components/StylePreferencesModal";

const initialProfile: StyleProfile = {
  aesthetics: ["Minimalist", "Streetwear"],
  colors: ["Black", "White", "Grey"],
  fit: "Oversized",
};

export function App() {
  const { configured, session, loading, profileError, signIn, signUp, refreshProfile } = useAuth();

  if (!configured) {
    return (
      <div className="app">
        <Header />
        <main>
          <section className="card">
            <p className="eyebrow">Setup required</p>
            <h2>Connect FitFinder to your account</h2>
            <p className="muted">
              Add the Supabase URL and publishable key in the desktop env file, then rebuild the extension.
            </p>
          </section>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="app">
        <Header />
        <main>
          <p className="muted" role="status">Loading your account...</p>
        </main>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="app">
        <Header />
        <main>
          <section className="card">
            <p className="eyebrow">Account unavailable</p>
            <h2>We couldn't load your account.</h2>
            <p className="muted">{profileError}</p>
            <button className="button button-primary" type="button" onClick={() => void refreshProfile()}>
              Try again
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="app">
        <Header />
        <AuthScreen signIn={signIn} signUp={signUp} />
      </div>
    );
  }

  return <SignedInApp />;
}

function SignedInApp() {
  const { session } = useAuth();
  const [profile, setProfile] = useState<StyleProfile>(initialProfile);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [pageName, setPageName] = useState("This page");
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [approveNotice, setApproveNotice] = useState<string | null>(null);
  const productListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const active = productListRef.current?.querySelector(".product-card-active");
    active?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentIndex]);

  async function handleScan() {
    if (!session) return;
    setScanning(true);
    setScanError(null);
    try {
      const scan = await scanCurrentPage();
      setPageName(scan.storeDomain);
      const nextMatches = await fetchMatches(session.access_token, scan.storeDomain);
      setMatches(nextMatches);
      setCurrentIndex(0);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "This page couldn't be scanned.");
    } finally {
      setScanning(false);
    }
  }

  async function handleApprove(match: Match) {
    if (!session) return;
    try {
      await approveMatch(session.access_token, match);
      setApprovedIds((prev) => new Set(prev).add(match.productId));
      setApproveNotice(`Added "${match.name}" to your cart.`);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "This piece couldn't be added to your cart.");
    }
  }

  async function handleRemove(match: Match) {
    if (!session) return;
    try {
      await removeFromCart(session.access_token, match.productId);
      setApprovedIds((prev) => {
        const next = new Set(prev);
        next.delete(match.productId);
        return next;
      });
      setApproveNotice(`Removed "${match.name}" from your cart.`);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "This piece couldn't be removed from your cart.");
    }
  }

  function handleView(match: Match) {
    void navigateCurrentTab(match.url);
  }

  function goToIndex(index: number) {
    const clamped = Math.max(0, Math.min(matches.length - 1, index));
    setCurrentIndex(clamped);
    const match = matches[clamped];
    if (match) void navigateCurrentTab(match.url);
  }

  return (
    <div className="app">
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <main>
        <ProfileSummary profile={profile} onEdit={() => setEditingStyle(true)} />
        <CurrentPageCard
          pageName={pageName}
          loading={scanning}
          errorMessage={scanError}
          onScan={() => {
            void handleScan();
          }}
          onDismissError={() => setScanError(null)}
        />
        {approveNotice ? (
          <ErrorNotice tone="info" message={approveNotice} onDismiss={() => setApproveNotice(null)} />
        ) : null}
        {matches.length > 0 ? (
          <section className="card recommendations" aria-labelledby="recommendations-heading">
            <h2 id="recommendations-heading">Matched pieces</h2>
            <div className="recommendations-nav">
              <button
                type="button"
                className="button button-ghost button-inline"
                disabled={currentIndex === 0}
                onClick={() => goToIndex(currentIndex - 1)}
              >
                Previous
              </button>
              <span className="muted">
                {currentIndex + 1} of {matches.length}
              </span>
              <button
                type="button"
                className="button button-ghost button-inline"
                disabled={currentIndex === matches.length - 1}
                onClick={() => goToIndex(currentIndex + 1)}
              >
                Next
              </button>
            </div>
            <div className="product-list" ref={productListRef}>
              {matches.map((match, index) => (
                <ProductCard
                  key={match.productId}
                  product={match}
                  approved={approvedIds.has(match.productId)}
                  highlighted={index === currentIndex}
                  onView={() => handleView(match)}
                  onApprove={() => {
                    void handleApprove(match);
                  }}
                  onRemove={() => {
                    void handleRemove(match);
                  }}
                />
              ))}
            </div>
          </section>
        ) : (
          <RecommendationsEmptyState />
        )}
      </main>
      {settingsOpen ? (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          onEditStyle={() => {
            setSettingsOpen(false);
            setEditingStyle(true);
          }}
        />
      ) : null}
      {editingStyle ? (
        <StylePreferencesModal
          profile={profile}
          onClose={() => setEditingStyle(false)}
          onSave={(nextProfile) => {
            setProfile(nextProfile);
            setEditingStyle(false);
          }}
        />
      ) : null}
    </div>
  );
}
