type SidebarProps = {
  onClose: () => void;
};

export function Sidebar({ onClose }: SidebarProps) {
  return (
    <section className="panel">
      <button type="button" className="close" aria-label="Close FitCheck" onClick={onClose}>
        ×
      </button>
      <h1>FitCheck</h1>
    </section>
  );
}
