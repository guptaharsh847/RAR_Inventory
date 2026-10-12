/**
 * Roast and Roots – Apps Script backend
 * Features: PIN login + Festive Mail campaigns (labels are generated client-side).
 *
 * Paste this whole file into the Apps Script editor bound to the spreadsheet,
 * then Deploy → Manage deployments → Edit → New version.
 */

// ===================== CONFIG =====================
// Sheet holding your customers (created by setupSheets). If it doesn't exist, the
// first sheet whose header row has an "Email" column is used instead.
const CUSTOMER_SHEET_NAME = "CUSTOMERS";
// Name shown as the sender in the customer's inbox.
const SENDER_NAME = "Roast and Roots";
// Optional reply-to address ("" = your own Gmail).
const REPLY_TO = "";
// Self-imposed daily cap. Free Gmail allows ~100 recipients/day through Apps
// Script, Google Workspace ~1500. Keep a margin so your account is never flagged.
const DAILY_LIMIT = 90;
// Emails sent per request from the web app (keeps each call well under 6 min).
const MAX_BATCH = 10;
// Name used when a customer row has no name.
const DEFAULT_NAME = "Valued Customer";
// Drive folder for uploaded offer images. "" = auto-create "Roast and Roots Mail Images".
const DRIVE_FOLDER_ID = "";

const SESSION_DAYS = 7;
const CAMPAIGN_SHEET = "CAMPAIGNS";
const LOG_SHEET = "EMAIL_LOG";
const SYSTEM_SHEETS = ["USERS", CAMPAIGN_SHEET, LOG_SHEET];
// ==================================================

const ss = SpreadsheetApp.getActiveSpreadsheet();
const props = PropertiesService.getScriptProperties();

function doGet(e) {
  return json({ status: "ok" });
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action == "login") return login(data);

    if (!isValidToken(data.token)) {
      return json({ status: "unauthorized", message: "Session expired. Please sign in again." });
    }

    if (data.action == "email_status") return emailStatus();
    if (data.action == "create_campaign") return createCampaign(data);
    if (data.action == "send_batch") return sendBatch(data);
    if (data.action == "send_test") return sendTest(data);

    return json({ status: "error", message: "Unknown action" });
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

// ---------------- Quota ----------------

function todayKey() {
  return "sent_" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
}

function getQuota() {
  const sentToday = Number(props.getProperty(todayKey())) || 0;
  const googleLeft = MailApp.getRemainingDailyQuota();
  const left = Math.max(0, Math.min(DAILY_LIMIT - sentToday, googleLeft));
  return { limit: DAILY_LIMIT, sentToday: sentToday, left: left };
}

function addSentToday(n) {
  const key = todayKey();
  props.setProperty(key, String((Number(props.getProperty(key)) || 0) + n));
}

// ---------------- Recipients ----------------

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

function getRecipients() {
  const sheet = findCustomerSheet();
  if (!sheet) throw new Error("No customer sheet found. Add a sheet with an 'Email' column.");

  const rows = sheet.getDataRange().getValues();
  const header = rows[0].map((h) => String(h).trim().toLowerCase());
  const emailCol = header.findIndex((h) => /e-?mail/.test(h));
  let nameCol = header.findIndex((h) => /^(customer |user |full |client )?name$/.test(h));
  if (nameCol === -1) nameCol = header.findIndex((h) => /name/.test(h) && !/e-?mail/.test(h));

  const seen = {};
  const list = [];
  for (let i = 1; i < rows.length; i++) {
    const email = String(rows[i][emailCol] || "").trim().toLowerCase();
    if (!isEmail(email) || seen[email]) continue;
    seen[email] = true;
    const name = nameCol === -1 ? "" : String(rows[i][nameCol] || "").trim();
    list.push({ email: email, name: name || DEFAULT_NAME });
  }
  return { sheetName: sheet.getName(), list: list };
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// ---------------- Campaign storage ----------------

function getOrCreateSheet(name, header) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
  }
  return sheet;
}

function campaignSheet() {
  return getOrCreateSheet(CAMPAIGN_SHEET, ["Created", "Campaign ID", "Occasion", "Subject", "Image File ID", "Logo File ID", "HTML"]);
}

function logSheet() {
  return getOrCreateSheet(LOG_SHEET, ["Timestamp", "Campaign ID", "Email", "Name", "Status", "Error"]);
}

function getCampaign(id) {
  const rows = campaignSheet().getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] == id) {
      return {
        created: rows[i][0],
        id: rows[i][1],
        festival: rows[i][2],
        subject: rows[i][3],
        imageId: rows[i][4],
        logoId: rows[i][5],
        html: rows[i][6],
      };
    }
  }
  return null;
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
  const folder = DriveApp.createFolder("Roast and Roots Mail Images");
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

// ---------------- Actions ----------------

function emailStatus() {
  const recipients = getRecipients();
  const done = getDoneMap();
  const total = recipients.list.length;

  const rows = campaignSheet().getDataRange().getValues();
  const campaigns = [];
  for (let i = rows.length - 1; i >= 1 && campaigns.length < 10; i--) {
    const id = rows[i][1];
    const handled = recipients.list.filter((r) => done[id] && done[id][r.email]).length;
    campaigns.push({
      id: id,
      created: rows[i][0],
      festival: rows[i][2],
      subject: rows[i][3],
      handled: handled,
      pending: total - handled,
    });
  }

  return json({
    status: "success",
    quota: getQuota(),
    recipients: {
      sheet: recipients.sheetName,
      total: total,
      withoutName: recipients.list.filter((r) => r.name === DEFAULT_NAME).length,
    },
    campaigns: campaigns,
  });
}

function createCampaign(data) {
  if (!data.festival || !data.html || !data.subject) throw new Error("Festival, subject and template are required.");

  const id = "C" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
  const folder = imageFolder();
  const file = folder.createFile(decodeImage(data)).setName(id + " - " + data.festival);
  const logo = decodeLogo(data);
  const logoId = logo ? folder.createFile(logo).setName(id + " - logo").getId() : "";

  campaignSheet().appendRow([new Date(), id, data.festival, data.subject, file.getId(), logoId, data.html]);

  return json({ status: "success", campaignId: id, total: getRecipients().list.length });
}

function sendBatch(data) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) return json({ status: "busy", message: "Another send is in progress." });

  try {
    const campaign = getCampaign(data.campaignId);
    if (!campaign) throw new Error("Campaign not found.");

    const done = getDoneMap()[campaign.id] || {};
    const pendingList = getRecipients().list.filter((r) => !done[r.email]);
    let quota = getQuota();

    if (pendingList.length === 0) {
      return json({ status: "complete", sent: 0, failed: 0, pending: 0, quota: quota });
    }
    if (quota.left === 0) {
      return json({ status: "quota_exceeded", sent: 0, failed: 0, pending: pendingList.length, quota: quota });
    }

    const size = Math.min(Number(data.batchSize) || MAX_BATCH, MAX_BATCH, quota.left);
    const batch = pendingList.slice(0, size);
    const image = DriveApp.getFileById(campaign.imageId).getBlob();
    const logo = campaign.logoId ? DriveApp.getFileById(campaign.logoId).getBlob() : null;
    const log = logSheet();
    const results = [];
    let sent = 0;
    let failed = 0;

    batch.forEach((r) => {
      try {
        sendOne(r, campaign.subject, campaign.html, image, logo);
        log.appendRow([new Date(), campaign.id, r.email, r.name, "SENT", ""]);
        results.push({ email: r.email, name: r.name, ok: true });
        sent++;
      } catch (err) {
        log.appendRow([new Date(), campaign.id, r.email, r.name, "FAILED", String(err.message || err)]);
        results.push({ email: r.email, name: r.name, ok: false, error: String(err.message || err) });
        failed++;
      }
      Utilities.sleep(250);
    });

    // Failed sends still count against Gmail's quota, so count every attempt.
    addSentToday(sent + failed);
    quota = getQuota();
    const pending = pendingList.length - batch.length;

    return json({
      status: pending === 0 ? "complete" : quota.left === 0 ? "quota_exceeded" : "partial",
      sent: sent,
      failed: failed,
      pending: pending,
      results: results,
      quota: quota,
    });
  } finally {
    lock.releaseLock();
  }
}

function sendTest(data) {
  const quota = getQuota();
  if (quota.left === 0) return json({ status: "quota_exceeded", quota: quota });

  const to = String(data.to || Session.getEffectiveUser().getEmail()).trim();
  if (!isEmail(to)) throw new Error("Enter a valid test email address.");

  sendOne({ email: to, name: data.testName || DEFAULT_NAME }, "[TEST] " + data.subject, data.html, decodeImage(data), decodeLogo(data));
  addSentToday(1);
  return json({ status: "success", to: to, quota: getQuota() });
}

function sendOne(recipient, subject, html, imageBlob, logoBlob) {
  const name = escapeHtml(recipient.name);
  const options = {
    to: recipient.email,
    subject: subject.replace(/\{\{NAME\}\}/g, recipient.name),
    htmlBody: html.replace(/\{\{NAME\}\}/g, name),
    body: "Hello " + recipient.name + ", we have a special offer for you from " + SENDER_NAME + ". Please view this email in an HTML-capable mail app to see it.",
    name: SENDER_NAME,
    inlineImages: { offerImage: imageBlob },
  };
  if (logoBlob) options.inlineImages.brandLogo = logoBlob;
  if (REPLY_TO) options.replyTo = REPLY_TO;
  MailApp.sendEmail(options);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// Run ONCE from the editor to tidy the spreadsheet for the mail app:
//  1. saves a full backup copy of the spreadsheet to your Drive,
//  2. deletes the old inventory tabs (PRODUCTS, STOCK_ENTRY, SALES),
//  3. creates a CUSTOMERS tab (or renames an existing tab with an Email column),
//  4. creates the CAMPAIGNS and EMAIL_LOG tabs used for tracking.
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
  customers.getRange(1, 1).setNote("Only the Email column is required. If Name is blank the email says 'Dear " + DEFAULT_NAME + "'.");
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
  Logger.log("Done. Add your customers to the " + CUSTOMER_SHEET_NAME + " sheet.");
}

// Run once from the editor to grant Gmail + Drive permissions before deploying.
function authorize() {
  imageFolder();
  Logger.log("Quota left today: " + MailApp.getRemainingDailyQuota());
  Logger.log("Customer sheet: " + (findCustomerSheet() ? findCustomerSheet().getName() : "NOT FOUND"));
}
