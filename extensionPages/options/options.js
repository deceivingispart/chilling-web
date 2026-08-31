document.addEventListener("DOMContentLoaded", async () => {
  const { localMode } = await getGlobalSettings();
  const checkbox = document.getElementById("local-mode");
  checkbox.checked = localMode;

  document.getElementById("save").addEventListener("click", async () => {
    await setGlobalSettings({ localMode: checkbox.checked });
    const status = document.getElementById("status");
    status.textContent = "Settings saved.";
    setTimeout(() => (status.textContent = ""), 2000);
  });
});
