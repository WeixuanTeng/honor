"use strict";

const scriptUrl =
  "https://script.google.com/macros/s/AKfycbwsUxuePNt6kdU-dH_QqlKB3BbKqBbnK1d74rB7dyxZBYIbRzEeleZf-NSqs3NIIXw2/exec";

const form = document.forms["submit-to-google-sheet"];
const successEl = document.getElementById("success");

function setStatus(message) {
  if (successEl) {
    successEl.textContent = message;
  }
}

function handleSubmit(event) {
  event.preventDefault();

  setStatus("Submitting...");

  fetch(scriptUrl, {
    method: "POST",
    mode: "no-cors",
    body: new FormData(form),
  })
    .then(() => {
      setStatus("Submitted!");
      form.reset();
    })
    .catch(() => {
      setStatus("Error: Failed to fetch");
    });
}

if (form) {
  form.addEventListener("submit", handleSubmit);
}
