const defaultTitle = "FitCheck";
const blockedTitle = "FitCheck opens on regular websites. Open a normal page and try again.";

function canOpenSidebar(url: string | undefined): boolean {
  return !!url && (url.startsWith("http://") || url.startsWith("https://"));
}

async function markBlocked(tabId: number) {
  await chrome.action.setBadgeText({ tabId, text: "!" });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#111111" });
  await chrome.action.setTitle({ tabId, title: blockedTitle });
}

async function clearBlocked(tabId: number) {
  await chrome.action.setBadgeText({ tabId, text: "" });
  await chrome.action.setTitle({ tabId, title: defaultTitle });
}

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return;

  if (!canOpenSidebar(tab.url)) {
    await markBlocked(tab.id);
    return;
  }

  await clearBlocked(tab.id);

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content/sidebar.js"],
    });
  } catch (error) {
    await markBlocked(tab.id);
    console.error("FitCheck can't open on this page.", error);
  }
});
