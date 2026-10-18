import { useState } from "react";
import { scanCurrentPage } from "../lib/placeholderActions";
import type { StyleProfile } from "../types";
import { CurrentPageCard } from "./components/CurrentPageCard";
import { Header } from "./components/Header";
import { ProfileSummary } from "./components/ProfileSummary";
import { RecommendationsEmptyState } from "./components/RecommendationsEmptyState";
import { SettingsPanel } from "./components/SettingsPanel";
import { StylePreferencesModal } from "./components/StylePreferencesModal";

const initialProfile: StyleProfile = {
  aesthetics: ["Minimalist", "Streetwear"],
  colors: ["Black", "White", "Grey"],
  fit: "Oversized",
};

const scanUnavailableMessage =
  "Page scanning isn't available yet. This feature will be connected in a future update.";

export function App() {
  const [profile, setProfile] = useState<StyleProfile>(initialProfile);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  async function handleScan() {
    setScanning(true);
    setScanError(null);
    try {
      await scanCurrentPage();
    } catch {
      setScanError(scanUnavailableMessage);
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
          loading={scanning}
          errorMessage={scanError}
          onScan={() => {
            void handleScan();
          }}
          onDismissError={() => setScanError(null)}
        />
        <RecommendationsEmptyState />
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
