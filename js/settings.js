// Settings – sender details, email links, daily limit and background sender status.

const FIELDS = ["senderName", "replyTo", "defaultName", "website", "instagram", "facebook", "whatsapp", "youtube", "dailyLimit"];
const URL_FIELDS = { website: "Website", instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", youtube: "YouTube" };
const SETTINGS_CACHE_KEY = "rr_settings"; // also read by the mail page
let saved = null;

function readForm() {
  const s = {};
  FIELDS.forEach((f) => (s[f] = $(f).value.trim()));
  s.dailyLimit = Number(s.dailyLimit);
  return s;
}

function fillForm(s) {
  FIELDS.forEach((f) => ($(f).value = s[f] == null ? "" : s[f]));
  $("defaultNameEcho").textContent = s.defaultName || "Valued Customer";
}

function isDirty() {
  if (!saved) return false;
  const now = readForm();
  return FIELDS.some((f) => String(now[f]) !== String(saved[f] == null ? "" : saved[f]));
}

function updateDirty() {
  const dirty = isDirty();
  $("saveBtn").disabled = !dirty;
  $("dirtyNote").textContent = dirty ? "You have unsaved changes" : "All changes saved";
  $("dirtyNote").classList.toggle("unsaved", dirty);
}

function renderBackground(on) {
  $("bgPill").textContent = on ? "● On" : "● Off";
  $("bgPill").className = "pill " + (on ? "pill-green" : "pill-red");
  $("bgEnable").hidden = on;
}

function cacheSettings(s) {
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(s));
  } catch (e) {}
}

async function loadSettings() {
  try {
    const data = await apiPost("get_settings");
    saved = data.settings;
    fillForm(saved);
    cacheSettings(saved);
    $("account").textContent = data.account || "your Google account";
    $("dailyLimit").max = data.maxDailyLimit;
    renderBackground(data.background);
    $("statusError").hidden = true;
    updateDirty();
  } catch (err) {
    renderErrorBanner(err.message, "Couldn't load settings");
  }
}

function validateSettings(s) {
  if (!s.senderName) return "Business name is required.";
  if (s.replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.replyTo)) return "Reply-to must be a valid email address.";
  if (!Number.isInteger(s.dailyLimit) || s.dailyLimit < 1 || s.dailyLimit > Number($("dailyLimit").max || 1500)) {
    return `Emails per day must be a whole number between 1 and ${$("dailyLimit").max || 1500}.`;
  }
  for (const [key, label] of Object.entries(URL_FIELDS)) {
    if (s[key] && !/^https?:\/\/\S+$/i.test(s[key])) return `${label} link must start with https://`;
  }
  if (!s.website) return "Add your website — the Order Now button in every email needs it.";
  return null;
}

async function saveSettings(e) {
  e.preventDefault();
  const s = readForm();
  const problem = validateSettings(s);
  if (problem) return showCustomAlert(escapeHtml(problem), "Check your settings", "error");

  if (s.dailyLimit > 100 && saved && s.dailyLimit !== saved.dailyLimit) {
    const ok = await showConfirm(
      `A limit of <b>${s.dailyLimit}</b> only works with a paid Google Workspace account. On free Gmail, sending more than ~100 a day can get your account blocked.`,
      "Raise the daily limit?",
      "Yes, I use Workspace",
    );
    if (!ok) return;
  }

  const btn = $("saveBtn");
  setBusy(btn, true, "Saving");
  try {
    const res = await apiPost("save_settings", { settings: s });
    saved = res.settings;
    fillForm(saved);
    cacheSettings(saved);
    showCustomAlert("Your settings are saved and will be used in the next email you send.", "Saved", "success");
  } catch (err) {
    showFriendlyError(err, "Couldn't save");
  } finally {
    setBusy(btn, false);
    updateDirty();
  }
}

async function enableBackground() {
  const btn = $("bgEnable");
  setBusy(btn, true, "Turning on");
  try {
    const res = await apiPost("enable_background");
    renderBackground(res.background);
  } catch (err) {
    showFriendlyError(err, "Couldn't turn it on");
  } finally {
    setBusy(btn, false);
  }
}

$("settingsForm").addEventListener("input", () => {
  $("defaultNameEcho").textContent = $("defaultName").value.trim() || "Valued Customer";
  updateDirty();
});
$("settingsForm").addEventListener("submit", saveSettings);
$("bgEnable").addEventListener("click", enableBackground);
window.addEventListener("beforeunload", (e) => {
  if (isDirty()) e.preventDefault();
});

loadSettings();
