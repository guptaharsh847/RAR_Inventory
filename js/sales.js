const productSelect = document.getElementById("product");
const cachedProducts = localStorage.getItem("products");

let salesData = [];
let filteredSales = [];
let currentPage = 1;
let editingSalesRow = null;
const rowsPerPage = 10;

if (cachedProducts) {
  renderProducts(JSON.parse(cachedProducts));
}

fetch(API_URL + "?action=products")
  .then((res) => res.json())
  .then((data) => {
    localStorage.setItem("products", JSON.stringify(data));
    if (!cachedProducts) renderProducts(data);
  });

// Load sales data automatically
loadSalesData();

function renderProducts(data) {
  let html = `<option value="" disabled selected>Select Product</option>`;
  data.forEach((p) => (html += `<option>${p.name}</option>`));
  productSelect.innerHTML = html;
}

function saveSales() {
  const actionType = editingSalesRow ? "update_sales" : "sales";
  const payload = {
    action: actionType,
    product: document.getElementById("product").value,
    qty: document.getElementById("qty").value,
    amount: document.getElementById("amount").value,
    payment: document.getElementById("payment").value,
    date: document.getElementById("date").value,
  };

  if (editingSalesRow) payload.row = editingSalesRow;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  }).then(() => {
    showCustomAlert(
      editingSalesRow
        ? "The sale has been successfully updated."
        : "The sale has been successfully recorded.",
      editingSalesRow ? "Sale Updated!" : "Sale Saved!",
      "success",
    );
    document.getElementById("qty").value = "";
    document.getElementById("amount").value = "";

    // Reset Edit State
    editingSalesRow = null;
    document.getElementById("saveSalesBtn").innerHTML =
      `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Sale`;
    loadSalesData(true); // Force refresh on save
  });
}

function editSales(row) {
  const item = salesData.find((i) => i.row === row);
  if (!item) return;

  document.getElementById("product").value = item.product;
  document.getElementById("qty").value = item.qty;
  document.getElementById("amount").value = item.amount;
  document.getElementById("payment").value = item.payment;

  let d = parseCustomDate(item.date);
  if (!isNaN(d)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    document.getElementById("date").value = `${yyyy}-${mm}-${dd}`;
  } else {
    document.getElementById("date").value = item.date;
  }

  editingSalesRow = row;
  document.getElementById("saveSalesBtn").innerHTML =
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 6px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Update Sale`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteSales(row) {
  if (
    !confirm(
      "Are you sure you want to delete this sale entry? This cannot be undone.",
    )
  )
    return;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "delete_sales", row: row }),
  }).then(() => {
    showCustomAlert("The sale entry has been deleted.", "Deleted", "success");
    loadSalesData(true);
  });
}

function refreshSalesData() {
  loadSalesData(true);
}

function loadSalesData(force = false) {
  const cached = localStorage.getItem("salesData");
  if (!force && cached) {
    salesData = JSON.parse(cached);
    filteredSales = [...salesData];
    renderSalesTable();
    return;
  }

  document.getElementById("salesBody").innerHTML =
    `<tr><td colspan="6" style="text-align: center;">Loading...</td></tr>`;
  fetch(API_URL + "?action=sales")
    .then((res) => res.json())
    .then((data) => {
      salesData = data.slice().reverse();
      localStorage.setItem("salesData", JSON.stringify(salesData));
      filteredSales = [...salesData];
      renderSalesTable();
    });
}

function parseCustomDate(dateStr) {
  let d = new Date(dateStr);
  if (typeof dateStr === "string" && dateStr.includes("/")) {
    const parts = dateStr.split(/[\s/:]+/);
    if (parts.length >= 3 && parts[2].length === 4) {
      d = new Date(parts[2], parts[1] - 1, parts[0]);
    }
  }
  return d;
}

function renderSalesTable() {
  const tbody = document.getElementById("salesBody");
  tbody.innerHTML = "";

  const totalPages = Math.ceil(filteredSales.length / rowsPerPage) || 1;

  document.getElementById("pageInfo").innerText =
    `Page ${currentPage} of ${totalPages}`;
  document.getElementById("prevPageBtn").disabled = currentPage === 1;
  document.getElementById("nextPageBtn").disabled =
    currentPage === totalPages || filteredSales.length === 0;

  if (filteredSales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No records found.</td></tr>`;
    return;
  }

  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageData = filteredSales.slice(start, end);

  pageData.forEach((r) => {
    const d = parseCustomDate(r.date);
    const dateStr = !isNaN(d) ? d.toLocaleDateString("en-GB") : r.date;

    tbody.innerHTML += `
      <tr>
        <td>${dateStr}</td>
        <td>${r.product}</td>
        <td style="text-align: right; font-weight: 500;">${r.qty}</td>
        <td style="text-align: right;">${r.amount}</td>
        <td><span class="badge">${r.payment}</span></td>
        <td style="text-align: center;">
          <button onclick="editSales(${r.row})" style="width: auto; padding: 6px 12px; margin: 0 4px; background: transparent; border: 1px solid var(--border); color: var(--text-main); box-shadow: none; display: inline-flex; align-items: center; justify-content: center;" title="Edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
          <button onclick="deleteSales(${r.row})" style="width: auto; padding: 6px 12px; margin: 0 4px; background: transparent; border: 1px solid var(--danger); color: var(--danger); box-shadow: none; display: inline-flex; align-items: center; justify-content: center;" title="Delete">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </td>
      </tr>`;
  });
}

function filterSales() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;

  if (!start || !end) {
    filteredSales = [...salesData];
  } else {
    const startD = new Date(start).setHours(0, 0, 0, 0);
    const endD = new Date(end).setHours(23, 59, 59, 999);
    filteredSales = salesData.filter((item) => {
      const itemD = parseCustomDate(item.date).getTime();
      if (isNaN(itemD)) return true;
      return itemD >= startD && itemD <= endD;
    });
  }
  currentPage = 1; // Reset to page 1 on filter
  renderSalesTable();
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderSalesTable();
  }
}

function nextPage() {
  if (currentPage * rowsPerPage < filteredSales.length) {
    currentPage++;
    renderSalesTable();
  }
}

function downloadSalesExcel() {
  let csv = ["Date,Product,Qty,Amount,Payment"];
  filteredSales.forEach((r) => {
    const d = parseCustomDate(r.date);
    const dateStr = !isNaN(d) ? d.toLocaleDateString("en-GB") : r.date;
    csv.push(
      `"${dateStr}","${r.product}","${r.qty}","${r.amount}","${r.payment}"`,
    );
  });
  const blob = new Blob([csv.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Sales_Report.csv";
  a.click();
}
