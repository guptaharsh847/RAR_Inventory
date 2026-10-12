// Dashboard – today's quota, schedule, monthly totals and every email campaign
// with preview, pause/resume/cancel and delete for scheduled emails.

const STATUS = {
  SCHEDULED: { label: "Scheduled", pill: "pill-blue" },
  SENDING: { label: "Sending", pill: "pill-green" },
  PAUSED: { label: "Paused", pill: "pill-amber" },
  DONE: { label: "Completed", pill: "" },
  CANCELLED: { label: "Cancelled", pill: "pill-red" },
};

const FILTERS = [
  { key: "all", label: "All", match: () => true },
  { key: "scheduled", label: "Scheduled", match: (c) => c.status === "SCHEDULED" },
  { key: "active", label: "In progress", match: (c) => c.status === "SENDING" || c.status === "PAUSED" },
  { key: "done", label: "Completed", match: (c) => c.status === "DONE" },
  { key: "cancelled", label: "Cancelled", match: (c) => c.status === "CANCELLED" },
];

const ICON = {
  eye: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>',
  pause: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>',
  play: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>',
  stop: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>',
};

const dash = { data: null, filter: "all", previews: {} };

function formatWhen(d) {
  return new Date(d).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

function formatDay(d) {
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function setGreeting() {
  const h = new Date().getHours();
  $("greeting").textContent = h < 12 ? "Good morning ☀️" : h < 17 ? "Good afternoon 👋" : "Good evening 🌙";
}

// ---------------- Load & render ----------------

async function loadDashboard() {
  try {
    dash.data = await apiPost("dashboard");
    $("statusError").hidden = true;
    renderStats();
    renderTabs();
    renderCampaigns();
  } catch (err) {
    renderErrorBanner(err.message, "Couldn't load the dashboard");
    $("campaignList").innerHTML = '<div class="list-empty">Emails couldn\'t be loaded.</div>';
  }
}

function renderStats() {
  const { quota, recipients, month, campaigns, background } = dash.data;

  const pct = quota.limit ? (quota.left / quota.limit) * 100 : 0;
  const ring = $("quotaRing");
  ring.style.setProperty("--pct", pct);
  ring.classList.toggle("low", quota.left > 0 && pct <= 20);
  ring.classList.toggle("empty", quota.left === 0);
  $("quotaLeft").textContent = quota.left;
  $("quotaText").textContent = quota.left === 0 ? "Quota completed" : `${quota.left} of ${quota.limit} left`;
  $("quotaSub").textContent = quota.left === 0 ? "Sending resumes after midnight" : `${quota.sentToday} sent today`;

  const scheduled = campaigns.filter((c) => c.status === "SCHEDULED").sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt));
  const active = campaigns.filter((c) => c.status === "SENDING").length;
  $("schedText").textContent = scheduled.length ? `${scheduled.length} upcoming` : "Nothing scheduled";
  $("schedSub").textContent = scheduled.length
    ? `Next: ${formatWhen(scheduled[0].scheduledAt)}`
    : active
      ? `${active} email${active === 1 ? "" : "s"} sending now`
      : "Schedule one from Festive Mail";

  $("monthText").textContent = `${month.sent} email${month.sent === 1 ? "" : "s"}`;
  $("monthSub").textContent = month.failed ? `${month.failed} couldn't be delivered` : "All delivered";

  $("custText").textContent = `${recipients.total}`;
  $("custSub").innerHTML = `subscribed${recipients.unsubscribed ? ` · ${recipients.unsubscribed} unsubscribed` : ""} · <a href="customers.html">Manage</a>`;

  const chip = $("bgChip");
  chip.className = "badge bg-chip " + (background ? "on" : "off");
  chip.innerHTML = background
    ? '<span class="dot"></span> Background sender on'
    : '<span class="dot"></span> Background sender off · <a href="settings.html">Turn on</a>';
}

function renderTabs() {
  $("filterTabs").innerHTML = FILTERS.map((f) => {
    const n = dash.data.campaigns.filter(f.match).length;
    return `<button type="button" role="tab" data-filter="${f.key}" class="${f.key === dash.filter ? "active" : ""}" aria-selected="${f.key === dash.filter}">${f.label}<span class="count">${n}</span></button>`;
  }).join("");
}

function campaignActions(c) {
  const btn = (act, icon, label, danger = false) =>
    `<button type="button" class="icon-btn${danger ? " danger" : ""}" data-act="${act}" data-id="${escapeHtml(c.id)}" title="${label}" aria-label="${label}">${icon}</button>`;
  const out = [btn("preview", ICON.eye, "Preview email")];
  if (c.status === "SENDING") out.push(btn("pause", ICON.pause, "Pause"));
  if (c.status === "PAUSED") out.push(btn("resume", ICON.play, "Resume"), btn("cancel", ICON.stop, "Cancel", true));
  if (c.status === "SCHEDULED" || (c.status === "CANCELLED" && c.sent + c.failed === 0)) out.push(btn("delete", ICON.trash, "Delete", true));
  return out.join("");
}

function campaignProgress(c) {
  const total = c.sent + c.failed + c.pending;
  if (c.status === "SCHEDULED") return `<span>Waiting · goes to <b>${c.pending}</b> customer${c.pending === 1 ? "" : "s"}</span>`;
  const pct = total ? ((c.sent + c.failed) / total) * 100 : 100;
  const failed = c.failed ? ` · ${c.failed} failed` : "";
  const left = c.pending && c.status !== "DONE" ? ` · ${c.pending} left` : "";
  return `<span><b>${c.sent}</b> sent${failed}${left}</span><div class="progress-bar"><div style="width:${pct}%"></div></div>`;
}

function renderCampaigns() {
  const filter = FILTERS.find((f) => f.key === dash.filter);
  const list = dash.data.campaigns.filter(filter.match);
  if (!list.length) {
    $("campaignList").innerHTML = dash.data.campaigns.length
      ? '<div class="list-empty">No emails in this view.</div>'
      : '<div class="list-empty"><b>No emails yet.</b><br><a href="campaign.html">Create your first festive email</a></div>';
    return;
  }
  $("campaignList").innerHTML = list
    .map((c) => {
      const s = STATUS[c.status] || { label: c.status, pill: "" };
      const when = c.status === "SCHEDULED" ? `Sends ${formatWhen(c.scheduledAt)}` : `Created ${formatDay(c.created)}`;
      return `<div class="camp-row">
        <div style="min-width:0">
          <div class="camp-title">${escapeHtml(c.festival)}<span class="pill ${s.pill}">${s.label}</span></div>
          <div class="camp-meta">${escapeHtml(when)} · ${escapeHtml(String(c.subject).replace(/\{\{NAME\}\}/g, "…"))}</div>
        </div>
        <div class="camp-progress">${campaignProgress(c)}</div>
        <div class="row-actions">${campaignActions(c)}</div>
      </div>`;
    })
    .join("");
}

// ---------------- Preview ----------------

function closePreview() {
  $("previewModal").classList.remove("show");
}

async function openPreview(id) {
  const c = dash.data.campaigns.find((x) => x.id === id);
  if (!c) return;
  const s = STATUS[c.status] || { label: c.status };
  $("pvTitle").textContent = c.festival;
  $("pvMeta").textContent =
    `${s.label} · ` + (c.status === "SCHEDULED" ? `sends ${formatWhen(c.scheduledAt)}` : `created ${formatDay(c.created)}`) + ` · “${String(c.subject).replace(/\{\{NAME\}\}/g, "…")}”`;
  $("pvFoot").innerHTML =
    (c.status === "SCHEDULED" ? `<button type="button" class="btn-secondary danger-text" data-act="delete" data-id="${escapeHtml(c.id)}">${ICON.trash} Delete</button>` : "") +
    '<button type="button" class="btn-primary-sm" data-close>Close</button>';
  $("pvFrame").hidden = true;
  $("pvLoading").hidden = false;
  $("pvLoading").textContent = "Loading preview…";
  $("previewModal").classList.add("show");

  try {
    if (!dash.previews[id]) dash.previews[id] = (await apiPost("campaign_preview", { campaignId: id })).html;
    const name = (dash.data.settings && dash.data.settings.defaultName) || "Valued Customer";
    $("pvFrame").srcdoc = dash.previews[id].replace(/\{\{NAME\}\}/g, escapeHtml(name)).replace(/\{\{UNSUBSCRIBE_URL\}\}/g, "#");
    $("pvFrame").hidden = false;
    $("pvLoading").hidden = true;
  } catch (err) {
    const f = friendlyError(err.message);
    $("pvLoading").textContent = f.generic ? err.message : f.text;
  }
}

// ---------------- Actions ----------------

async function onAction(e) {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.dataset.id;
  const c = dash.data.campaigns.find((x) => x.id === id);
  if (!c) return;
  const name = `<b>${escapeHtml(c.festival)}</b>`;

  if (btn.dataset.act === "preview") return openPreview(id);

  const actions = {
    delete: {
      confirm: [`Delete the ${name} email? It won't be sent, and its poster moves to your Google Drive bin.`, "Delete scheduled email?", "Delete", { danger: true }],
      call: "delete_campaign",
    },
    cancel: {
      confirm: [`Stop the ${name} email? The ${c.pending} customer${c.pending === 1 ? "" : "s"} who haven't received it won't get it.`, "Cancel this email?", "Yes, cancel", { danger: true }],
      call: "cancel_campaign",
    },
    pause: { call: "pause_campaign" },
    resume: { call: "resume_campaign" },
  };
  const a = actions[btn.dataset.act];
  if (!a) return;
  if (a.confirm && !(await showConfirm(...a.confirm))) return;

  btn.disabled = true;
  try {
    await apiPost(a.call, { campaignId: id });
    closePreview();
    delete dash.previews[id];
    await loadDashboard();
    if (btn.dataset.act === "resume") {
      showCustomAlert(`${name} will continue in the background within 15 minutes.`, "Resumed", "success");
    }
  } catch (err) {
    btn.disabled = false;
    showFriendlyError(err, "Couldn't update the email");
  }
}

// ---------------- Init ----------------

setGreeting();
$("filterTabs").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-filter]");
  if (!b) return;
  dash.filter = b.dataset.filter;
  renderTabs();
  renderCampaigns();
});
$("campaignList").addEventListener("click", onAction);
$("pvFoot").addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) return closePreview();
  onAction(e);
});
$("previewModal").addEventListener("click", (e) => {
  if (e.target === $("previewModal") || e.target.closest(".preview-dialog-head [data-close]")) closePreview();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closePreview();
});
$("pvFrame").addEventListener("load", () => {
  const doc = $("pvFrame").contentDocument;
  const fit = () => ($("pvFrame").style.height = doc.documentElement.scrollHeight + "px");
  fit();
  doc.querySelectorAll("img").forEach((img) => img.addEventListener("load", fit));
});

loadDashboard();
