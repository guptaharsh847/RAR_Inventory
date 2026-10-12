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

  const loginBtn = document.getElementById("loginBtn");
  const originalText = loginBtn.innerHTML;
  loginBtn.disabled = true;
  loginBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite; vertical-align: middle; margin-right: 8px;"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line></svg> Signing In...`;

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

        loginBtn.disabled = false;
        loginBtn.innerHTML = originalText;
      }
    })
    .catch((error) => {
      console.error("Login error:", error);
      showCustomAlert(
        "An error occurred during sign in. Please check your connection and try again.",
        "Connection Error",
        "error",
      );
      loginBtn.disabled = false;
      loginBtn.innerHTML = originalText;
    });
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("token_expiry");
  window.location.href = "index.html";
}
