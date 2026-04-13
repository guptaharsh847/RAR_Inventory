async function hash(password) {
  const msg = new TextEncoder().encode(password);

  const hash = await crypto.subtle.digest("SHA-256", msg);

  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function login() {
  let pin = "";
  for (let i = 1; i <= 6; i++) {
    pin += document.getElementById("pin" + i).value;
  }

  if (pin.length < 6) {
    showCustomAlert("Please enter a 6-digit PIN.", "Invalid PIN", "error");
    return;
  }

  const password = await hash(pin);
  // console.log("API_URL", API_URL);
  fetch(API_URL, {
    method: "POST",
    body: JSON.stringify({
      action: "login",
      email: "admin@gmail.com",
      password: pin,
    }),
  })
    .then((res) => res.json())

    .then((data) => {
      // console.log("data", data);
      if (data.status == "success") {
        localStorage.setItem("token", data.token);
        // Maintain login session for 7 days
        localStorage.setItem(
          "token_expiry",
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        );

        window.location = "dashboard.html";
      } else {
        showCustomAlert("Please check your PIN.", "Invalid Login", "error");
        document.querySelectorAll(".pin-box").forEach((b) => (b.value = ""));
        document.getElementById("pin1").focus();
      }
    });
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("token_expiry");
  window.location.href = "index.html";
}
