// Festive Mail – compose a festival offer and send it to every customer in the sheet.
// The email HTML is built here (so the preview is exactly what customers get);
// the backend swaps {{NAME}} per recipient and attaches the image as cid:offerImage.

// ======== Brand details – edit these ========
const BRAND = "Roast and Roots";
const BRAND_LOGO = "assets/logo.png";
// The "Order Now" button opens this unless a campaign sets its own link.
const WEBSITE_URL = "";
// Shown in the email footer. Leave a url "" to hide that link.
const SOCIAL_LINKS = [
  { label: "Website", url: WEBSITE_URL },
  { label: "Instagram", url: "" }, // https://instagram.com/yourhandle
  { label: "Facebook", url: "" }, // https://facebook.com/yourpage
  { label: "WhatsApp", url: "" }, // https://wa.me/91XXXXXXXXXX
  { label: "YouTube", url: "" }, // https://youtube.com/@yourchannel
];
// ============================================

const SAMPLE_NAME = "Priya";
const MAX_IMAGE_WIDTH = 1200;
const DEFAULT_OFFER_HEADLINE = "A Special Offer Just For You";

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
  theme: "saffron",
  logo: null, // { base64, mime }
  image: null, // { base64, mime, name, dataUrl }
  subjectEdited: false,
  status: null,
  paused: false,
  sending: false,
};

const $ = (id) => document.getElementById(id);

// ---------------- Template ----------------

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

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
  const brand = escapeHtml(BRAND);
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
  const socials = SOCIAL_LINKS.filter((l) => /^https?:\/\//i.test(l.url))
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
    You're receiving this ${festive ? "festive greeting" : "offer"} because you're a valued customer of ${brand}.
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
    orderUrl: $("orderLink").value.trim() || WEBSITE_URL,
  };
}

function defaultSubject(f) {
  const deco = THEMES[state.theme].deco;
  if (f.mode === "offer") return `${deco} {{NAME}}, ${f.occasion} from ${BRAND}`;
  return f.occasion ? `${deco} Happy ${f.occasion}, {{NAME}}! A special offer from ${BRAND}` : "";
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
  }).replace(/\{\{NAME\}\}/g, SAMPLE_NAME);
  $("previewIframe").srcdoc = html;
  $("previewSubject").textContent = (f.subject || "Subject").replace(/\{\{NAME\}\}/g, SAMPLE_NAME);
  $("previewFrom").textContent = BRAND;
  $("previewName").textContent = SAMPLE_NAME;
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
    $("statusError").hidden = true;
    renderStatus();
    if (!silent && data.quota.left === 0) showQuotaDone();
  } catch (err) {
    state.statusError = err.message;
    renderStatusError(err.message);
  }
}

// Turn backend/network errors into plain-language explanations with fix steps.
function friendlyError(raw) {
  const redeploy = "In the editor: Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.";
  if (/permission to call|authoriz|Required permissions/i.test(raw)) {
    const what = /DriveApp/i.test(raw) ? "save posters to Google Drive" : /Spreadsheet/i.test(raw) ? "read the customer sheet" : "send email from your Google account";
    return {
      title: "Google permission needed",
      text: `The Apps Script hasn't been allowed to ${what} yet. This is a one-time setup step.`,
      steps: [
        "Open the spreadsheet → Extensions → Apps Script.",
        "Choose the authorize function in the toolbar and click Run.",
        "On Google's permission screen, tick Select all, then click Allow.",
        redeploy,
        "Come back here and click Try again.",
      ],
    };
  }
  if (/customer sheet/i.test(raw)) {
    return {
      title: "Customer sheet not found",
      text: "The app couldn't find the CUSTOMERS tab in your spreadsheet.",
      steps: ["Open the spreadsheet and make sure a tab named CUSTOMERS exists.", "Row 1 must contain an Email column.", "Click Try again."],
    };
  }
  if (/unexpected response|Unknown action/i.test(raw)) {
    return {
      title: "The mail server needs updating",
      text: "The Apps Script running online is an older version than this page expects.",
      steps: ["Paste the latest Code.gs into the Apps Script editor and save.", redeploy, "Click Try again."],
    };
  }
  if (/failed to fetch|network|load failed/i.test(raw)) {
    return {
      title: "Can't connect",
      text: "The page couldn't reach the server. Check your internet connection.",
      steps: ["Make sure you're online.", "Click Try again."],
    };
  }
  return {
    generic: true,
    title: "Couldn't load your customers",
    text: "Something went wrong while reading the spreadsheet.",
    steps: ["Click Try again.", "If it keeps happening, share the technical details below with your developer."],
  };
}

// Pop-up for errors during test/send. Known problems get fix steps; anything
// else (e.g. "Enter a valid test email address.") is already readable as-is.
function showFriendlyError(err, title, extra = "") {
  const raw = (err && err.message) || String(err);
  const f = friendlyError(raw);
  const body = f.generic
    ? escapeHtml(raw)
    : `${escapeHtml(f.text)}<ol class="alert-steps">${f.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>`;
  showCustomAlert(body + (extra ? `<br><br>${extra}` : ""), f.generic ? title : f.title, "error");
}

function renderStatusError(raw) {
  const f = friendlyError(raw);
  $("statusErrorTitle").textContent = f.title;
  $("statusErrorText").textContent = f.text;
  $("statusErrorSteps").innerHTML = f.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  $("statusErrorRaw").textContent = raw;
  $("statusError").hidden = false;

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
  const { quota, recipients, campaigns } = state.status;
  const pct = quota.limit ? (quota.left / quota.limit) * 100 : 0;
  const ring = $("quotaRing");
  ring.style.setProperty("--pct", pct);
  ring.classList.toggle("low", quota.left > 0 && pct <= 20);
  ring.classList.toggle("empty", quota.left === 0);
  $("quotaLeft").textContent = quota.left;
  $("quotaText").textContent = quota.left === 0 ? "Today's quota completed" : `${quota.left} of ${quota.limit} emails left`;
  $("quotaSub").textContent = quota.left === 0 ? "Sending resumes after midnight" : `${quota.sentToday} sent today · resets at midnight`;

  $("recipientText").textContent = `${recipients.total} with valid email`;
  $("recipientSub").textContent =
    recipients.total > quota.limit
      ? `Takes ~${Math.ceil(recipients.total / quota.limit)} days at the daily limit`
      : `From sheet "${recipients.sheet}"` + (recipients.withoutName ? ` · ${recipients.withoutName} without a name` : "");

  const pending = campaigns.filter((c) => c.pending > 0 && c.handled > 0);
  $("pendingCard").style.display = pending.length ? "" : "none";
  $("pendingList").innerHTML = pending
    .map(
      (c) => `<div class="pending-row">
        <div>
          <strong>${escapeHtml(c.festival)}</strong>
          <span>${c.handled} sent · ${c.pending} remaining · started ${new Date(c.created).toLocaleDateString()}</span>
        </div>
        <button type="button" class="btn-secondary" data-id="${escapeHtml(c.id)}" data-festival="${escapeHtml(c.festival)}">Resume</button>
      </div>`,
    )
    .join("");

  $("sendBtnText").textContent = `Send to ${recipients.total} customer${recipients.total === 1 ? "" : "s"}`;
}

function showQuotaDone(pending) {
  const extra = pending
    ? `<br><br><b>${pending}</b> customer${pending === 1 ? " is" : "s are"} still waiting. Come back tomorrow and press <b>Resume</b> — nobody will get the email twice.`
    : "<br><br>You can send again after midnight.";
  showCustomAlert(
    `You've used today's sending limit to keep your Gmail account safe from being blocked.${extra}`,
    "Today's quota completed",
    "error",
  );
}

// ---------------- Confirm dialog ----------------

function showConfirm(message, title, okText) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "custom-alert-overlay";
    overlay.innerHTML = `<div class="custom-alert-box">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="confirm-actions">
          <button type="button" class="btn-secondary" data-ok="0">Cancel</button>
          <button type="button" data-ok="1">${okText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("show"));
    overlay.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-ok]");
      if (!btn) return;
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 300);
      resolve(btn.dataset.ok === "1");
    });
  });
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
      'The "Order Now" button needs a link starting with https://. Fill in the Order Now link, or set WEBSITE_URL in js/campaign.js.',
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

function setBusy(btn, busy, text) {
  btn.disabled = busy;
  if (busy) {
    btn.dataset.html = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${text}`;
  } else if (btn.dataset.html) {
    btn.innerHTML = btn.dataset.html;
  }
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
    const f = friendlyError(state.statusError || "");
    $("statusError").scrollIntoView({ behavior: "smooth", block: "start" });
    return showCustomAlert(`${escapeHtml(f.text)}<br><br>Follow the steps at the top of the page, then try again.`, f.title, "error");
  }

  const { quota, recipients } = state.status;
  if (recipients.total === 0) return showCustomAlert("No customers with a valid email were found in the sheet.", "No recipients", "error");
  if (quota.left === 0) return showQuotaDone();

  const now = Math.min(quota.left, recipients.total);
  const later = recipients.total - now;
  const ok = await showConfirm(
    `Send the <b>${escapeHtml(f.occasion)}</b> email to <b>${recipients.total}</b> customer${recipients.total === 1 ? "" : "s"}?` +
      (later
        ? `<br><br>Today's quota covers <b>${now}</b>. The other <b>${later}</b> will wait — press <b>Resume</b> on another day to finish.`
        : `<br><br>This uses ${now} of your ${quota.left} emails left today.`),
    "Ready to send?",
    "Send now",
  );
  if (!ok) return;

  const btn = $("sendBtn");
  setBusy(btn, true, "Preparing…");
  try {
    const res = await apiPost("create_campaign", payloadFor(f));
    await runCampaign(res.campaignId, f.occasion);
  } catch (err) {
    showFriendlyError(err, "Couldn't start sending");
  } finally {
    setBusy(btn, false);
    renderStatus();
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
  state.paused = false;
  let sent = 0;
  let failed = 0;
  let pending = 0;

  $("progressTitle").textContent = `Sending “${festival}” emails`;
  $("progressSub").textContent = "Please keep this page open.";
  $("progressLog").innerHTML = "";
  $("progressFill").style.width = "0%";
  ["pSent", "pFailed", "pPending"].forEach((id) => ($(id).textContent = "0"));
  $("stopBtn").disabled = false;
  $("stopBtn").textContent = "Pause";
  $("progressModal").classList.add("show");

  let res;
  try {
    while (!state.paused) {
      res = await apiPost("send_batch", { campaignId });
      if (res.status === "busy") {
        await new Promise((r) => setTimeout(r, 3000));
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
  } catch (err) {
    $("progressModal").classList.remove("show");
    state.sending = false;
    showFriendlyError(err, "Sending stopped", "Customers who already got the email are saved — press <b>Resume</b> to continue.");
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
  } else if (res && res.status === "quota_exceeded") {
    showQuotaDone(pending);
  } else {
    showCustomAlert(`Paused after ${sent} email${sent === 1 ? "" : "s"}. ${pending} remaining — press <b>Resume</b> any time.`, "Paused", "info");
  }
  loadStatus({ silent: true });
}

// ---------------- Init ----------------

renderChips();
renderSwatches();
setupDropzone();
setTheme(state.theme);
loadLogo();

$("modeToggle").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-mode]");
  if (btn && btn.dataset.mode !== state.mode) setMode(btn.dataset.mode);
});
$("orderLink").placeholder = WEBSITE_URL ? `Defaults to ${WEBSITE_URL}` : "https://your-website.com/shop";
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
  state.paused = true;
  $("stopBtn").disabled = true;
  $("stopBtn").textContent = "Pausing after this batch…";
});
$("pendingList").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-id]");
  if (!btn || state.sending) return;
  if (state.status && state.status.quota.left === 0) return showQuotaDone();
  runCampaign(btn.dataset.id, btn.dataset.festival);
});
window.addEventListener("beforeunload", (e) => {
  if (state.sending) e.preventDefault();
});

loadStatus();
