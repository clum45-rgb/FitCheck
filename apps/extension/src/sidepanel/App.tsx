import { useState } from "react";
import { scanCurrentPage } from "../lib/placeholderActions";
import type { ProductCardData, StyleProfile } from "../types";
import { CurrentPageCard } from "./components/CurrentPageCard";
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
  const [profile, setProfile] = useState<StyleProfile>(initialProfile);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState(false);
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
