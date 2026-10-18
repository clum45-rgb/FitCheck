import { X } from "lucide-react";
import type { NoticeTone } from "../../types";

type ErrorNoticeProps = {
  tone?: NoticeTone;
  message: string;
  onDismiss: () => void;
};

export function ErrorNotice({ tone = "error", message, onDismiss }: ErrorNoticeProps) {
  return (
    <div className={`notice notice-${tone}`} role={tone === "error" ? "alert" : "status"}>
      <p>{message}</p>
      <button type="button" className="icon-button" onClick={onDismiss} aria-label="Dismiss message">
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
