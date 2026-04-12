const productSelect = document.getElementById("product");
const cachedProducts = localStorage.getItem("products");

let stockData = [];
let filteredStock = [];
let currentPage = 1;
let editingStockRow = null;
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

// Load stock data automatically
loadStockData();

function renderProducts(data) {
  let html = `<option value="" disabled selected>Select Product</option>`;
  data.forEach((p) => (html += `<option>${p.name}</option>`));
  productSelect.innerHTML = html;
}

function saveStock() {
  const actionType = editingStockRow ? "update_stock" : "stock";
  const payload = {
    action: actionType,
    product: document.getElementById("product").value,
    qty: document.getElementById("qty").value,
    date: document.getElementById("date").value,
  };

  if (editingStockRow) payload.row = editingStockRow;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify(payload),
  }).then(() => {
    showCustomAlert(
      editingStockRow
        ? "The stock entry has been updated."
        : "The stock entry has been successfully recorded.",
      editingStockRow ? "Stock Updated!" : "Stock Saved!",
      "success",
    );
    document.getElementById("qty").value = "";

    // Reset Edit State
    editingStockRow = null;
    document.getElementById("saveStockBtn").innerHTML = "💾 Save";
    loadStockData(true); // Force refresh on save
  });
}

function editStock(row) {
  const item = stockData.find((i) => i.row === row);
  if (!item) return;

  document.getElementById("product").value = item.product;
  document.getElementById("qty").value = item.qty;

  let d = parseCustomDate(item.date);
  if (!isNaN(d)) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    document.getElementById("date").value = `${yyyy}-${mm}-${dd}`;
  } else {
    document.getElementById("date").value = item.date;
  }

  editingStockRow = row;
  document.getElementById("saveStockBtn").innerHTML = "🔄 Update Entry";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteStock(row) {
  if (
    !confirm(
      "Are you sure you want to delete this stock entry? This cannot be undone.",
    )
  )
    return;

  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({ action: "delete_stock", row: row }),
  }).then(() => {
    showCustomAlert("The stock entry has been deleted.", "Deleted", "success");
    loadStockData(true);
  });
}

function refreshStockData() {
  loadStockData(true);
}

function loadStockData(force = false) {
  const cached = localStorage.getItem("stockData");
  if (!force && cached) {
    stockData = JSON.parse(cached);
    filteredStock = [...stockData];
    renderStockTable();
    return;
  }

  document.getElementById("stockBody").innerHTML =
    `<tr><td colspan="4" style="text-align: center;">Loading...</td></tr>`;
  fetch(API_URL + "?action=stock")
    .then((res) => res.json())
    .then((data) => {
      stockData = data.slice().reverse();
      localStorage.setItem("stockData", JSON.stringify(stockData));
      filteredStock = [...stockData];
      renderStockTable();
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

function renderStockTable() {
  const tbody = document.getElementById("stockBody");
  tbody.innerHTML = "";

  const totalPages = Math.ceil(filteredStock.length / rowsPerPage) || 1;

  document.getElementById("pageInfo").innerText =
    `Page ${currentPage} of ${totalPages}`;
  document.getElementById("prevPageBtn").disabled = currentPage === 1;
  document.getElementById("nextPageBtn").disabled =
    currentPage === totalPages || filteredStock.length === 0;

  if (filteredStock.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center;">No records found.</td></tr>`;
    return;
  }

  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageData = filteredStock.slice(start, end);

  pageData.forEach((r) => {
    const d = parseCustomDate(r.date);
    const dateStr = !isNaN(d) ? d.toLocaleDateString("en-GB") : r.date;

    tbody.innerHTML += `
      <tr>
        <td>${dateStr}</td>
        <td>${r.product}</td>
        <td style="text-align: right; font-weight: 500; color: var(--success);">${r.qty}</td>
        <td style="text-align: center;">
          <button onclick="editStock(${r.row})" style="width: auto; padding: 6px 12px; margin: 0 4px; background: transparent; border: 1px solid var(--border); color: var(--text-main); box-shadow: none;" title="Edit">✏️</button>
          <button onclick="deleteStock(${r.row})" style="width: auto; padding: 6px 12px; margin: 0 4px; background: transparent; border: 1px solid var(--danger); color: var(--danger); box-shadow: none;" title="Delete">🗑️</button>
        </td>
      </tr>`;
  });
}

function filterStock() {
  const start = document.getElementById("startDate").value;
  const end = document.getElementById("endDate").value;

  if (!start || !end) {
    filteredStock = [...stockData];
  } else {
    const startD = new Date(start).setHours(0, 0, 0, 0);
    const endD = new Date(end).setHours(23, 59, 59, 999);
    filteredStock = stockData.filter((item) => {
      const itemD = parseCustomDate(item.date).getTime();
      if (isNaN(itemD)) return true;
      return itemD >= startD && itemD <= endD;
    });
  }
  currentPage = 1; // Reset to page 1 on filter
  renderStockTable();
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderStockTable();
  }
}

function nextPage() {
  if (currentPage * rowsPerPage < filteredStock.length) {
    currentPage++;
    renderStockTable();
  }
}

function downloadStockExcel() {
  let csv = ["Date,Product,Qty"];
  filteredStock.forEach((r) => {
    const d = parseCustomDate(r.date);
    const dateStr = !isNaN(d) ? d.toLocaleDateString("en-GB") : r.date;
    csv.push(`"${dateStr}","${r.product}","${r.qty}"`);
  });
  const blob = new Blob([csv.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "Stock_Report.csv";
  a.click();
}
