importScripts("feature-utils.js");

chrome.webNavigation.onCommitted.addListener(async (details) => {
  if (details.frameId !== 0) return; // ? only inject styles into the main frame

  try {
    const hostname = getHostname(details.url);
    const result = await fetchSiteCss(hostname);
    if (!result) return; // no styles for this site, or a fetch failure

    const features = parseCssFeatures(result.css);
    const stored = await chrome.storage.local.get(CHILLING_SETTINGS_KEY);
    const settings =
      stored[CHILLING_SETTINGS_KEY]?.[hostname] ??
      getDefaultSiteSettings(features);
    const customCss = settings.enabled ? (settings.customCss ?? "") : "";
    const enabledCss =
      `${getEnabledCss(features, settings)}\n${customCss}`.trim();
    if (!enabledCss) return;

    await chrome.scripting.insertCSS({
      target: { tabId: details.tabId },
      css: enabledCss,
    });
    
  } catch (e) {
    // ? ignores chrome://, about:blank and other unsupported URLs, but logs
    if (!(e instanceof TypeError)) console.warn("chilling web:", e);
  }
});
