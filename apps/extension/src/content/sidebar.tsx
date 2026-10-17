import { createRoot, type Root } from "react-dom/client";
import { Sidebar } from "../sidebar/Sidebar";
import sidebarCss from "../sidebar/sidebar.css?inline";

const HOST_ID = "fitcheck-sidebar-host";

type SidebarHost = HTMLDivElement & { __fitcheckRoot?: Root };

const hostLayout = [
  "all: initial",
  "display: block",
  "position: fixed",
  "top: 0",
  "right: 0",
  "width: calc(100vw / 6)",
  "height: 100vh",
  "z-index: 2147483647",
  "transform: translateX(100%)",
  "transition: transform 200ms ease",
].join(" !important; ") + " !important;";

function closeSidebar(host: SidebarHost) {
  if (host.dataset.closing === "true") return;
  host.dataset.closing = "true";

  const remove = () => {
    host.__fitcheckRoot?.unmount();
    host.remove();
  };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    remove();
    return;
  }

  host.style.setProperty("transform", "translateX(100%)", "important");
  host.addEventListener("transitionend", remove, { once: true });
}

function openSidebar() {
  const host = document.createElement("div") as SidebarHost;
  host.id = HOST_ID;
  host.style.cssText = hostLayout;

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = sidebarCss;
  const mountPoint = document.createElement("div");
  mountPoint.id = "fitcheck-root";
  shadow.append(style, mountPoint);

  const root = createRoot(mountPoint);
  host.__fitcheckRoot = root;
  root.render(<Sidebar onClose={() => closeSidebar(host)} />);

  document.documentElement.appendChild(host);

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    host.style.setProperty("transform", "translateX(0)", "important");
    return;
  }

  requestAnimationFrame(() => {
    host.style.setProperty("transform", "translateX(0)", "important");
  });
}

const existing = document.getElementById(HOST_ID) as SidebarHost | null;
if (existing) closeSidebar(existing);
else openSidebar();
