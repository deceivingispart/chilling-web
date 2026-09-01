const CHILLING_SETTINGS_KEY = "chillingWebSettings";
const GLOBAL_SETTINGS_KEY = "chillingWebGlobalSettings";
const STYLES_REPO_RAW_BASE =
  "https://raw.githubusercontent.com/deceivingispart/chilling-web-styles/refs/heads/main/styles/";

async function getGlobalSettings() {
  const stored = await chrome.storage.local.get(GLOBAL_SETTINGS_KEY);
  return { localMode: false, ...stored[GLOBAL_SETTINGS_KEY] };
}

async function setGlobalSettings(settings) {
  await chrome.storage.local.set({ [GLOBAL_SETTINGS_KEY]: settings });
}

// TODO: consider adding a cache for prevent unnecessary fetches and improve injection time.
async function fetchSiteCss(hostname) {
  if (!hostname) return null;

  try {
    const { localMode } = await getGlobalSettings();

    if (localMode) {
      const localUrl = chrome.runtime.getURL(`styles/${hostname}.css`);
      const localResponse = await fetch(localUrl);
      if (!localResponse.ok) return null;
      return { css: await localResponse.text(), source: "local" };
    }

    const remoteResponse = await fetch(
      `${STYLES_REPO_RAW_BASE}${hostname}.css`,
    );
    if (!remoteResponse.ok) return null;
    return { css: await remoteResponse.text(), source: "remote" };
  } catch (error) {
    return null;
  }
}

function slugifyFeatureId(value) {
  return (
    value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "feature"
  );
}

function parseFeatureComment(comment) {
  const separator = comment.indexOf("$");
  if (separator < 0) return null;

  const name = comment.slice(0, separator).trim();
  const description = comment.slice(separator + 1).trim();
  if (!name) return null;

  return {
    id: slugifyFeatureId(name),
    name,
    description,
  };
}

function parseCssFeatures(css) {
  const markerPattern = /^\s*\/\*\s*([^*\r\n]+?)\s*\*\/\s*$/gm;
  const markers = [];
  let match;

  while ((match = markerPattern.exec(css)) !== null) {
    const feature = parseFeatureComment(match[1]);
    if (feature) markers.push({ ...feature, start: match.index });
  }

  const features = [];
  const prelude = css.slice(0, markers[0]?.start ?? css.length).trim();
  if (prelude) {
    features.push({
      id: "base",
      name: "Base",
      description: "website styles",
      css: prelude,
    });
  }

  markers.forEach((marker, index) => {
    const end = markers[index + 1]?.start ?? css.length;
    const content = css.slice(marker.start, end).trim();
    const id = features.some((feature) => feature.id === marker.id)
      ? `${marker.id}-${index + 1}`
      : marker.id;
    features.push({ ...marker, id, css: content });
  });

  return features;
}

function getHostname(url) {
  return new URL(url).hostname.replace(/^www\./, "");
}

function getDefaultSiteSettings(features) {
  return {
    enabled: true,
    features: Object.fromEntries(features.map((feature) => [feature.id, true])),
  };
}

function getEnabledCss(features, settings) {
  return features
    .filter(
      (feature) => settings.enabled && settings.features[feature.id] !== false,
    )
    .map((feature) => feature.css)
    .join("\n\n");
}
