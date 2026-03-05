const productSelect = document.getElementById("product");
const cachedProducts = localStorage.getItem("products");

if (cachedProducts) {
  renderProducts(JSON.parse(cachedProducts));
}

fetch(API_URL + "?action=products")
  .then((res) => res.json())
  .then((data) => {
    localStorage.setItem("products", JSON.stringify(data));
    if (!cachedProducts) renderProducts(data);
  });

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
  }).then(() => alert("Saved"));
}
