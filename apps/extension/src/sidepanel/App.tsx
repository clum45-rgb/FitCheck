import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { CartProvider, useCart } from "../cart/CartContext";
import { fetchMatches, navigateCurrentTab, scanCurrentPage } from "../lib/placeholderActions";
import type { Match } from "../types";
import { AuthScreen } from "./components/AuthScreen";
import { CartTab } from "./components/CartTab";
import { CurrentPageCard } from "./components/CurrentPageCard";
import { ErrorNotice } from "./components/ErrorNotice";
import { Header } from "./components/Header";
import { MatchThresholdSlider, MATCH_THRESHOLD_DEFAULT } from "./components/MatchThresholdSlider";
import { ProductCard } from "./components/ProductCard";
import { ProfileTab } from "./components/ProfileTab";
import { RecommendationsEmptyState } from "./components/RecommendationsEmptyState";
import { SettingsPanel } from "./components/SettingsPanel";

export function App() {
  const { configured, session, loading, profileError, signIn, signUp, refreshProfile, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);
    try {
      const result = await signOut();
      if (result.error) setLogoutError(result.error);
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : "Could not log out.");
    } finally {
      setLoggingOut(false);
    }
  }

  if (!configured) {
    return (
      <div className="app">
        <Header />
        <main>
          <section className="card">
            <p className="eyebrow">Setup required</p>
            <h2>Connect Fitspo to your account</h2>
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
            <div className="account-actions">
              <button
                className="button button-primary"
                type="button"
                disabled={loggingOut}
                onClick={() => void refreshProfile()}
              >
                Try again
              </button>
              <button
                className="button button-secondary"
                type="button"
                disabled={loggingOut}
                onClick={() => void handleLogout()}
              >
                {loggingOut ? "Logging out..." : "Log out"}
              </button>
            </div>
            {logoutError ? <p className="settings-error" role="alert">{logoutError}</p> : null}
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

  return (
    <CartProvider>
      <SignedInApp />
    </CartProvider>
  );
}

function SignedInApp() {
  const { session } = useAuth();
  const { isApproved, approve, remove } = useCart();
  const [tab, setTab] = useState<"scan" | "profile" | "cart">("scan");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [pageName, setPageName] = useState("This page");
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchThreshold, setMatchThreshold] = useState(MATCH_THRESHOLD_DEFAULT);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [approveNotice, setApproveNotice] = useState<string | null>(null);
  const productListRef = useRef<HTMLDivElement>(null);
  const visibleMatches = matches.filter((match) => match.matchScore >= matchThreshold);

  useEffect(() => {
    const active = productListRef.current?.querySelector(".product-card-active");
    active?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentIndex]);

  useEffect(() => {
    setCurrentIndex((index) => {
      if (visibleMatches.length === 0) return 0;
      return Math.min(index, visibleMatches.length - 1);
    });
  }, [matchThreshold, visibleMatches.length]);

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
    try {
      await approve(match);
      setApproveNotice(`Added "${match.name}" to your cart.`);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "This piece couldn't be added to your cart.");
    }
  }

  async function handleRemove(match: Match) {
    try {
      await remove(match.productId);
      setApproveNotice(`Removed "${match.name}" from your cart.`);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "This piece couldn't be removed from your cart.");
    }
  }

  function goToIndex(index: number) {
    const clamped = Math.max(0, Math.min(visibleMatches.length - 1, index));
    setCurrentIndex(clamped);
    const match = visibleMatches[clamped];
    if (match) void navigateCurrentTab(match.url);
  }

  return (
    <div className="app">
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <div className="panel-tabs" role="tablist" aria-label="Fitspo">
        <button type="button" role="tab" aria-selected={tab === "scan"} onClick={() => setTab("scan")}>
          Scan
        </button>
        <button type="button" role="tab" aria-selected={tab === "cart"} onClick={() => setTab("cart")}>
          Cart
        </button>
        <button type="button" role="tab" aria-selected={tab === "profile"} onClick={() => setTab("profile")}>
          Profile
        </button>
      </div>
      <main>
        {tab === "scan" ? (
          <div role="tabpanel" aria-label="Scan" className={visibleMatches.length > 0 ? "has-match-nav" : undefined}>
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
            <section className="card recommendations" aria-labelledby="recommendations-heading">
              <div className="recommendations-sticky">
                <h2 id="recommendations-heading">
                  {matches.length > 0 ? "Matched pieces" : "Your next favorite find starts here."}
                </h2>
                {matches.length === 0 ? (
                  <p className="muted">Scan a clothing page to discover pieces that match your style.</p>
                ) : null}
                <MatchThresholdSlider value={matchThreshold} onChange={setMatchThreshold} />
              </div>
              {matches.length > 0 ? (
                <div className="product-list" ref={productListRef}>
                  {visibleMatches.length > 0 ? visibleMatches.map((match, index) => (
                    <ProductCard
                      key={match.productId}
                      product={match}
                      approved={isApproved(match.productId)}
                      highlighted={index === currentIndex}
                      onView={() => goToIndex(index)}
                      onApprove={() => {
                        void handleApprove(match);
                      }}
                      onRemove={() => {
                        void handleRemove(match);
                      }}
                    />
                  )) : (
                    <p className="muted">No pieces meet this match threshold. Lower it to see more recommendations.</p>
                  )}
                </div>
              ) : (
                <RecommendationsEmptyState />
              )}
            </section>
            {visibleMatches.length > 0 ? (
              <nav className="recommendations-nav" aria-label="Matched pieces">
                <button
                  type="button"
                  className="recommendations-nav-button"
                  disabled={currentIndex === 0}
                  onClick={() => goToIndex(currentIndex - 1)}
                >
                  Prev
                </button>
                <span className="recommendations-nav-count">
                  {currentIndex + 1} of {visibleMatches.length}
                </span>
                <button
                  type="button"
                  className="recommendations-nav-button"
                  disabled={currentIndex === visibleMatches.length - 1}
                  onClick={() => goToIndex(currentIndex + 1)}
                >
                  Next
                </button>
              </nav>
            ) : null}
          </div>
        ) : tab === "profile" ? (
          <div role="tabpanel" aria-label="Profile">
            <ProfileTab />
          </div>
        ) : (
          <div role="tabpanel" aria-label="Cart">
            <CartTab />
          </div>
        )}
      </main>
      {settingsOpen ? <SettingsPanel onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  );
}
