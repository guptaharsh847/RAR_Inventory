const productSelect = document.getElementById("product");
const cachedProducts = localStorage.getItem("products");

let salesData = [];
let filteredSales = [];
let currentPage = 1;
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
  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "sales",
      product: document.getElementById("product").value,
      qty: document.getElementById("qty").value,
      amount: document.getElementById("amount").value,
      payment: document.getElementById("payment").value,
      date: document.getElementById("date").value,
    }),
  }).then(() => {
    showCustomAlert(
      "The sale has been successfully recorded.",
      "Sale Saved!",
      "success",
    );
    document.getElementById("qty").value = "";
    document.getElementById("amount").value = "";
    loadSalesData(true); // Force refresh on save
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
    `<tr><td colspan="5" style="text-align: center;">Loading...</td></tr>`;
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
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No records found.</td></tr>`;
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
