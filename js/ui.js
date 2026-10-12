// Shared UI helpers: escaping, confirm dialog, busy buttons and friendly errors.

const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

function showConfirm(message, title, okText, { danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "custom-alert-overlay";
    overlay.innerHTML = `<div class="custom-alert-box">
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="confirm-actions">
          <button type="button" class="btn-secondary" data-ok="0">Cancel</button>
          <button type="button" data-ok="1"${danger ? ' class="btn-danger"' : ""}>${okText}</button>
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

function setBusy(btn, busy, text) {
  btn.disabled = busy;
  if (busy) {
    btn.dataset.html = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${text}`;
  } else if (btn.dataset.html) {
    btn.innerHTML = btn.dataset.html;
  }
}

// Turn backend/network errors into plain-language explanations with fix steps.
function friendlyError(raw) {
  const redeploy = "In the editor: Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.";
  if (/permission to call|authoriz|Required permissions/i.test(raw)) {
    // Google's message names the call and the missing scope; translate both.
    const scopeNames = {
      "script.send_mail": "send email",
      "gmail.send": "send email",
      drive: "save posters to Google Drive",
      "script.scriptapp": "run scheduled sends in the background",
      "userinfo.email": "see which Google account it runs as",
      spreadsheets: "read and update your spreadsheet",
    };
    const scopes = [...new Set((raw.match(/auth\/([\w.]+)/g) || []).map((s) => s.slice(5)))];
    const named = scopes.map((s) => scopeNames[s] || scopeNames[s.split(".")[0]]).filter(Boolean);
    const call = (raw.match(/permission to call ([\w.]+)/i) || [])[1] || "";
    const fallback = /MailApp|GmailApp/.test(call)
      ? "send email"
      : /DriveApp/.test(call)
        ? "save posters to Google Drive"
        : /ScriptApp/.test(call)
          ? "run scheduled sends in the background"
          : /Session/.test(call)
            ? "see which Google account it runs as"
            : "do this";
    const what = named.length ? [...new Set(named)].join(" and ") : fallback;
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
      title: "The server needs updating",
      text: "The Apps Script running online is an older version than this page expects.",
      steps: ["Paste the latest Code.gs into the Apps Script editor and save.", "Run the authorize function once and approve.", redeploy, "Click Try again."],
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
    title: "Something went wrong",
    text: "Something went wrong while talking to the spreadsheet.",
    steps: ["Click Try again.", "If it keeps happening, share the technical details below with your developer."],
  };
}

// Pop-up for errors during actions. Known problems get fix steps; anything
// else (e.g. "Enter a valid test email address.") is already readable as-is.
function showFriendlyError(err, title, extra = "") {
  const raw = (err && err.message) || String(err);
  const f = friendlyError(raw);
  const body = f.generic
    ? escapeHtml(raw)
    : `${escapeHtml(f.text)}<ol class="alert-steps">${f.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>`;
  showCustomAlert(body + (extra ? `<br><br>${extra}` : ""), f.generic ? title : f.title, "error");
}

// Fills a page's error banner (see .error-banner markup) for load failures.
function renderErrorBanner(raw, fallbackTitle) {
  const f = friendlyError(raw);
  $("statusErrorTitle").textContent = f.generic ? fallbackTitle : f.title;
  $("statusErrorText").textContent = f.generic ? raw : f.text;
  $("statusErrorSteps").innerHTML = f.steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  $("statusErrorRaw").textContent = raw;
  $("statusError").hidden = false;
}
