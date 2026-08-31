document.addEventListener("DOMContentLoaded", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url) {
    document.getElementById("site").textContent = "Unsupported page";
    document.getElementById("save").disabled = true;
    return;
  }

  let hostname;
  try {
    hostname = getHostname(tab.url);
  } catch (error) {
    document.getElementById("site").textContent = "Unsupported page";
    document.getElementById("save").disabled = true;
    return;
  }

  const siteCss = await fetchSiteCss(hostname);
  const features = siteCss ? parseCssFeatures(siteCss.css) : [];
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

  document.getElementById("site").textContent = hostname;
  if (siteCss?.source === "local") {
    const badge = document.createElement("span");
    badge.className = "local-mode-badge";
    badge.textContent = "local mode";
    document.getElementById("site").append(" ", badge);
  }
  const siteEnabled = document.getElementById("site-enabled");
  siteEnabled.checked = settings.enabled;
  const featureList = document.getElementById("features");
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

  document.getElementById("save").addEventListener("click", () => save(true));
  document
    .getElementById("open-options")
    .addEventListener("click", () => chrome.runtime.openOptionsPage());
});
