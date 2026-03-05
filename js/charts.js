// Set default month to current month
const dateInput = document.getElementById("monthFilter");
const now = new Date();
const monthStr = now.toISOString().slice(0, 7); // Format: YYYY-MM
dateInput.value = monthStr;

loadDashboardData();

function loadDashboardData() {
  loadDashboardSales();
  loadInventory();
}

function loadDashboardSales() {
  const selectedMonth = document.getElementById("monthFilter").value;

  fetch(API_URL + "?action=sales")
    .then((res) => res.json())
    .then((data) => {
      let total = 0;
      let count = 0;

      data.forEach((sale) => {
        // Check if sale date matches selected month (YYYY-MM)
        let saleDate = sale.date.substring(0, 7);
        if (saleDate === selectedMonth) {
          total += Number(sale.amount) || 0;
          count++;
        }
      });

      document.getElementById("totalSales").innerText = total.toLocaleString();
      document.getElementById("salesCount").innerText = count + " orders";
    });
}

function loadInventory() {
  fetch(API_URL + "?action=inventory")
    .then((res) => res.json())
    .then((data) => {
      const tbody = document.getElementById("inventoryBody");
      tbody.innerHTML = "";
      data.forEach((item) => {
        tbody.innerHTML += `<tr><td>${item.product}</td><td>${item.qty}</td></tr>`;
      });
    });
}
