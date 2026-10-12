// Festive Mail – compose a festival/sale email and send it to every customer.
// The email HTML is built here (so the preview is exactly what customers get);
// the backend swaps {{NAME}} and {{UNSUBSCRIBE_URL}} per recipient and attaches
// the poster as cid:offerImage. Brand name and links come from the Settings page.

const BRAND_LOGO = "assets/logo.png";
const SAMPLE_NAME = "Harsh";
const MAX_IMAGE_WIDTH = 1200;
const DEFAULT_OFFER_HEADLINE = "A Special Offer Just For You";
const SETTINGS_CACHE_KEY = "rr_settings";
const DEFAULT_SETTINGS = { senderName: "Roast and Root", defaultName: "Valued Customer", website: "", instagram: "", facebook: "", whatsapp: "", youtube: "" };

const THEMES = {
  cocoa: { label: "Roast Cocoa", primary: "#5b3417", accent: "#c8922a", soft: "#faf5ef", deco: "☕" },
  saffron: { label: "Saffron Gold", primary: "#c2410c", accent: "#f59e0b", soft: "#fff7ed", deco: "🪔" },
  rose: { label: "Rang Pink", primary: "#be185d", accent: "#a855f7", soft: "#fdf2f8", deco: "🌸" },
  emerald: { label: "Emerald", primary: "#047857", accent: "#d4a017", soft: "#ecfdf5", deco: "🌙" },
  crimson: { label: "Crimson Pine", primary: "#b91c1c", accent: "#15803d", soft: "#fef2f2", deco: "🎄" },
  midnight: { label: "Midnight", primary: "#312e81", accent: "#c026d3", soft: "#eef2ff", deco: "✨" },
};

const FESTIVALS = [
  { name: "Diwali", theme: "saffron" },
  { name: "Holi", theme: "rose" },
  { name: "Eid", theme: "emerald" },
  { name: "Christmas", theme: "crimson" },
  { name: "New Year", theme: "midnight" },
  { name: "Raksha Bandhan", theme: "rose" },
  { name: "Navratri", theme: "saffron" },
  { name: "Ganesh Chaturthi", theme: "saffron" },
];

const state = {
  mode: "festival", // "festival" | "offer"
  when: "now", // "now" | "later"
  theme: "saffron",
  settings: loadCachedSettings(),
  logo: null, // { base64, mime }
  image: null, // { base64, mime, name, dataUrl }
  subjectEdited: false,
  status: null,
  statusError: null,
  paused: null, // null = keep sending, "background" or "pause" = stop the page loop
  background: false,
  sending: false,
};

function loadCachedSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_CACHE_KEY) || "{}") };
  } catch (e) {
    return { ...DEFAULT_SETTINGS };
  }
}

function socialLinks() {
  const s = state.settings;
  return [
    { label: "Website", url: s.website },
    { label: "Instagram", url: s.instagram },
    { label: "Facebook", url: s.facebook },
    { label: "WhatsApp", url: s.whatsapp },
    { label: "YouTube", url: s.youtube },
  ].filter((l) => /^https?:\/\//i.test(l.url || ""));
}

// ---------------- Template ----------------

function messageToHtml(text) {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#374151;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function safeUrl(url) {
  return /^https?:\/\//i.test(url || "") ? escapeHtml(url) : "#";
}

function buildEmailHtml({ mode, occasion, message, themeKey, imageSrc, logoSrc, orderUrl }) {
  const t = THEMES[themeKey];
  const brand = escapeHtml(state.settings.senderName);
  const festive = mode === "festival";
  const headline = festive ? `Happy ${escapeHtml(occasion || "Festival")}!` : escapeHtml(occasion);
  const subline = festive ? `Warm wishes from all of us at ${brand}` : `Handpicked for you by ${brand}`;
  const body = message.trim()
    ? messageToHtml(message)
    : `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#9ca3af;">Your offer message will appear here…</p>`;
  const image = imageSrc
    ? `<tr><td style="padding:0 24px 24px;"><img src="${imageSrc}" alt="${headline}" width="552" style="display:block;width:100%;max-width:552px;height:auto;border:0;border-radius:12px;"></td></tr>`
    : "";
  const logo = logoSrc
    ? `<img src="${logoSrc}" alt="${brand}" height="64" style="display:block;height:64px;width:auto;border:0;margin:0 auto 8px;">`
    : "";
  const socials = socialLinks()
    .map((l) => `<a href="${safeUrl(l.url)}" target="_blank" style="color:${t.primary};text-decoration:none;font-weight:600;">${escapeHtml(l.label)}</a>`)
    .join(`<span style="color:#d1d5db;">&nbsp;&nbsp;•&nbsp;&nbsp;</span>`);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${headline}</title></head>
<body style="margin:0;padding:0;background:${t.soft};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${t.soft};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <tr><td align="center" style="padding:24px 24px 18px;">
    ${logo}
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:3px;text-transform:uppercase;color:${t.primary};font-weight:700;">${brand}</div>
  </td></tr>
  <tr><td align="center" bgcolor="${t.primary}" style="background:${t.primary};background-image:linear-gradient(135deg,${t.primary} 0%,${t.accent} 100%);padding:32px 24px;">
    <div style="font-size:28px;line-height:1;margin:0 0 10px;">${t.deco}</div>
    <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:32px;line-height:1.25;color:#ffffff;font-weight:700;">${headline}</h1>
    <div style="margin-top:10px;font-size:15px;color:#ffffff;opacity:0.9;">${subline}</div>
  </td></tr>
  <tr><td style="padding:28px 24px 20px;">
    <p style="margin:0;font-size:18px;color:#111827;">Dear <strong>{{NAME}}</strong>,</p>
  </td></tr>
  ${image}
  <tr><td style="padding:0 24px 8px;">${body}</td></tr>
  <tr><td align="center" style="padding:8px 24px 28px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td align="center" bgcolor="${t.primary}" style="border-radius:999px;background:${t.primary};">
        <a href="${safeUrl(orderUrl)}" target="_blank" style="display:inline-block;padding:15px 40px;font-size:16px;font-weight:700;letter-spacing:0.5px;color:#ffffff;text-decoration:none;border-radius:999px;">Order Now &rarr;</a>
      </td>
    </tr></table>
  </td></tr>
  <tr><td align="center" style="padding:0 24px 20px;font-size:14px;letter-spacing:8px;color:${t.accent};">✦ ✦ ✦</td></tr>
  <tr><td style="padding:0 24px 32px;">
    <p style="margin:0;font-size:16px;line-height:1.6;color:#374151;">With warm regards,<br><strong style="color:${t.primary};">Team ${brand}</strong></p>
  </td></tr>
  <tr><td align="center" style="background:${t.soft};padding:22px 24px;font-size:12px;line-height:1.6;color:#6b7280;">
    ${socials ? `<div style="font-size:13px;margin-bottom:10px;">${socials}</div>` : ""}
    You're receiving this ${festive ? "festive greeting" : "offer"} because you're a valued customer of ${brand}.<br>
    Don't want these emails? <a href="{{UNSUBSCRIBE_URL}}" target="_blank" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
  </td></tr>
</table>
</td></tr>
</table>
</body></html>`;
}

function currentFields() {
  const typed = $("festival").value.trim();
  return {
    mode: state.mode,
    occasion: state.mode === "offer" ? typed || DEFAULT_OFFER_HEADLINE : typed,
    message: $("message").value,
    subject: $("subject").value.trim(),
    themeKey: state.theme,
    orderUrl: $("orderLink").value.trim() || state.settings.website,
  };
}

function defaultSubject(f) {
  const deco = THEMES[state.theme].deco;
  const brand = state.settings.senderName;
  if (f.mode === "offer") return `${deco} {{NAME}}, ${f.occasion} from ${brand}`;
  return f.occasion ? `${deco} Happy ${f.occasion}, {{NAME}}! A special offer from ${brand}` : "";
}

function renderPreview() {
  const f = currentFields();
  if (!state.subjectEdited) {
    $("subject").value = defaultSubject(f);
    f.subject = $("subject").value;
  }
  const html = buildEmailHtml({
    ...f,
    imageSrc: state.image && state.image.dataUrl,
    logoSrc: new URL(BRAND_LOGO, location.href).href,
  })
    .replace(/\{\{NAME\}\}/g, SAMPLE_NAME)
    .replace(/\{\{UNSUBSCRIBE_URL\}\}/g, "#");
  $("previewIframe").srcdoc = html;
  $("previewSubject").textContent = (f.subject || "Subject").replace(/\{\{NAME\}\}/g, SAMPLE_NAME);
  $("previewFrom").textContent = state.settings.senderName;
  $("previewName").textContent = SAMPLE_NAME;
  $("orderLink").placeholder = state.settings.website ? `Defaults to ${state.settings.website}` : "https://your-website.com/shop";
}

function applySettings(settings) {
  state.settings = { ...DEFAULT_SETTINGS, ...settings };
  try {
    localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(state.settings));
  } catch (e) {}
  $("defaultNameHint").textContent = state.settings.defaultName;
  renderPreview();
}

function setMode(mode) {
  state.mode = mode;
  document.querySelectorAll("#modeToggle button").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  const festive = mode === "festival";
  $("festivalLabel").textContent = festive ? "Festival name" : "Offer headline";
  $("festival").placeholder = festive ? "e.g. Diwali" : "e.g. Weekend Mega Sale – Flat 25% Off";
  $("festival").value = "";
  $("festivalChips").hidden = !festive;
  $("offerHint").hidden = festive;
  setTheme(festive ? "saffron" : "cocoa");
}

async function loadLogo() {
  try {
    const blob = await (await fetch(BRAND_LOGO)).blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    state.logo = { base64: dataUrl.split(",")[1], mime: blob.type || "image/png" };
  } catch (err) {
    console.warn("Logo could not be loaded; emails will show the brand name only.", err);
  }
}

// ---------------- Composer UI ----------------

function renderChips() {
  $("festivalChips").innerHTML = FESTIVALS.map(
    (f) => `<button type="button" class="chip" data-name="${f.name}" data-theme="${f.theme}">${THEMES[f.theme].deco} ${f.name}</button>`,
  ).join("");
  $("festivalChips").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    $("festival").value = chip.dataset.name;
    setTheme(chip.dataset.theme);
  });
}

function renderSwatches() {
  $("themeSwatches").innerHTML = Object.entries(THEMES)
    .map(
      ([key, t]) =>
        `<button type="button" class="swatch" data-theme="${key}" title="${t.label}" aria-label="${t.label}" style="background:linear-gradient(135deg,${t.primary},${t.accent})"></button>`,
    )
    .join("");
  $("themeSwatches").addEventListener("click", (e) => {
    const sw = e.target.closest(".swatch");
    if (sw) setTheme(sw.dataset.theme);
  });
}

function setTheme(key) {
  state.theme = key;
  document.querySelectorAll(".swatch").forEach((s) => s.classList.toggle("active", s.dataset.theme === key));
  renderPreview();
}

// datetime-local inputs want local time as "YYYY-MM-DDTHH:mm".
function toLocalInputValue(date) {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function setWhen(when) {
  state.when = when;
  document.querySelectorAll("#whenToggle button").forEach((b) => b.classList.toggle("active", b.dataset.when === when));
  $("scheduleBox").hidden = when !== "later";
  if (when === "later") {
    $("scheduleAt").min = toLocalInputValue(new Date(Date.now() + 5 * 60000));
    if (!$("scheduleAt").value) {
      const tomorrow9 = new Date();
      tomorrow9.setDate(tomorrow9.getDate() + 1);
      tomorrow9.setHours(9, 0, 0, 0);
      $("scheduleAt").value = toLocalInputValue(tomorrow9);
    }
  }
  updateSendButton();
}

function formatWhen(d) {
  return new Date(d).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function updateSendButton() {
  if (state.when === "later") {
    const at = $("scheduleAt").value;
    $("sendBtnText").textContent = at ? `Schedule for ${formatWhen(at)}` : "Schedule";
    return;
  }
  const total = state.status ? state.status.recipients.total : null;
  $("sendBtnText").textContent = total === null ? "Send to customers" : `Send to ${total} customer${total === 1 ? "" : "s"}`;
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_WIDTH / img.naturalWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff"; // flatten transparent PNGs onto white
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      resolve({
        dataUrl,
        base64: dataUrl.split(",")[1],
        mime: "image/jpeg",
        name: file.name.replace(/\.[^.]+$/, "") + ".jpg",
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file couldn't be read as an image."));
    };
    img.src = url;
  });
}

async function handleImageFile(file) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showCustomAlert("Please choose an image file (JPG, PNG or WebP).", "Not an image", "error");
    return;
  }
  try {
    state.image = await compressImage(file);
    $("imageThumb").src = state.image.dataUrl;
    $("imageName").textContent = `${file.name} · ${Math.round((state.image.base64.length * 3) / 4 / 1024)} KB`;
    $("dropzoneEmpty").hidden = true;
    $("dropzoneFilled").hidden = false;
    renderPreview();
  } catch (err) {
    showCustomAlert(err.message, "Image error", "error");
  }
}

function setupDropzone() {
  const dz = $("dropzone");
  const input = $("imageInput");
  dz.addEventListener("click", (e) => {
    if (e.target.id !== "removeImage") input.click();
  });
  dz.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") input.click();
  });
  input.addEventListener("change", () => handleImageFile(input.files[0]));
  ["dragenter", "dragover"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add("dragging");
    }),
  );
  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove("dragging");
    }),
  );
  dz.addEventListener("drop", (e) => handleImageFile(e.dataTransfer.files[0]));
  $("removeImage").addEventListener("click", (e) => {
    e.stopPropagation();
    state.image = null;
    input.value = "";
    $("dropzoneEmpty").hidden = false;
    $("dropzoneFilled").hidden = true;
    renderPreview();
  });
}

// ---------------- Status / quota ----------------

async function loadStatus({ silent = false } = {}) {
  try {
    const data = await apiPost("email_status");
    state.status = data;
    state.statusError = null;
    state.background = data.background;
    $("statusError").hidden = true;
    applySettings(data.settings);
    renderStatus();
    if (!silent && data.quota.left === 0) showQuotaDone();
  } catch (err) {
    state.statusError = err.message;
    renderStatusError(err.message);
  }
}

function renderStatusError(raw) {
  renderErrorBanner(raw, "Couldn't load your customers");
  const ring = $("quotaRing");
  ring.style.setProperty("--pct", 0);
  ring.classList.remove("low", "empty");
  $("quotaLeft").textContent = "–";
  $("quotaText").textContent = "Not connected";
  $("quotaSub").textContent = "See the message above";
  $("recipientText").textContent = "Not connected";
  $("recipientSub").textContent = "See the message above";
}

function renderStatus() {
  const { quota, recipients } = state.status;
  const pct = quota.limit ? (quota.left / quota.limit) * 100 : 0;
  const ring = $("quotaRing");
  ring.style.setProperty("--pct", pct);
  ring.classList.toggle("low", quota.left > 0 && pct <= 20);
  ring.classList.toggle("empty", quota.left === 0);
  $("quotaLeft").textContent = quota.left;
  $("quotaText").textContent = quota.left === 0 ? "Today's quota completed" : `${quota.left} of ${quota.limit} emails left`;
  $("quotaSub").textContent = quota.left === 0 ? "Sending resumes after midnight" : `${quota.sentToday} sent today · resets at midnight`;

  $("recipientText").textContent = `${recipients.total} subscribed`;
  const parts = [];
  if (recipients.unsubscribed) parts.push(`${recipients.unsubscribed} unsubscribed`);
  if (recipients.total > quota.limit) parts.push(`~${Math.ceil(recipients.total / quota.limit)} days at the daily limit`);
  else if (recipients.withoutName) parts.push(`${recipients.withoutName} without a name`);
  $("recipientSub").innerHTML = (parts.length ? escapeHtml(parts.join(" · ")) + " · " : "") + `<a href="customers.html">Manage</a>`;

  renderCampaigns();
  updateSendButton();
}

function renderCampaigns() {
  const active = state.status.campaigns.filter(
    (c) => c.status === "SCHEDULED" || (c.status === "SENDING" && c.pending > 0) || (c.status === "PAUSED" && c.pending > 0 && c.handled > 0),
  );
  $("campaignsCard").hidden = active.length === 0;
  $("campaignsList").innerHTML = active
    .map((c) => {
      const name = `<strong>${escapeHtml(c.festival)}</strong>`;
      const data = `data-id="${escapeHtml(c.id)}" data-festival="${escapeHtml(c.festival)}"`;
      if (c.status === "SCHEDULED") {
        return `<div class="pending-row">
          <div>${name} <span class="pill pill-blue">Scheduled</span>
            <span>Sends ${escapeHtml(formatWhen(c.scheduledAt))} to ${c.pending} customer${c.pending === 1 ? "" : "s"}</span></div>
          <div class="row-actions"><button type="button" class="btn-secondary" data-act="cancel" ${data}>Cancel</button></div>
        </div>`;
      }
      const sending = c.status === "SENDING";
      return `<div class="pending-row">
        <div>${name} <span class="pill ${sending ? "pill-green" : "pill-amber"}">${sending ? "Sending in background" : "Paused"}</span>
          <span>${c.handled} sent · ${c.pending} left${sending ? " · continues automatically" : ""}</span></div>
        <div class="row-actions">
          ${sending ? `<button type="button" class="btn-secondary" data-act="pause" ${data}>Pause</button>` : ""}
          <button type="button" class="btn-secondary" data-act="run" ${data}>${sending ? "Send now" : "Resume"}</button>
          ${sending ? "" : `<button type="button" class="btn-link" data-act="cancel" ${data}>Cancel</button>`}
        </div>
      </div>`;
    })
    .join("");
}

function showQuotaDone(pending) {
  let extra = "<br><br>You can send again after midnight.";
  if (pending) {
    const who = `<b>${pending}</b> customer${pending === 1 ? " is" : "s are"} still waiting.`;
    extra = state.background
      ? `<br><br>${who} They'll be sent <b>automatically after midnight</b> — you can close this page. Nobody gets the email twice.`
      : `<br><br>${who} Come back tomorrow and press <b>Resume</b> — nobody gets the email twice.`;
  }
  showCustomAlert(`You've used today's sending limit to keep your Gmail account safe from being blocked.${extra}`, "Today's quota completed", "error");
}

// ---------------- Sending ----------------

function validate() {
  const f = currentFields();
  const missing = [];
  if (!f.occasion) missing.push("festival name");
  if (!state.image) missing.push("offer image");
  if (!f.message.trim()) missing.push("offer message");
  if (!f.subject) missing.push("subject");
  if (missing.length) {
    showCustomAlert(`Please add the ${missing.join(", ")}.`, "Almost there", "error");
    return null;
  }
  if (!/^https?:\/\//i.test(f.orderUrl)) {
    showCustomAlert(
      'The "Order Now" button needs a link. Add your website on the <a href="settings.html">Settings</a> page, or fill in the Order Now link here.',
      "Order link missing",
      "error",
    );
    return null;
  }
  return f;
}

function payloadFor(f) {
  return {
    festival: f.occasion,
    subject: f.subject,
    html: buildEmailHtml({ ...f, imageSrc: "cid:offerImage", logoSrc: state.logo ? "cid:brandLogo" : null }),
    imageBase64: state.image.base64,
    imageMime: state.image.mime,
    imageName: state.image.name,
    logoBase64: state.logo ? state.logo.base64 : "",
    logoMime: state.logo ? state.logo.mime : "",
  };
}

async function sendTest() {
  const f = validate();
  if (!f) return;
  const btn = $("testBtn");
  setBusy(btn, true, "Sending");
  try {
    const res = await apiPost("send_test", { ...payloadFor(f), to: $("testEmail").value.trim(), testName: SAMPLE_NAME });
    if (res.status === "quota_exceeded") return showQuotaDone();
    showCustomAlert(`A test email was sent to <b>${escapeHtml(res.to)}</b>. ${res.quota.left} emails left today.`, "Test sent", "success");
    loadStatus({ silent: true });
  } catch (err) {
    showFriendlyError(err, "Test email failed");
  } finally {
    setBusy(btn, false);
  }
}

async function startCampaign() {
  if (state.sending) return;
  const f = validate();
  if (!f) return;
  if (!state.status) await loadStatus({ silent: true });
  if (!state.status) {
    const fe = friendlyError(state.statusError || "");
    $("statusError").scrollIntoView({ behavior: "smooth", block: "start" });
    return showCustomAlert(`${escapeHtml(fe.text)}<br><br>Follow the steps at the top of the page, then try again.`, fe.generic ? "Can't reach the sheet" : fe.title, "error");
  }

  const { quota, recipients } = state.status;
  if (recipients.total === 0) {
    return showCustomAlert('No subscribed customers with a valid email. Add some on the <a href="customers.html">Customers</a> page.', "No recipients", "error");
  }

  const who = `<b>${recipients.total}</b> customer${recipients.total === 1 ? "" : "s"}`;
  let scheduledAt = null;
  let message;

  if (state.when === "later") {
    const at = new Date($("scheduleAt").value);
    if (isNaN(at) || at.getTime() < Date.now() + 60000) {
      return showCustomAlert("Please pick a time at least a few minutes from now.", "Pick a later time", "error");
    }
    scheduledAt = at.toISOString();
    const days = Math.ceil(recipients.total / quota.limit);
    message =
      `Schedule the <b>${escapeHtml(f.occasion)}</b> email to ${who} for <b>${escapeHtml(formatWhen(at))}</b>?` +
      `<br><br>It's sent automatically within 15 minutes of that time — you don't need to keep the app open.` +
      (days > 1 ? ` With your daily limit of ${quota.limit}, it finishes over about ${days} days.` : "");
  } else {
    if (quota.left === 0) return showQuotaDone();
    const now = Math.min(quota.left, recipients.total);
    const later = recipients.total - now;
    message =
      `Send the <b>${escapeHtml(f.occasion)}</b> email to ${who} now?` +
      (later
        ? `<br><br>Today's quota covers <b>${now}</b>. The other <b>${later}</b> are sent automatically after midnight.`
        : `<br><br>This uses ${now} of your ${quota.left} emails left today.`);
  }

  const ok = await showConfirm(message, scheduledAt ? "Schedule this email?" : "Ready to send?", scheduledAt ? "Schedule" : "Send now");
  if (!ok) return;

  const btn = $("sendBtn");
  setBusy(btn, true, scheduledAt ? "Scheduling…" : "Preparing…");
  try {
    const res = await apiPost("create_campaign", { ...payloadFor(f), scheduledAt });
    if (scheduledAt) {
      showCustomAlert(
        `Your <b>${escapeHtml(f.occasion)}</b> email goes out on <b>${escapeHtml(formatWhen(scheduledAt))}</b>. You can cancel it any time under <b>Scheduled &amp; in progress</b>.`,
        "Scheduled ⏰",
        "success",
      );
      loadStatus({ silent: true });
    } else {
      await runCampaign(res.campaignId, f.occasion);
    }
  } catch (err) {
    showFriendlyError(err, scheduledAt ? "Couldn't schedule" : "Couldn't start sending");
  } finally {
    setBusy(btn, false);
    updateSendButton();
  }
}

function logLine(text, ok) {
  const li = document.createElement("li");
  li.className = ok ? "ok" : "fail";
  li.textContent = text;
  $("progressLog").prepend(li);
}

async function runCampaign(campaignId, festival) {
  state.sending = true;
  state.paused = null;
  let sent = 0;
  let failed = 0;
  let pending = 0;

  $("progressTitle").textContent = `Sending “${festival}” emails`;
  $("progressSub").textContent = state.background ? "You can close this page — sending continues in the background." : "Please keep this page open.";
  $("progressLog").innerHTML = "";
  $("progressFill").style.width = "0%";
  ["pSent", "pFailed", "pPending"].forEach((id) => ($(id).textContent = "0"));
  ["bgBtn", "stopBtn"].forEach((id) => ($(id).disabled = false));
  $("bgBtn").hidden = !state.background;
  $("bgBtn").textContent = "Continue in background";
  $("stopBtn").textContent = "Pause";
  $("progressModal").classList.add("show");

  let res;
  try {
    while (!state.paused) {
      res = await apiPost("send_batch", { campaignId });
      if (res.status === "busy") {
        $("progressSub").textContent = res.message;
        await new Promise((r) => setTimeout(r, 4000));
        continue;
      }
      sent += res.sent;
      failed += res.failed;
      pending = res.pending;
      (res.results || []).forEach((r) => logLine(r.ok ? `✓ ${r.name} <${r.email}>` : `✗ ${r.email} — ${r.error}`, r.ok));

      $("pSent").textContent = sent;
      $("pFailed").textContent = failed;
      $("pPending").textContent = pending;
      const total = sent + failed + pending;
      $("progressFill").style.width = total ? `${((sent + failed) / total) * 100}%` : "100%";
      if (state.status) state.status.quota = res.quota;

      if (res.status !== "partial") break;
    }
    if (state.paused === "pause") await apiPost("pause_campaign", { campaignId });
  } catch (err) {
    $("progressModal").classList.remove("show");
    state.sending = false;
    showFriendlyError(err, "Sending stopped", "Customers who already got the email are saved — nobody gets it twice.");
    loadStatus({ silent: true });
    return;
  }

  $("progressModal").classList.remove("show");
  state.sending = false;

  if (res && res.status === "complete") {
    showCustomAlert(
      `Your <b>${escapeHtml(festival)}</b> email reached ${sent} customer${sent === 1 ? "" : "s"}` +
        (failed ? ` (${failed} address${failed === 1 ? "" : "es"} failed — see EMAIL_LOG sheet)` : "") +
        `.<br><br>${res.quota.left} emails left today.`,
      "All emails sent 🎉",
      "success",
    );
  } else if (state.paused === "background") {
    showCustomAlert(`Sending continues in the background. ${pending} customer${pending === 1 ? "" : "s"} left — track it under <b>Scheduled &amp; in progress</b>.`, "Running in background", "success");
  } else if (state.paused === "pause") {
    showCustomAlert(`Paused after ${sent} email${sent === 1 ? "" : "s"}. ${pending} left — press <b>Resume</b> any time.`, "Paused", "info");
  } else if (res && res.status === "quota_exceeded") {
    showQuotaDone(pending);
  }
  loadStatus({ silent: true });
}

async function onCampaignAction(e) {
  const btn = e.target.closest("button[data-act]");
  if (!btn || state.sending) return;
  const { act, id, festival } = btn.dataset;

  if (act === "run") {
    if (state.status && state.status.quota.left === 0) return showQuotaDone();
    return runCampaign(id, festival);
  }
  if (act === "cancel") {
    const ok = await showConfirm(
      `Stop the <b>${escapeHtml(festival)}</b> email? Customers who haven't received it yet won't get it.`,
      "Cancel this email?",
      "Yes, cancel",
      { danger: true },
    );
    if (!ok) return;
  }
  setBusy(btn, true, "");
  try {
    await apiPost(act === "pause" ? "pause_campaign" : "cancel_campaign", { campaignId: id });
    await loadStatus({ silent: true });
  } catch (err) {
    setBusy(btn, false);
    showFriendlyError(err, "Couldn't update the campaign");
  }
}

// ---------------- Init ----------------

renderChips();
renderSwatches();
setupDropzone();
setTheme(state.theme);
loadLogo();
$("defaultNameHint").textContent = state.settings.defaultName;

$("modeToggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-mode]");
  if (btn && btn.dataset.mode !== state.mode) setMode(btn.dataset.mode);
});
$("whenToggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-when]");
  if (btn) setWhen(btn.dataset.when);
});
$("scheduleAt").addEventListener("input", updateSendButton);
$("orderLink").addEventListener("input", renderPreview);

// Grow the preview to the email's full height so nothing is clipped.
$("previewIframe").addEventListener("load", () => {
  const doc = $("previewIframe").contentDocument;
  $("previewIframe").style.height = doc.documentElement.scrollHeight + "px";
  doc.querySelectorAll("img").forEach((img) =>
    img.addEventListener("load", () => ($("previewIframe").style.height = doc.documentElement.scrollHeight + "px")),
  );
});
$("festival").addEventListener("input", renderPreview);
$("message").addEventListener("input", renderPreview);
$("subject").addEventListener("input", () => {
  state.subjectEdited = $("subject").value.trim() !== "";
  renderPreview();
});
$("testBtn").addEventListener("click", sendTest);
$("sendBtn").addEventListener("click", startCampaign);
$("stopBtn").addEventListener("click", () => {
  state.paused = "pause";
  ["bgBtn", "stopBtn"].forEach((id) => ($(id).disabled = true));
  $("stopBtn").textContent = "Pausing after this batch…";
});
$("bgBtn").addEventListener("click", () => {
  state.paused = "background";
  ["bgBtn", "stopBtn"].forEach((id) => ($(id).disabled = true));
  $("bgBtn").textContent = "Handing over after this batch…";
});
$("campaignsList").addEventListener("click", onCampaignAction);
window.addEventListener("beforeunload", (e) => {
  if (state.sending && !state.background) e.preventDefault();
});

loadStatus();
