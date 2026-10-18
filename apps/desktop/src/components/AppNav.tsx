type AppTab = "cart" | "profile";

type AppNavProps = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
};

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg className="app-nav-heart" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M12 20.2 10.6 18.9C5.4 14.2 2 11.1 2 7.3 2 4.3 4.3 2 7.2 2c1.7 0 3.3.8 4.3 2.1C12.5 2.8 14.1 2 15.8 2 18.7 2 21 4.3 21 7.3c0 3.8-3.4 6.9-8.6 11.6L12 20.2Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AppNav({ active, onChange }: AppNavProps) {
  return (
    <nav className="app-nav" aria-label="Main">
      <button
        type="button"
        className="app-nav-tab"
        aria-current={active === "cart" ? "page" : undefined}
        onClick={() => onChange("cart")}
      >
        <HeartIcon filled={active === "cart"} />
        <span>Cart</span>
      </button>
      <span className="app-nav-divider" aria-hidden="true" />
      <button
        type="button"
        className="app-nav-tab"
        aria-current={active === "profile" ? "page" : undefined}
        onClick={() => onChange("profile")}
      >
        <span>Profile</span>
      </button>
    </nav>
  );
}

export type { AppTab };
