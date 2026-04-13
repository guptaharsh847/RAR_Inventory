// Set default month to current month
const dateInput = document.getElementById("monthFilter");
const now = new Date();
const monthStr = now.toISOString().slice(0, 7); // Format: YYYY-MM
dateInput.value = monthStr;

loadDashboardData();

function loadDashboardData(force = false) {
  loadDashboardSales(force);
  loadInventory(force);
}

function refreshDashboardData() {
  loadDashboardData(true);
}

function loadDashboardSales(force = false) {
  const selectedMonth = document.getElementById("monthFilter").value;
  const cachedSales = localStorage.getItem("salesData");

  if (!force && cachedSales) {
    processSalesData(JSON.parse(cachedSales), selectedMonth);
    return;
  }

  document.getElementById("totalSales").innerText = "...";

  fetch(API_URL + "?action=sales")
    .then((res) => res.json())
    .then((data) => {
      const processedData = data.slice().reverse();
      localStorage.setItem("salesData", JSON.stringify(processedData));
      processSalesData(processedData, selectedMonth);
    });
}

function processSalesData(data, selectedMonth) {
  let total = 0;
  let count = 0;

  data.forEach((sale) => {
    let saleYearMonth = "";
    let d = new Date(sale.date);

    if (typeof sale.date === "string" && sale.date.includes("/")) {
      const parts = sale.date.split(/[\s/:]+/);
      if (parts.length >= 3 && parts[2].length === 4) {
        d = new Date(parts[2], parts[1] - 1, parts[0]);
      }
    }

    if (!isNaN(d)) {
      saleYearMonth =
        d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    } else {
      saleYearMonth = String(sale.date).substring(0, 7);
    }

    if (saleYearMonth === selectedMonth) {
      total += Number(sale.amount) || 0;
      count++;
    }
  });

  document.getElementById("totalSales").innerText = total.toLocaleString();
  document.getElementById("salesCount").innerText = count + " orders";
}

function loadInventory(force = false) {
  const cachedInv = localStorage.getItem("inventoryData");

  if (!force && cachedInv) {
    processInventoryData(JSON.parse(cachedInv));
    return;
  }

  fetch(API_URL + "?action=inventory")
    .then((res) => res.json())
    .then((data) => {
      localStorage.setItem("inventoryData", JSON.stringify(data));
      processInventoryData(data);
    });
}

function processInventoryData(data) {
  const tbody = document.getElementById("inventoryBody");
  tbody.innerHTML = "";
  data.forEach((item) => {
    tbody.innerHTML += `<tr><td data-label="Product">${item.product}</td><td data-label="Qty" style="text-align: right; font-weight: 600; color: var(--success);">${item.qty}</td></tr>`;
  });
}
