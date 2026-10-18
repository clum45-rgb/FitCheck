export const webAppUrl = "http://localhost:5173/";

export async function openWebApp() {
  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    await chrome.tabs.create({ url: webAppUrl });
    return;
  }
  window.open(webAppUrl, "_blank", "noopener");
}
