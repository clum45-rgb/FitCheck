function enableSidePanelOnClick() {
  return chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch((error: unknown) => {
    console.error("Fitspo couldn't enable the side panel.", error);
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void enableSidePanelOnClick();
});

void enableSidePanelOnClick();
