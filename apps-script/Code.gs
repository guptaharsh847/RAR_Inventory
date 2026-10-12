/**
 * Roast and Root – Apps Script backend
 * PIN login, customers, settings, and mail campaigns with scheduling,
 * background auto-resume and unsubscribe links. Labels are generated client-side.
 *
 * Paste this whole file into the Apps Script editor bound to the spreadsheet,
 * run `authorize` once, then Deploy → Manage deployments → Edit → New version.
 */

// ===================== CONFIG =====================
// Most of these are only defaults – change them on the app's Settings page.
const DEFAULT_SETTINGS = {
  senderName: "Roast and Root", // shown as sender and in the email header
  replyTo: "", // "" = replies go to the sending Gmail account
  dailyLimit: 90, // free Gmail allows ~100/day via Apps Script, Workspace ~1500
  defaultName: "Valued Customer", // used when a customer has no name
  website: "",
  instagram: "",
  facebook: "",
  whatsapp: "",
  youtube: "",
};
const MAX_DAILY_LIMIT = 1500;
// Sheet holding your customers. If missing, the first sheet with an "Email" header is used.
const CUSTOMER_SHEET_NAME = "CUSTOMERS";
// Drive folder for uploaded posters. "" = auto-create "Roast and Root Mail Images".
const DRIVE_FOLDER_ID = "";
// Emails sent per request from the web app (keeps each call short).
const MAX_BATCH = 10;
// How often the background sender checks for work, and how long one run may send for.
const QUEUE_EVERY_MINUTES = 15;
const RUN_BUDGET_MS = 4.5 * 60 * 1000;

const SESSION_DAYS = 7;
const CAMPAIGN_SHEET = "CAMPAIGNS";
const LOG_SHEET = "EMAIL_LOG";
const UNSUB_SHEET = "UNSUBSCRIBED";
const SYSTEM_SHEETS = ["USERS", CAMPAIGN_SHEET, LOG_SHEET, UNSUB_SHEET];
const CAMPAIGN_HEADER = ["Created", "Campaign ID", "Occasion", "Subject", "Image File ID", "Logo File ID", "HTML", "Status", "Scheduled At"];
// Campaign statuses. SENDING campaigns are picked up by the background sender.
const SCHEDULED = "SCHEDULED";
const SENDING = "SENDING";
const PAUSED = "PAUSED";
const DONE = "DONE";
const CANCELLED = "CANCELLED";
// ==================================================

const ss = SpreadsheetApp.getActiveSpreadsheet();
const props = PropertiesService.getScriptProperties();

const ACTIONS = {
  email_status: emailStatus,
  create_campaign: createCampaign,
  send_batch: sendBatch,
  send_test: sendTest,
  pause_campaign: (d) => changeCampaignStatus(d, PAUSED),
  cancel_campaign: (d) => changeCampaignStatus(d, CANCELLED),
  resume_campaign: resumeCampaign,
  delete_campaign: deleteCampaign,
  campaign_preview: campaignPreview,
  dashboard: dashboard,
  get_settings: getSettingsAction,
  save_settings: saveSettings,
  enable_background: enableBackground,
  list_customers: listCustomers,
  add_customers: addCustomers,
  update_customer: updateCustomer,
  delete_customer: deleteCustomer,
  set_subscription: setSubscription,
};

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action == "unsubscribe") return unsubscribePage(p);
  return json({ status: "ok" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action == "login") return login(data);

    if (!isValidToken(data.token)) {
      return json({ status: "unauthorized", message: "Session expired. Please sign in again." });
    }
    rememberAppUrl(data.appUrl);

    const handler = ACTIONS[data.action];
    if (!handler) return json({ status: "error", message: "Unknown action" });
    return handler(data);
  } catch (err) {
    return json({ status: "error", message: String(err && err.message ? err.message : err) });
  }
}

// ---------------- Auth ----------------

function login(data) {
  const sheet = ss.getSheetByName("USERS");
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] == data.password) {
      const token = Utilities.getUuid();
      purgeExpiredTokens();
      props.setProperty("tok_" + token, String(Date.now() + SESSION_DAYS * 864e5));
      return json({ status: "success", token: token });
    }
  }

  return json({ status: "error" });
}

function isValidToken(token) {
  if (!token) return false;
  const expiry = Number(props.getProperty("tok_" + token));
  return expiry > Date.now();
}

function purgeExpiredTokens() {
  const all = props.getProperties();
  const now = Date.now();
  Object.keys(all).forEach((k) => {
    if (k.indexOf("tok_") === 0 && Number(all[k]) < now) props.deleteProperty(k);
  });
}

// The web app's public URL, needed to build unsubscribe links from background runs.
function rememberAppUrl(url) {
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url || "")) return;
  if (props.getProperty("web_app_url") !== url) props.setProperty("web_app_url", url);
}

// ---------------- Settings ----------------

function getSettings() {
  let saved = {};
  try {
    saved = JSON.parse(props.getProperty("settings") || "{}");
  } catch (e) {}
  return Object.assign({}, DEFAULT_SETTINGS, saved);
}

function getSettingsAction() {
  return json({
    status: "success",
    settings: getSettings(),
    account: ownerEmail(),
    background: hasQueueTrigger(),
    maxDailyLimit: MAX_DAILY_LIMIT,
  });
}

function saveSettings(data) {
  const s = data.settings || {};
  const clean = {};

  clean.senderName = String(s.senderName || "").trim().slice(0, 60);
  if (!clean.senderName) throw new Error("Business name is required.");

  clean.replyTo = String(s.replyTo || "").trim().toLowerCase();
  if (clean.replyTo && !isEmail(clean.replyTo)) throw new Error("Reply-to must be a valid email address.");

  clean.dailyLimit = Math.floor(Number(s.dailyLimit));
  if (!(clean.dailyLimit >= 1 && clean.dailyLimit <= MAX_DAILY_LIMIT)) {
    throw new Error("Daily limit must be between 1 and " + MAX_DAILY_LIMIT + ".");
  }

  clean.defaultName = String(s.defaultName || "").trim().slice(0, 40) || DEFAULT_SETTINGS.defaultName;

  const labels = { website: "Website", instagram: "Instagram", facebook: "Facebook", whatsapp: "WhatsApp", youtube: "YouTube" };
  Object.keys(labels).forEach((k) => {
    const v = String(s[k] || "").trim();
    if (v && !/^https?:\/\/\S+$/i.test(v)) throw new Error(labels[k] + " link must start with https://");
    clean[k] = v;
  });

  props.setProperty("settings", JSON.stringify(clean));
  return json({ status: "success", settings: clean });
}

// ---------------- Background sender ----------------

function hasQueueTrigger() {
  try {
    return ScriptApp.getProjectTriggers().some((t) => t.getHandlerFunction() === "processQueue");
  } catch (e) {
    return false; // permission not granted yet
  }
}

function ensureQueueTrigger() {
  if (hasQueueTrigger()) return;
  ScriptApp.newTrigger("processQueue").timeBased().everyMinutes(QUEUE_EVERY_MINUTES).create();
}

function enableBackground() {
  ensureQueueTrigger();
  return json({ status: "success", background: true });
}

// Runs every QUEUE_EVERY_MINUTES: starts due scheduled campaigns and keeps
// sending SENDING campaigns until they finish or today's quota runs out.
function processQueue() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    const deadline = Date.now() + RUN_BUDGET_MS;
    const now = new Date();
    const due = getCampaigns()
      .filter((c) => c.status === SENDING || (c.status === SCHEDULED && c.scheduledAt && new Date(c.scheduledAt) <= now))
      .sort((a, b) => new Date(a.created) - new Date(b.created));

    for (let i = 0; i < due.length; i++) {
      if (Date.now() > deadline) break;
      const c = due[i];
      if (c.status === SCHEDULED) setCampaignStatus(c, SENDING);
      const res = sendForCampaign(c, Infinity, deadline);
      if (res.status === "quota_exceeded") break;
    }
  } finally {
    lock.releaseLock();
  }
}

// ---------------- Quota ----------------

function todayKey() {
  return "sent_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function getQuota(settings) {
  const limit = (settings || getSettings()).dailyLimit;
  const sentToday = Number(props.getProperty(todayKey())) || 0;
  const googleLeft = MailApp.getRemainingDailyQuota();
  const left = Math.max(0, Math.min(limit - sentToday, googleLeft));
  return { limit: limit, sentToday: sentToday, left: left };
}

function addSentToday(n) {
  const key = todayKey();
  props.setProperty(key, String((Number(props.getProperty(key)) || 0) + n));
}

// ---------------- Customers ----------------

function findCustomerSheet() {
  const named = CUSTOMER_SHEET_NAME && ss.getSheetByName(CUSTOMER_SHEET_NAME);
  if (named) return named;
  const sheets = ss.getSheets();
  for (let i = 0; i < sheets.length; i++) {
    const s = sheets[i];
    if (SYSTEM_SHEETS.indexOf(s.getName().toUpperCase()) !== -1) continue;
    if (s.getLastRow() < 1 || s.getLastColumn() < 1) continue;
    const header = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
    if (header.some((h) => /e-?mail/i.test(String(h)))) return s;
  }
  return null;
}

function requireCustomerSheet() {
  const sheet = findCustomerSheet();
  if (!sheet) throw new Error("No customer sheet found. Add a sheet with an 'Email' column.");
  return sheet;
}

// Zero-based column index for each known field (-1 when the sheet lacks it).
function customerColumns(header) {
  const h = header.map((x) => String(x).trim().toLowerCase());
  const find = (re) => h.findIndex((x) => re.test(x));
  let name = find(/^(customer |user |full |client )?name$/);
  if (name === -1) name = h.findIndex((x) => /name/.test(x) && !/e-?mail/.test(x));
  return {
    email: find(/e-?mail/),
    name: name,
    phone: find(/phone|mobile|contact|whatsapp/),
    city: find(/city|location|town/),
    added: find(/added|date/),
  };
}

function cell(row, col) {
  return col === -1 ? "" : row[col];
}

function getRecipients(settings) {
  settings = settings || getSettings();
  const sheet = requireCustomerSheet();
  const rows = sheet.getDataRange().getValues();
  const cols = customerColumns(rows[0]);
  const unsub = getUnsubMap();

  const seen = {};
  const list = [];
  let unsubscribed = 0;
  for (let i = 1; i < rows.length; i++) {
    const email = String(cell(rows[i], cols.email) || "").trim().toLowerCase();
    if (!isEmail(email) || seen[email]) continue;
    seen[email] = true;
    if (unsub[email]) {
      unsubscribed++;
      continue;
    }
    const name = String(cell(rows[i], cols.name) || "").trim();
    list.push({ email: email, name: name || settings.defaultName, hasName: !!name });
  }
  return { sheetName: sheet.getName(), list: list, unsubscribed: unsubscribed };
}

function listCustomers() {
  const sheet = requireCustomerSheet();
  const rows = sheet.getDataRange().getValues();
  const cols = customerColumns(rows[0]);
  const unsub = getUnsubMap();

  const customers = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const email = String(cell(r, cols.email) || "").trim();
    const name = String(cell(r, cols.name) || "").trim();
    const phone = String(cell(r, cols.phone) || "").trim();
    if (!email && !name && !phone) continue;
    const added = cell(r, cols.added);
    customers.push({
      row: i + 1,
      name: name,
      email: email,
      phone: phone,
      city: String(cell(r, cols.city) || "").trim(),
      added: added instanceof Date ? added.toISOString() : String(added || ""),
      unsubscribed: !!unsub[email.toLowerCase()],
    });
  }
  return json({
    status: "success",
    customers: customers,
    sheet: sheet.getName(),
    columns: { phone: cols.phone !== -1, city: cols.city !== -1 },
  });
}

function addCustomers(data) {
  const incoming = data.customers || [];
  if (!incoming.length) throw new Error("No customers to add.");
  if (incoming.length > 5000) throw new Error("Please import at most 5000 customers at a time.");

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = requireCustomerSheet();
    const rows = sheet.getDataRange().getValues();
    const cols = customerColumns(rows[0]);
    const width = rows[0].length;
    const existing = {};
    for (let i = 1; i < rows.length; i++) {
      existing[String(cell(rows[i], cols.email) || "").trim().toLowerCase()] = true;
    }

    const out = [];
    const invalid = [];
    let duplicates = 0;
    incoming.forEach((c) => {
      const email = String(c.email || "").trim().toLowerCase();
      if (!isEmail(email)) {
        invalid.push(String(c.email || "(blank)"));
        return;
      }
      if (existing[email]) {
        duplicates++;
        return;
      }
      existing[email] = true;
      const row = new Array(width).fill("");
      row[cols.email] = email;
      if (cols.name !== -1) row[cols.name] = String(c.name || "").trim();
      // Leading apostrophe keeps numbers like +91… or 098… as typed.
      if (cols.phone !== -1 && c.phone) row[cols.phone] = "'" + String(c.phone).trim();
      if (cols.city !== -1) row[cols.city] = String(c.city || "").trim();
      if (cols.added !== -1) row[cols.added] = new Date();
      out.push(row);
    });

    if (out.length) sheet.getRange(sheet.getLastRow() + 1, 1, out.length, width).setValues(out);
    return json({ status: "success", added: out.length, duplicates: duplicates, invalid: invalid.length, invalidSamples: invalid.slice(0, 10) });
  } finally {
    lock.releaseLock();
  }
}

// Row numbers can shift if the sheet is edited elsewhere, so every edit checks
// the row still holds the email the app last saw.
function lockedCustomerRow(sheet, cols, row, originalEmail) {
  if (!(row >= 2 && row <= sheet.getLastRow())) throw new Error("Customer not found. Please refresh the list.");
  const current = String(sheet.getRange(row, cols.email + 1).getValue()).trim().toLowerCase();
  if (current !== String(originalEmail || "").trim().toLowerCase()) {
    throw new Error("This customer was changed in the sheet. Please refresh the list and try again.");
  }
}

function updateCustomer(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = requireCustomerSheet();
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const cols = customerColumns(header);
    lockedCustomerRow(sheet, cols, Number(data.row), data.originalEmail);

    const c = data.customer || {};
    const email = String(c.email || "").trim().toLowerCase();
    if (!isEmail(email)) throw new Error("Please enter a valid email address.");
    if (email !== String(data.originalEmail).trim().toLowerCase()) {
      const emails = sheet.getRange(2, cols.email + 1, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
      if (emails.some((r) => String(r[0]).trim().toLowerCase() === email)) throw new Error("Another customer already uses " + email + ".");
    }

    sheet.getRange(Number(data.row), cols.email + 1).setValue(email);
    if (cols.name !== -1) sheet.getRange(Number(data.row), cols.name + 1).setValue(String(c.name || "").trim());
    if (cols.phone !== -1) sheet.getRange(Number(data.row), cols.phone + 1).setValue(c.phone ? "'" + String(c.phone).trim() : "");
    if (cols.city !== -1) sheet.getRange(Number(data.row), cols.city + 1).setValue(String(c.city || "").trim());
    return json({ status: "success" });
  } finally {
    lock.releaseLock();
  }
}

function deleteCustomer(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = requireCustomerSheet();
    const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    lockedCustomerRow(sheet, customerColumns(header), Number(data.row), data.email);
    sheet.deleteRow(Number(data.row));
    return json({ status: "success" });
  } finally {
    lock.releaseLock();
  }
}

// ---------------- Unsubscribe ----------------

function unsubSheet() {
  return getOrCreateSheet(UNSUB_SHEET, ["Timestamp", "Email", "Source"]);
}

function getUnsubMap() {
  const rows = unsubSheet().getDataRange().getValues();
  const map = {};
  for (let i = 1; i < rows.length; i++) map[String(rows[i][1]).trim().toLowerCase()] = i + 1;
  return map;
}

function markUnsubscribed(email, source) {
  email = String(email).trim().toLowerCase();
  if (!getUnsubMap()[email]) unsubSheet().appendRow([new Date(), email, source]);
}

function setSubscription(data) {
  const email = String(data.email || "").trim().toLowerCase();
  if (!isEmail(email)) throw new Error("Invalid email.");
  if (data.subscribed) {
    const row = getUnsubMap()[email];
    if (row) unsubSheet().deleteRow(row);
  } else {
    markUnsubscribed(email, "Marked in app");
  }
  return json({ status: "success" });
}

function unsubSecret() {
  let secret = props.getProperty("unsub_secret");
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty("unsub_secret", secret);
  }
  return secret;
}

// Signed per-address token so nobody can unsubscribe someone else by editing the link.
function unsubToken(email) {
  const sig = Utilities.computeHmacSha256Signature(String(email).toLowerCase(), unsubSecret());
  return sig
    .map((b) => ((b + 256) % 256).toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 32);
}

function unsubscribeUrl(email, settings) {
  const base = props.getProperty("web_app_url") || ScriptApp.getService().getUrl();
  if (base) return base + "?action=unsubscribe&e=" + encodeURIComponent(email) + "&t=" + unsubToken(email);
  const to = settings.replyTo || ownerEmail();
  return "mailto:" + to + "?subject=Unsubscribe&body=" + encodeURIComponent("Please unsubscribe " + email);
}

function unsubscribePage(p) {
  const settings = getSettings();
  const email = String(p.e || "").trim().toLowerCase();
  const ok = isEmail(email) && p.t === unsubToken(email);
  if (ok) markUnsubscribed(email, "Email link");

  const brand = escapeHtml(settings.senderName);
  const title = ok ? "You're unsubscribed" : "This link isn't valid";
  const text = ok
    ? "<b>" + escapeHtml(email) + "</b> won't receive offer emails from " + brand + " anymore." +
      "<br><br>Changed your mind? Just reply to any of our emails and we'll add you back."
    : "The unsubscribe link looks incomplete. Please use the link from the latest email, or reply to that email and we'll remove you.";

  const html =
    '<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;font-family:Segoe UI,Helvetica,Arial,sans-serif;background:#faf5ef;">' +
    '<div style="max-width:440px;margin:48px auto;padding:40px 28px;background:#fff;border-radius:16px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08);">' +
    '<div style="font-family:Georgia,serif;font-size:18px;letter-spacing:3px;text-transform:uppercase;color:#5b3417;font-weight:700;">' + brand + "</div>" +
    '<div style="font-size:40px;margin:24px 0 8px;">' + (ok ? "👋" : "⚠️") + "</div>" +
    '<h1 style="font-size:24px;color:#111827;margin:0 0 12px;">' + title + "</h1>" +
    '<p style="font-size:15px;line-height:1.6;color:#4b5563;margin:0;">' + text + "</p>" +
    "</div></body></html>";

  return HtmlService.createHtmlOutput(html)
    .setTitle(title + " – " + settings.senderName)
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

// ---------------- Campaign storage ----------------

function getOrCreateSheet(name, header) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
  } else if (sheet.getLastColumn() < header.length) {
    // Older versions of this sheet had fewer columns – add the new headers.
    sheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold");
  }
  return sheet;
}

function campaignSheet() {
  return getOrCreateSheet(CAMPAIGN_SHEET, CAMPAIGN_HEADER);
}

function logSheet() {
  return getOrCreateSheet(LOG_SHEET, ["Timestamp", "Campaign ID", "Email", "Name", "Status", "Error"]);
}

function getCampaigns() {
  const rows = campaignSheet().getDataRange().getValues();
  const list = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    list.push({
      row: i + 1,
      created: r[0],
      id: r[1],
      festival: r[2],
      subject: r[3],
      imageId: r[4],
      logoId: r[5],
      html: r[6],
      // Campaigns from before scheduling existed have no status: treat as paused
      // so nothing is ever sent automatically without the owner pressing Resume.
      status: r[7] || PAUSED,
      scheduledAt: r[8] instanceof Date ? r[8].toISOString() : String(r[8] || ""),
    });
  }
  return list;
}

function getCampaign(id) {
  return getCampaigns().find((c) => c.id == id) || null;
}

function setCampaignStatus(campaign, status) {
  campaignSheet().getRange(campaign.row, 8).setValue(status);
  campaign.status = status;
}

function changeCampaignStatus(data, status) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const c = getCampaign(data.campaignId);
    if (!c) throw new Error("Campaign not found.");
    if (c.status === DONE) throw new Error("This campaign has already finished.");
    setCampaignStatus(c, status);
    return json({ status: "success" });
  } finally {
    lock.releaseLock();
  }
}

// Hands a paused campaign back to the background sender.
function resumeCampaign(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const c = getCampaign(data.campaignId);
    if (!c) throw new Error("Campaign not found.");
    if (c.status !== PAUSED) throw new Error("Only paused emails can be resumed.");
    ensureQueueTrigger();
    setCampaignStatus(c, SENDING);
    return json({ status: "success" });
  } finally {
    lock.releaseLock();
  }
}

// Removes a campaign that never reached anyone (scheduled, or cancelled before
// sending). Its poster goes to the Drive bin, so it can still be recovered.
function deleteCampaign(data) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const c = getCampaign(data.campaignId);
    if (!c) throw new Error("Campaign not found.");
    const attempted = Object.keys(getDoneMap()[c.id] || {}).length;
    if (c.status !== SCHEDULED && !(c.status === CANCELLED && attempted === 0)) {
      throw new Error("Only scheduled emails that haven't started can be deleted. Cancel it instead.");
    }
    [c.imageId, c.logoId].forEach((id) => {
      if (!id) return;
      try {
        DriveApp.getFileById(id).setTrashed(true);
      } catch (e) {}
    });
    campaignSheet().deleteRow(c.row);
    return json({ status: "success" });
  } finally {
    lock.releaseLock();
  }
}

// The stored email with its poster and logo inlined, ready to show in an iframe.
function campaignPreview(data) {
  const c = getCampaign(data.campaignId);
  if (!c) throw new Error("Campaign not found.");
  const dataUri = (id) => {
    if (!id) return "";
    const blob = DriveApp.getFileById(id).getBlob();
    return "data:" + blob.getContentType() + ";base64," + Utilities.base64Encode(blob.getBytes());
  };
  const html = String(c.html)
    .replace(/cid:offerImage/g, dataUri(c.imageId))
    .replace(/cid:brandLogo/g, dataUri(c.logoId));
  return json({ status: "success", html: html, subject: c.subject, festival: c.festival, campaignStatus: c.status, scheduledAt: c.scheduledAt, created: c.created });
}

function dashboard() {
  const settings = getSettings();
  const recipients = getRecipients(settings);
  const tz = Session.getScriptTimeZone();
  const thisMonth = Utilities.formatDate(new Date(), tz, "yyyy-MM");

  // One pass over the log: per-campaign results and this month's totals.
  const logRows = logSheet().getDataRange().getValues();
  const perCampaign = {};
  const month = { sent: 0, failed: 0 };
  for (let i = 1; i < logRows.length; i++) {
    const [when, id, email, , status] = logRows[i];
    const pc = perCampaign[id] || (perCampaign[id] = { sent: 0, failed: 0, done: {} });
    const ok = status === "SENT";
    if (ok) pc.sent++;
    else pc.failed++;
    pc.done[String(email).toLowerCase()] = true;
    if (when instanceof Date && Utilities.formatDate(when, tz, "yyyy-MM") === thisMonth) {
      if (ok) month.sent++;
      else month.failed++;
    }
  }

  const campaigns = getCampaigns()
    .reverse()
    .map((c) => {
      const pc = perCampaign[c.id] || { sent: 0, failed: 0, done: {} };
      const pending = c.status === DONE ? 0 : recipients.list.filter((r) => !pc.done[r.email]).length;
      return {
        id: c.id,
        created: c.created instanceof Date ? c.created.toISOString() : String(c.created),
        festival: c.festival,
        subject: c.subject,
        status: c.status,
        scheduledAt: c.scheduledAt,
        sent: pc.sent,
        failed: pc.failed,
        pending: pending,
      };
    });

  return json({
    status: "success",
    quota: getQuota(settings),
    background: hasQueueTrigger(),
    recipients: { total: recipients.list.length, unsubscribed: recipients.unsubscribed },
    month: month,
    campaigns: campaigns,
    settings: settings,
  });
}

// Map of campaignId -> { email: true } for every address already handled.
function getDoneMap() {
  const rows = logSheet().getDataRange().getValues();
  const done = {};
  for (let i = 1; i < rows.length; i++) {
    const id = rows[i][1];
    if (!done[id]) done[id] = {};
    done[id][String(rows[i][2]).toLowerCase()] = true;
  }
  return done;
}

function imageFolder() {
  if (DRIVE_FOLDER_ID) return DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const saved = props.getProperty("image_folder_id");
  if (saved) {
    try {
      return DriveApp.getFolderById(saved);
    } catch (e) {}
  }
  const folder = DriveApp.createFolder("Roast and Root Mail Images");
  props.setProperty("image_folder_id", folder.getId());
  return folder;
}

function decodeImage(data) {
  if (!data.imageBase64) throw new Error("Offer image is missing.");
  return Utilities.newBlob(
    Utilities.base64Decode(data.imageBase64),
    data.imageMime || "image/jpeg",
    data.imageName || "offer.jpg",
  );
}

function decodeLogo(data) {
  if (!data.logoBase64) return null;
  return Utilities.newBlob(Utilities.base64Decode(data.logoBase64), data.logoMime || "image/png", "logo.png");
}

// ---------------- Mail actions ----------------

function emailStatus() {
  const settings = getSettings();
  const recipients = getRecipients(settings);
  const done = getDoneMap();
  const total = recipients.list.length;

  const campaigns = getCampaigns()
    .slice(-15)
    .reverse()
    .map((c) => {
      const handled = recipients.list.filter((r) => done[c.id] && done[c.id][r.email]).length;
      return {
        id: c.id,
        created: c.created,
        festival: c.festival,
        subject: c.subject,
        status: c.status,
        scheduledAt: c.scheduledAt,
        handled: handled,
        pending: total - handled,
      };
    });

  return json({
    status: "success",
    quota: getQuota(settings),
    recipients: {
      sheet: recipients.sheetName,
      total: total,
      withoutName: recipients.list.filter((r) => !r.hasName).length,
      unsubscribed: recipients.unsubscribed,
    },
    campaigns: campaigns,
    settings: settings,
    background: hasQueueTrigger(),
  });
}

function createCampaign(data) {
  if (!data.festival || !data.html || !data.subject) throw new Error("Occasion, subject and template are required.");

  let status = SENDING;
  let scheduledAt = "";
  if (data.scheduledAt) {
    const when = new Date(data.scheduledAt);
    if (isNaN(when)) throw new Error("Invalid schedule time.");
    if (when.getTime() < Date.now() - 60000) throw new Error("The scheduled time is in the past.");
    status = SCHEDULED;
    scheduledAt = when;
  }

  // The background sender handles scheduled sends and auto-resume. A scheduled
  // campaign can't work without it, so surface that error; an immediate send can.
  try {
    ensureQueueTrigger();
  } catch (err) {
    if (status === SCHEDULED) throw err;
  }

  const id = "C" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
  const folder = imageFolder();
  const file = folder.createFile(decodeImage(data)).setName(id + " - " + data.festival);
  const logo = decodeLogo(data);
  const logoId = logo ? folder.createFile(logo).setName(id + " - logo").getId() : "";

  campaignSheet().appendRow([new Date(), id, data.festival, data.subject, file.getId(), logoId, data.html, status, scheduledAt]);

  return json({ status: "success", campaignId: id, campaignStatus: status, total: getRecipients().list.length });
}

function sendBatch(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json({ status: "busy", message: "The background sender is working. Waiting…" });

  try {
    const campaign = getCampaign(data.campaignId);
    if (!campaign) throw new Error("Campaign not found.");
    if (campaign.status === CANCELLED) throw new Error("This campaign was cancelled.");
    if (campaign.status !== SENDING && campaign.status !== DONE) setCampaignStatus(campaign, SENDING);

    return json(sendForCampaign(campaign, Number(data.batchSize) || MAX_BATCH));
  } finally {
    lock.releaseLock();
  }
}

// Sends up to `max` pending emails for one campaign, stopping at `deadline`
// (ms timestamp) if given. The caller must hold the script lock.
function sendForCampaign(campaign, max, deadline) {
  const settings = getSettings();
  const done = getDoneMap()[campaign.id] || {};
  const pendingList = getRecipients(settings).list.filter((r) => !done[r.email]);
  let quota = getQuota(settings);
  const out = { sent: 0, failed: 0, results: [], pending: pendingList.length, quota: quota };

  if (pendingList.length === 0) {
    if (campaign.status !== DONE) setCampaignStatus(campaign, DONE);
    out.status = "complete";
    return out;
  }
  if (quota.left === 0) {
    out.status = "quota_exceeded";
    return out;
  }

  const batch = pendingList.slice(0, Math.min(max, quota.left));
  const image = DriveApp.getFileById(campaign.imageId).getBlob();
  const logo = campaign.logoId ? DriveApp.getFileById(campaign.logoId).getBlob() : null;
  const log = logSheet();

  for (let i = 0; i < batch.length; i++) {
    if (deadline && Date.now() > deadline) break;
    const r = batch[i];
    try {
      sendOne(r, campaign.subject, campaign.html, image, logo, settings);
      log.appendRow([new Date(), campaign.id, r.email, r.name, "SENT", ""]);
      out.results.push({ email: r.email, name: r.name, ok: true });
      out.sent++;
    } catch (err) {
      log.appendRow([new Date(), campaign.id, r.email, r.name, "FAILED", String(err.message || err)]);
      out.results.push({ email: r.email, name: r.name, ok: false, error: String(err.message || err) });
      out.failed++;
    }
    // Failed sends still count against Gmail's quota, so count every attempt.
    addSentToday(1);
    Utilities.sleep(250);
  }

  out.quota = getQuota(settings);
  out.pending = pendingList.length - out.sent - out.failed;
  if (out.pending === 0) setCampaignStatus(campaign, DONE);
  out.status = out.pending === 0 ? "complete" : out.quota.left === 0 ? "quota_exceeded" : "partial";
  return out;
}

function sendTest(data) {
  const settings = getSettings();
  const quota = getQuota(settings);
  if (quota.left === 0) return json({ status: "quota_exceeded", quota: quota });

  const to = String(data.to || ownerEmail()).trim();
  if (!isEmail(to)) throw new Error("Enter a valid test email address.");

  sendOne({ email: to, name: data.testName || settings.defaultName }, "[TEST] " + data.subject, data.html, decodeImage(data), decodeLogo(data), settings);
  addSentToday(1);
  return json({ status: "success", to: to, quota: getQuota(settings) });
}

function sendOne(recipient, subject, html, imageBlob, logoBlob, settings) {
  const unsub = unsubscribeUrl(recipient.email, settings);
  const options = {
    to: recipient.email,
    subject: subject.replace(/\{\{NAME\}\}/g, recipient.name),
    htmlBody: html.replace(/\{\{NAME\}\}/g, escapeHtml(recipient.name)).replace(/\{\{UNSUBSCRIBE_URL\}\}/g, escapeHtml(unsub)),
    body:
      "Hello " + recipient.name + ", we have a special offer for you from " + settings.senderName +
      ". Please view this email in an HTML-capable mail app to see it.\n\nUnsubscribe: " + unsub,
    name: settings.senderName,
    inlineImages: { offerImage: imageBlob },
  };
  if (logoBlob) options.inlineImages.brandLogo = logoBlob;
  if (settings.replyTo) options.replyTo = settings.replyTo;
  MailApp.sendEmail(options);
}

// ---------------- Helpers ----------------

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// The sending account's address. Needs Google's separate "see your email"
// permission, so it must never break a page when that isn't granted.
function ownerEmail() {
  try {
    return Session.getEffectiveUser().getEmail() || "";
  } catch (e) {
    return "";
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------- One-time setup (run from the editor) ----------------

// Run ONCE to tidy the spreadsheet for the mail app:
//  1. saves a full backup copy of the spreadsheet to your Drive,
//  2. deletes the old inventory tabs (PRODUCTS, STOCK_ENTRY, SALES),
//  3. creates a CUSTOMERS tab (or renames an existing tab with an Email column),
//  4. creates the CAMPAIGNS, EMAIL_LOG and UNSUBSCRIBED tabs used for tracking.
// USERS (login PINs) is kept.
function setupSheets() {
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm");
  const backup = ss.copy(ss.getName() + " - backup " + stamp);
  Logger.log("Backup saved: " + backup.getUrl());

  ["PRODUCTS", "STOCK_ENTRY", "SALES"].forEach((name) => {
    const sheet = ss.getSheetByName(name);
    if (sheet) {
      ss.deleteSheet(sheet);
      Logger.log("Deleted sheet: " + name);
    }
  });

  let customers = ss.getSheetByName(CUSTOMER_SHEET_NAME);
  if (!customers) {
    const existing = findCustomerSheet();
    if (existing) {
      existing.setName(CUSTOMER_SHEET_NAME);
      customers = existing;
      Logger.log("Renamed existing customer sheet to " + CUSTOMER_SHEET_NAME);
    } else {
      customers = ss.insertSheet(CUSTOMER_SHEET_NAME, 0);
      customers.appendRow(["Name", "Email", "Phone", "City", "Added On"]);
      Logger.log("Created sheet: " + CUSTOMER_SHEET_NAME);
    }
  }

  const lastCol = Math.max(customers.getLastColumn(), 1);
  customers.setFrozenRows(1);
  customers
    .getRange(1, 1, 1, lastCol)
    .setFontWeight("bold")
    .setBackground("#5b3417")
    .setFontColor("#ffffff");
  customers.getRange(1, 1).setNote("Only the Email column is required. If Name is blank the email uses the default name from Settings.");
  const header = customers.getRange(1, 1, 1, lastCol).getValues()[0];
  const emailCol = header.findIndex((h) => /e-?mail/i.test(String(h))) + 1;
  if (emailCol > 0) {
    customers
      .getRange(2, emailCol, customers.getMaxRows() - 1, 1)
      .setDataValidation(SpreadsheetApp.newDataValidation().requireTextIsEmail().setAllowInvalid(false).build());
  }
  customers.setColumnWidths(1, lastCol, 180);
  ss.setActiveSheet(customers);

  campaignSheet();
  logSheet();
  unsubSheet();
  Logger.log("Done. Add your customers to the " + CUSTOMER_SHEET_NAME + " sheet.");
}

// Run after every code update that needs new permissions. Approve with
// "Select all" on Google's screen, then deploy a new version.
function authorize() {
  imageFolder();
  campaignSheet();
  unsubSheet();
  ensureQueueTrigger();
  Logger.log("Quota left today: " + MailApp.getRemainingDailyQuota());
  Logger.log("Customer sheet: " + (findCustomerSheet() ? findCustomerSheet().getName() : "NOT FOUND"));
  Logger.log("Background sender: " + (hasQueueTrigger() ? "ON (every " + QUEUE_EVERY_MINUTES + " min)" : "OFF"));
}
