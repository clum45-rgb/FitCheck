import { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { scanCurrentPage } from "../lib/placeholderActions";
import type { ProductCardData } from "../types";
import { AuthScreen } from "./components/AuthScreen";
import { CurrentPageCard } from "./components/CurrentPageCard";
import { Header } from "./components/Header";
import { ProductCard } from "./components/ProductCard";
import { ProfileTab } from "./components/ProfileTab";
import { RecommendationsEmptyState } from "./components/RecommendationsEmptyState";
import { SettingsPanel } from "./components/SettingsPanel";

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
  const [tab, setTab] = useState<"scan" | "profile">("scan");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [pageName, setPageName] = useState("This page");
  const [products, setProducts] = useState<ProductCardData[]>([]);

  async function handleScan() {
    setScanning(true);
    setScanError(null);
    try {
      const scan = await scanCurrentPage();
      setPageName(scan.storeDomain);
      setProducts(scan.products);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "This page couldn't be scanned.");
    } finally {
      setScanning(false);
    }
  }

  return (
    <div className="app">
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <div className="panel-tabs" role="tablist" aria-label="FitFinder">
        <button type="button" role="tab" aria-selected={tab === "scan"} onClick={() => setTab("scan")}>
          Scan
        </button>
        <button type="button" role="tab" aria-selected={tab === "profile"} onClick={() => setTab("profile")}>
          Profile
        </button>
      </div>
      <main>
        {tab === "scan" ? (
          <div role="tabpanel" aria-label="Scan">
            <CurrentPageCard
              pageName={pageName}
              loading={scanning}
              errorMessage={scanError}
              onScan={() => {
                void handleScan();
              }}
              onDismissError={() => setScanError(null)}
            />
            {products.length > 0 ? (
              <section className="card recommendations" aria-labelledby="recommendations-heading">
                <h2 id="recommendations-heading">Scanned pieces</h2>
                <div className="product-list">
                  {products.map((product) => (
                    <ProductCard key={`${product.url}-${product.name}`} product={product} />
                  ))}
                </div>
              </section>
            ) : (
              <RecommendationsEmptyState />
            )}
          </div>
        ) : (
          <div role="tabpanel" aria-label="Profile">
            <ProfileTab />
          </div>
        )}
      </main>
      {settingsOpen ? <SettingsPanel onClose={() => setSettingsOpen(false)} /> : null}
    </div>
  );
}
