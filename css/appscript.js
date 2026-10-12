const ss = SpreadsheetApp.getActiveSpreadsheet();

function doGet(e) {
  if (e.parameter.action == "products") return products();
  if (e.parameter.action == "sales") return sales();
  if (e.parameter.action == "stock") return getStockLogs();
  if (e.parameter.action == "inventory") return getInventorySummary();
  if (e.parameter.action == "weights") return getWeights();
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);

  if (data.action == "login") return login(data);
  if (data.action == "stock") return stock(data);
  if (data.action == "sales") return addSales(data);
  if (data.action == "delete_stock") return deleteRow(data, "STOCK_ENTRY");
  if (data.action == "delete_sales") return deleteRow(data, "SALES");
  if (data.action == "update_stock") return updateStock(data);
  if (data.action == "update_sales") return updateSales(data);
}

function login(data) {
  const sheet = ss.getSheetByName("USERS");
  const rows = sheet.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] == data.password) {
      return json({ status: "success", token: Utilities.getUuid() });
    }
  }

  return json({ status: "error" });
}

function getWeights() {
  const sheet = ss.getSheetByName("PRODUCTS");
  const rows = sheet.getDataRange().getValues();
  let list = [];
  for (let i = 1; i < rows.length; i++) {
    let w = rows[i][3]; // Read weights from Column D
    if (w && !list.includes(w)) {
      list.push(w);
    }
  }
  return json(list);
}

function products() {
  const sheet = ss.getSheetByName("PRODUCTS");
  const rows = sheet.getDataRange().getValues();

  let list = [];

  for (let i = 1; i < rows.length; i++) {
    list.push({
      name: rows[i][1],
      code: rows[i][2],
    });
  }

  return json(list);
}

function stock(data) {
  const sheet = ss.getSheetByName("STOCK_ENTRY");

  sheet.appendRow([new Date(), data.product, data.qty, data.date, data.weight]);

  return json({ status: "saved" });
}

function deleteRow(data, sheetName) {
  const sheet = ss.getSheetByName(sheetName);
  sheet.deleteRow(data.row);
  return json({ status: "deleted" });
}

function updateStock(data) {
  const sheet = ss.getSheetByName("STOCK_ENTRY");
  sheet
    .getRange(data.row, 2, 1, 4)
    .setValues([[data.product, data.qty, data.date, data.weight]]);
  return json({ status: "updated" });
}

function updateSales(data) {
  const sheet = ss.getSheetByName("SALES");
  sheet
    .getRange(data.row, 2, 1, 6)
    .setValues([
      [
        data.product,
        data.qty,
        data.amount,
        data.payment,
        data.date,
        data.weight,
      ],
    ]);
  return json({ status: "updated" });
}

function getStockLogs() {
  const sheet = ss.getSheetByName("STOCK_ENTRY");
  const rows = sheet.getDataRange().getValues();

  let list = [];

  for (let i = 1; i < rows.length; i++) {
    list.push({
      row: i + 1,
      product: rows[i][1],
      qty: rows[i][2],
      date: rows[i][3] || rows[i][0], // Use timestamp if custom date is empty
      weight: rows[i][4] || "",
    });
  }

  return json(list);
}

function addSales(data) {
  const sheet = ss.getSheetByName("SALES");

  sheet.appendRow([
    new Date(),
    data.product,
    data.qty,
    data.amount,
    data.payment,
    data.date,
    data.weight,
  ]);

  return json({ status: "saved" });
}

function sales() {
  const sheet = ss.getSheetByName("SALES");
  const rows = sheet.getDataRange().getValues();

  let list = [];

  for (let i = 1; i < rows.length; i++) {
    list.push({
      row: i + 1,
      product: rows[i][1],
      qty: rows[i][2],
      amount: rows[i][3],
      payment: rows[i][4],
      date: rows[i][5] || rows[i][0], // Use timestamp if custom date is empty
      weight: rows[i][6] || "",
    });
  }

  return json(list);
}

function getInventorySummary() {
  const stockSheet = ss.getSheetByName("STOCK_ENTRY");
  const salesSheet = ss.getSheetByName("SALES");

  const stockData = stockSheet.getDataRange().getValues();
  const salesData = salesSheet.getDataRange().getValues();

  let inventory = {};

  // Sum Stock In (start at 1 to skip header)
  for (let i = 1; i < stockData.length; i++) {
    let p = stockData[i][1];
    let q = Number(stockData[i][2]) || 0;
    let w = stockData[i][4] || "";
    if (p) {
      let key = p + (w ? "_" + w : "");
      if (!inventory[key]) inventory[key] = { product: p, weight: w, qty: 0 };
      inventory[key].qty += q;
    }
  }

  // Subtract Sales Out
  for (let i = 1; i < salesData.length; i++) {
    let p = salesData[i][1];
    let q = Number(salesData[i][2]) || 0;
    let w = salesData[i][6] || "";
    if (p) {
      let key = p + (w ? "_" + w : "");
      if (!inventory[key]) inventory[key] = { product: p, weight: w, qty: 0 };
      inventory[key].qty -= q;
    }
  }

  let list = [];
  for (let key in inventory) {
    list.push({
      product: inventory[key].product,
      weight: inventory[key].weight,
      qty: inventory[key].qty,
    });
  }

  return json(list);
}

function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
