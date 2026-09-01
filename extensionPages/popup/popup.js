document.addEventListener("DOMContentLoaded", async () => {
  const optionsButton = document.getElementById("open-options");
  optionsButton.addEventListener("click", () =>
    chrome.runtime.openOptionsPage(),
  );

  const siteName = document.getElementById("site");
  const siteEnabled = document.getElementById("site-enabled");
  const featureList = document.getElementById("features");
  const saveButton = document.getElementById("save");

  const renderNoStylesState = (label, message) => {
    siteName.textContent = label;
    siteEnabled.disabled = true;
    saveButton.disabled = true;

    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.innerHTML = `
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="20" cy="28" r="2.5" fill="currentColor" />
        <path d="M13 22a10 10 0 0 1 14 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.55" />
        <path d="M7 16a19 19 0 0 1 26 0" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" opacity="0.3" />
        <line x1="6" y1="34" x2="34" y2="6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      <h2>No styles</h2>
      <p>${message}</p>
    `;
    featureList.append(emptyState);
  };

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url) {
    renderNoStylesState(
      "Unsupported page",
      "This page cannot be customized yet.",
    );
    return;
  }

  let url;
  try {
    url = new URL(tab.url);
  } catch (error) {
    renderNoStylesState(
      "Unsupported page",
      "This page cannot be customized yet.",
    );
    return;
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    renderNoStylesState(
      "Unsupported page",
      "This browser page cannot be customized.",
    );
    return;
  }

  let hostname;
  try {
    hostname = getHostname(tab.url);
  } catch (error) {
    renderNoStylesState(
      "Unsupported page",
      "This page cannot be customized yet.",
    );
    return;
  }

  const siteCss = await fetchSiteCss(hostname);
  if (!siteCss) {
    renderNoStylesState(
      hostname,
      "This site does not have a custom style pack yet...",
    );
    return;
  }

  const features = parseCssFeatures(siteCss.css);
  const stored = await chrome.storage.local.get(CHILLING_SETTINGS_KEY);
  const allSettings = stored[CHILLING_SETTINGS_KEY] ?? {};
  const legacyCss = (await chrome.storage.local.get(hostname))[hostname] ?? "";
  const defaults = getDefaultSiteSettings(features);
  const settings = {
    ...defaults,
    ...allSettings[hostname],
    features: {
      ...defaults.features,
      ...(allSettings[hostname]?.features ?? {}),
    },
    customCss: allSettings[hostname]?.customCss ?? legacyCss,
  };

  siteName.textContent = hostname;
  if (siteCss?.source === "local") {
    const badge = document.createElement("span");
    badge.className = "local-mode-badge";
    badge.textContent = "local mode";
    siteName.append(" ", badge);
  }
  siteEnabled.checked = settings.enabled;
  features.forEach((feature) => {
    const row = document.createElement("div");
    row.className = "feature";
    row.innerHTML = `<input id="feature-${feature.id}" type="checkbox"><label for="feature-${feature.id}"><strong></strong><small></small></label>`;
    row.querySelector("input").checked =
      settings.features[feature.id] !== false;
    row.querySelector("strong").textContent = feature.name;
    row.querySelector("small").textContent = feature.description;
    featureList.append(row);
  });

  const save = async (reload) => {
    const nextSettings = {
      enabled: siteEnabled.checked,
      features: Object.fromEntries(
        features.map((feature) => [
          feature.id,
          document.getElementById(`feature-${feature.id}`).checked,
        ]),
      ),
    };
    await chrome.storage.local.set({
      [CHILLING_SETTINGS_KEY]: { ...allSettings, [hostname]: nextSettings },
    });
    document.getElementById("status").textContent = reload
      ? "Settings saved. Reloading..."
      : "CSS has been applied to this page.";
    if (reload) await chrome.tabs.reload(tab.id);
  };

  saveButton.addEventListener("click", () => save(true));
});
