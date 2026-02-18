"use strict";

const scriptUrl =
  "https://script.google.com/macros/s/AKfycbwKzeAiUFOl40yYBdiyQvr8vDDXBHZd4kwFh9voIBHcS3ZQ8Dz5tksn_eA9E5e8ENRV/exec";

const form = document.forms["submit-to-google-sheet"];
const successEl = document.getElementById("success");

function setStatus(message) {
  if (successEl) successEl.textContent = message;
}

function isPlaceholderText(text) {
  const t = String(text || "").trim().toLowerCase();
  return !t || t.includes("select your answer");
}

function buildCleanFormData(formEl) {
  const fd = new FormData();
  const checkboxGroups = new Map();

  const els = Array.from(formEl.elements);

  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    if (!el || !el.name || el.disabled) continue;

    // SELECT: save visible label text, not numeric value
    if (el.tagName === "SELECT") {
      const opt = el.options[el.selectedIndex];
      const label = opt ? opt.textContent.trim() : "";
      if (!isPlaceholderText(label)) fd.append(el.name, label);
      continue;
    }

    // RADIO: only checked
    if (el.type === "radio") {
      if (el.checked) fd.append(el.name, (el.value || "").trim());
      continue;
    }

    // CHECKBOX: collect then join once per group
    if (el.type === "checkbox") {
      if (!checkboxGroups.has(el.name)) checkboxGroups.set(el.name, []);
      if (el.checked) checkboxGroups.get(el.name).push((el.value || "yes").trim());
      continue;
    }

    // Everything else (text/hidden/etc)
    const v = (el.value || "").trim();
    if (v) fd.append(el.name, v);
  }

  // Append checkbox groups as a single semicolon-separated string
  for (const [name, values] of checkboxGroups.entries()) {
    if (values.length > 0) fd.append(name, values.join("; "));
  }

  return fd;
}

function handleSubmit(event) {
  event.preventDefault();

  // Basic guard: require lon/lat so you don’t get empty rows
  const lon = document.getElementById("lon");
  const lat = document.getElementById("lat");
  if (!lon || !lat || !lon.value.trim() || !lat.value.trim()) {
    setStatus("Please click on the survey map to fill lon/lat before submitting.");
    return;
  }

  setStatus("Submitting...");

  const formData = buildCleanFormData(form);

  fetch(scriptUrl, {
    method: "POST",
    mode: "no-cors",
    body: formData,
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
