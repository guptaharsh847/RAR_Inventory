// Customers – list, search, add, edit, delete, (un)subscribe and import from Excel/CSV.

const PAGE_SIZE = 50;
const IMPORT_CHUNK = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cs = {
  customers: [],
  columns: { phone: true, city: true },
  shown: PAGE_SIZE,
  editing: null, // customer being edited, or null when adding
  importNew: [],
};

const ICONS = {
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
  mailOff: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg>',
  mailOn: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>',
};

// ---------------- Load & render ----------------

async function loadCustomers() {
  try {
    const data = await apiPost("list_customers");
    cs.customers = data.customers;
    cs.columns = data.columns;
    $("statusError").hidden = true;
    render();
  } catch (err) {
    renderErrorBanner(err.message, "Couldn't load your customers");
    $("customerList").innerHTML = '<div class="list-empty">Customers couldn\'t be loaded.</div>';
  }
}

function filtered() {
  const q = $("search").value.trim().toLowerCase();
  const f = $("filter").value;
  return cs.customers.filter((c) => {
    if (f === "subscribed" && c.unsubscribed) return false;
    if (f === "unsubscribed" && !c.unsubscribed) return false;
    if (!q) return true;
    return [c.name, c.email, c.phone, c.city].some((v) => String(v).toLowerCase().includes(q));
  });
}

function render() {
  const all = cs.customers;
  $("statTotal").textContent = all.length;
  $("statSubscribed").textContent = all.filter((c) => !c.unsubscribed && EMAIL_RE.test(c.email)).length;
  $("statUnsubscribed").textContent = all.filter((c) => c.unsubscribed).length;
  $("statNoName").textContent = all.filter((c) => !c.name).length;

  const list = filtered();
  if (!list.length) {
    $("customerList").innerHTML = all.length
      ? '<div class="list-empty">No customers match your search.</div>'
      : '<div class="list-empty"><b>No customers yet.</b><br>Add them one by one or import an Excel / CSV file.</div>';
    $("showMore").hidden = true;
    return;
  }

  $("customerList").innerHTML = list
    .slice(0, cs.shown)
    .map((c) => {
      const meta = [c.phone, c.city].filter(Boolean).map(escapeHtml).join(" · ");
      const bad = !EMAIL_RE.test(c.email);
      return `<div class="cust-row${c.unsubscribed ? " is-unsub" : ""}">
        <div class="cust-avatar">${escapeHtml((c.name || c.email || "?").charAt(0).toUpperCase())}</div>
        <div class="cust-main">
          <div class="cust-name">${c.name ? escapeHtml(c.name) : '<span class="muted">No name</span>'}
            ${c.unsubscribed ? '<span class="pill pill-amber">Unsubscribed</span>' : ""}
            ${bad ? '<span class="pill pill-red">Invalid email</span>' : ""}</div>
          <div class="cust-email">${escapeHtml(c.email || "—")}</div>
          ${meta ? `<div class="cust-meta">${meta}</div>` : ""}
        </div>
        <div class="row-actions">
          <button type="button" class="icon-btn" data-act="edit" data-row="${c.row}" title="Edit" aria-label="Edit">${ICONS.edit}</button>
          <button type="button" class="icon-btn" data-act="sub" data-row="${c.row}" title="${c.unsubscribed ? "Subscribe again" : "Unsubscribe"}" aria-label="${c.unsubscribed ? "Subscribe again" : "Unsubscribe"}">${c.unsubscribed ? ICONS.mailOn : ICONS.mailOff}</button>
          <button type="button" class="icon-btn danger" data-act="delete" data-row="${c.row}" title="Delete" aria-label="Delete">${ICONS.trash}</button>
        </div>
      </div>`;
    })
    .join("");

  const rest = list.length - cs.shown;
  $("showMore").hidden = rest <= 0;
  $("showMore").textContent = `Show ${Math.min(rest, PAGE_SIZE)} more (${rest} left)`;
}

// ---------------- Modals ----------------

function openModal(id) {
  $(id).classList.add("show");
}

function closeModal(id) {
  $(id).classList.remove("show");
}

document.querySelectorAll(".custom-alert-overlay[id]").forEach((overlay) => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay || e.target.closest("[data-close]")) closeModal(overlay.id);
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") ["customerModal", "importModal"].forEach(closeModal);
});

// ---------------- Add / edit ----------------

function openCustomerForm(customer) {
  cs.editing = customer || null;
  $("customerModalTitle").textContent = customer ? "Edit customer" : "Add customer";
  $("cName").value = customer ? customer.name : "";
  $("cEmail").value = customer ? customer.email : "";
  $("cPhone").value = customer ? customer.phone : "";
  $("cCity").value = customer ? customer.city : "";
  $("cPhoneWrap").hidden = !cs.columns.phone;
  $("cCityWrap").hidden = !cs.columns.city;
  $("customerFormError").hidden = true;
  openModal("customerModal");
  setTimeout(() => $("cName").focus(), 50);
}

function formError(msg) {
  $("customerFormError").textContent = msg;
  $("customerFormError").hidden = false;
}

async function saveCustomer(e) {
  e.preventDefault();
  const customer = {
    name: $("cName").value.trim(),
    email: $("cEmail").value.trim().toLowerCase(),
    phone: $("cPhone").value.trim(),
    city: $("cCity").value.trim(),
  };
  if (!EMAIL_RE.test(customer.email)) return formError("Please enter a valid email address.");

  const btn = $("customerSave");
  setBusy(btn, true, "Saving");
  try {
    if (cs.editing) {
      await apiPost("update_customer", { row: cs.editing.row, originalEmail: cs.editing.email, customer });
    } else {
      const res = await apiPost("add_customers", { customers: [customer] });
      if (!res.added) return formError(`${customer.email} is already in your customer list.`);
    }
    closeModal("customerModal");
    await loadCustomers();
  } catch (err) {
    const fe = friendlyError(err.message);
    formError(fe.generic ? err.message : fe.text);
  } finally {
    setBusy(btn, false);
  }
}

// ---------------- Row actions ----------------

async function onRowAction(e) {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const c = cs.customers.find((x) => x.row === Number(btn.dataset.row));
  if (!c) return;
  const who = escapeHtml(c.name || c.email);

  if (btn.dataset.act === "edit") return openCustomerForm(c);

  if (btn.dataset.act === "delete") {
    const ok = await showConfirm(`Delete <b>${who}</b> from your customer list? This removes the row from the sheet.`, "Delete customer?", "Delete", { danger: true });
    if (!ok) return;
    try {
      await apiPost("delete_customer", { row: c.row, email: c.email });
      await loadCustomers();
    } catch (err) {
      showFriendlyError(err, "Couldn't delete");
    }
    return;
  }

  if (btn.dataset.act === "sub") {
    const subscribe = c.unsubscribed;
    if (!subscribe) {
      const ok = await showConfirm(`Stop sending offer emails to <b>${who}</b>?`, "Unsubscribe customer?", "Unsubscribe");
      if (!ok) return;
    }
    try {
      await apiPost("set_subscription", { email: c.email, subscribed: subscribe });
      c.unsubscribed = !subscribe;
      render();
    } catch (err) {
      showFriendlyError(err, "Couldn't update");
    }
  }
}

// ---------------- Import ----------------

function resetImport() {
  cs.importNew = [];
  $("importFile").value = "";
  $("importPick").hidden = false;
  $("importReview").hidden = true;
  $("importGo").disabled = true;
  $("importGo").textContent = "Import";
}

// Zero-based column index for each field, from the header row.
function detectColumns(header) {
  const h = header.map((x) => String(x).trim().toLowerCase());
  const find = (re) => h.findIndex((x) => re.test(x));
  let name = find(/^(customer |user |full |client )?name$/);
  if (name === -1) name = h.findIndex((x) => /name/.test(x) && !/e-?mail/.test(x));
  return { email: find(/e-?mail/), name, phone: find(/phone|mobile|contact|whatsapp/), city: find(/city|location|town/) };
}

async function readImportFile(file) {
  if (!file) return;
  if (typeof XLSX === "undefined") {
    return showCustomAlert("The Excel reader couldn't load. Check your internet connection and try again.", "Import unavailable", "error");
  }
  let rows;
  try {
    const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
    rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: false });
  } catch (err) {
    return showCustomAlert("That file couldn't be read. Please upload an .xlsx, .xls or .csv file.", "Can't read file", "error");
  }
  rows = rows.filter((r) => r.some((v) => String(v).trim()));
  if (!rows.length) return showCustomAlert("The file is empty.", "Nothing to import", "error");

  let cols = detectColumns(rows[0]);
  let body = rows.slice(1);
  if (cols.email === -1) {
    // No header row: use the column that contains the most email addresses.
    const width = Math.max(...rows.map((r) => r.length));
    let best = -1;
    let bestCount = 0;
    for (let i = 0; i < width; i++) {
      const count = rows.filter((r) => EMAIL_RE.test(String(r[i] || "").trim())).length;
      if (count > bestCount) [best, bestCount] = [i, count];
    }
    if (best === -1) return showCustomAlert("No email addresses were found in this file. Make sure it has an Email column.", "No emails found", "error");
    cols = { email: best, name: -1, phone: -1, city: -1 };
    body = rows;
  }

  const existing = new Set(cs.customers.map((c) => c.email.toLowerCase()));
  const seen = new Set();
  const fresh = [];
  let invalid = 0;
  let already = 0;
  let dupes = 0;
  body.forEach((r) => {
    const get = (i) => (i === -1 ? "" : String(r[i] || "").trim());
    const email = get(cols.email).toLowerCase();
    if (!EMAIL_RE.test(email)) return invalid++;
    if (existing.has(email)) return already++;
    if (seen.has(email)) return dupes++;
    seen.add(email);
    fresh.push({ name: get(cols.name), email, phone: get(cols.phone), city: get(cols.city) });
  });

  cs.importNew = fresh;
  const stat = (n, label, cls) => `<div class="import-stat ${cls}"><b>${n}</b><span>${label}</span></div>`;
  $("importSummary").innerHTML =
    stat(fresh.length, "new customers", "good") +
    stat(already, "already in list", "") +
    stat(dupes, "repeated in file", "") +
    stat(invalid, "invalid / no email", invalid ? "warn" : "");
  $("importPreview").innerHTML = fresh.length
    ? `<p class="hint" style="margin:0 0 8px">Preview of the first ${Math.min(5, fresh.length)}:</p>` +
      fresh
        .slice(0, 5)
        .map((c) => `<div class="preview-line"><b>${escapeHtml(c.name || "No name")}</b><span>${escapeHtml(c.email)}${c.phone ? " · " + escapeHtml(c.phone) : ""}${c.city ? " · " + escapeHtml(c.city) : ""}</span></div>`)
        .join("")
    : '<p class="hint" style="margin:0">Nothing new to import — everyone in this file is already in your list.</p>';

  $("importPick").hidden = true;
  $("importReview").hidden = false;
  $("importGo").disabled = !fresh.length;
  $("importGo").textContent = fresh.length ? `Import ${fresh.length} customer${fresh.length === 1 ? "" : "s"}` : "Import";
}

async function runImport() {
  const btn = $("importGo");
  const list = cs.importNew;
  let added = 0;
  setBusy(btn, true, "Importing…");
  try {
    for (let i = 0; i < list.length; i += IMPORT_CHUNK) {
      const res = await apiPost("add_customers", { customers: list.slice(i, i + IMPORT_CHUNK) });
      added += res.added;
      btn.innerHTML = `<span class="spinner"></span> Importing… ${Math.min(i + IMPORT_CHUNK, list.length)} / ${list.length}`;
    }
    closeModal("importModal");
    showCustomAlert(`<b>${added}</b> customer${added === 1 ? " was" : "s were"} added to your list.`, "Import complete", "success");
  } catch (err) {
    closeModal("importModal");
    showFriendlyError(err, "Import stopped", added ? `${added} customers were added before it stopped. Import the same file again to add the rest — nobody is added twice.` : "");
  } finally {
    setBusy(btn, false);
    loadCustomers();
  }
}

function downloadSample() {
  const csv = "Name,Email,Phone,City\nPriya Sharma,priya@example.com,+91 98765 43210,Delhi\nRahul Verma,rahul@example.com,,Mumbai\n";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = "customers-sample.csv";
  a.click();
}

// ---------------- Init ----------------

$("addBtn").addEventListener("click", () => openCustomerForm(null));
$("customerForm").addEventListener("submit", saveCustomer);
$("customerList").addEventListener("click", onRowAction);
$("search").addEventListener("input", () => {
  cs.shown = PAGE_SIZE;
  render();
});
$("filter").addEventListener("change", () => {
  cs.shown = PAGE_SIZE;
  render();
});
$("showMore").addEventListener("click", () => {
  cs.shown += PAGE_SIZE;
  render();
});

$("importBtn").addEventListener("click", () => {
  resetImport();
  openModal("importModal");
});
$("importDrop").addEventListener("click", () => $("importFile").click());
$("importDrop").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") $("importFile").click();
});
$("importFile").addEventListener("change", () => readImportFile($("importFile").files[0]));
["dragenter", "dragover"].forEach((ev) =>
  $("importDrop").addEventListener(ev, (e) => {
    e.preventDefault();
    $("importDrop").classList.add("dragging");
  }),
);
["dragleave", "drop"].forEach((ev) =>
  $("importDrop").addEventListener(ev, (e) => {
    e.preventDefault();
    $("importDrop").classList.remove("dragging");
  }),
);
$("importDrop").addEventListener("drop", (e) => readImportFile(e.dataTransfer.files[0]));
$("importGo").addEventListener("click", runImport);
$("sampleBtn").addEventListener("click", downloadSample);

loadCustomers();
