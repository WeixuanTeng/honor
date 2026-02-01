"use strict";

/* ---------------------------
   Default map focus (UW / Seattle)
---------------------------- */
const DEFAULT_CENTER = L.latLng(47.6567, -122.3066);

/* ---------------------------
   15-minute walk settings
---------------------------- */
const WALK_MINUTES = 15;
const WALK_SPEED_METERS_PER_MIN = 80; // ~3 mph
const WALK_BUFFER_RADIUS_M = WALK_MINUTES * WALK_SPEED_METERS_PER_MIN;

/* ---------------------------
   Scenario assumptions
---------------------------- */
const SCENARIOS = [
  {
    label: "Walk-only (15 min)",
    radiusM: 15 * 80,
    color: "#2b8cbe",
  },
  {
    label: "Walk + transit (15 min total)",
    radiusM: 5 * 80 + 10 * 400,
    color: "#31a354",
  },
  {
    label: "Walk + transit + micromobility (15 min total)",
    radiusM: 3 * 80 + 9 * 400 + 3 * 250,
    color: "#ff7f00",
  },
];

/* ---------------------------
   Globals
---------------------------- */
let amenitiesMap = null;
let amenitiesFocusCircle = null;
let surveyMarker = null;

let scenarioMap = null;
let scenarioMarker = null;

// Default scenario origin (same as default center)
let scenarioOrigin = DEFAULT_CENTER;

let scenarioRingLayers = null;
let scenarioAmenityLayers = null;

/* =========================================================
   Small-screen helper
========================================================= */
function isMobileViewport() {
  return (
    window.matchMedia &&
    window.matchMedia("(max-width: 600px)").matches
  );
}

/* =========================================================
   Show/Hide layers panel (JS only)
   - hides the entire layers control on mobile by default
   - adds a button to show/hide it
========================================================= */
function addLayersPanelToggle(mapInstance, layersControl) {
  const container = layersControl.getContainer();
  const isMobile = isMobileViewport();

  let isVisible = !isMobile;

  // Mobile: start hidden + make it scrollable when shown
  if (isMobile) {
    container.style.display = "none";
    container.style.maxWidth = "86vw";
    container.style.maxHeight = "55vh";
    container.style.overflowY = "auto";
  }

  const control = L.control({ position: "bottomleft" });

  control.onAdd = function () {
    const wrapper = L.DomUtil.create("div", "leaflet-bar");
    const button = L.DomUtil.create("a", "", wrapper);

    button.href = "#";
    button.title = "Show/Hide layer list";
    button.textContent = isVisible ? "Hide layers" : "Show layers";

    button.style.width = "auto";
    button.style.padding = "0 10px";
    button.style.lineHeight = "30px";
    button.style.textDecoration = "none";

    L.DomEvent.disableClickPropagation(wrapper);

    L.DomEvent.on(button, "click", function (evt) {
      L.DomEvent.preventDefault(evt);

      isVisible = !isVisible;
      container.style.display = isVisible ? "" : "none";
      button.textContent = isVisible ? "Hide layers" : "Show layers";
    });

    return wrapper;
  };

  control.addTo(mapInstance);
}

/* =========================================================
   Shared basemaps
========================================================= */
function addCartoBase(mapInstance) {
  return L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 20,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    }
  ).addTo(mapInstance);
}

/* =========================================================
   Elevation (hillshade) toggle button
========================================================= */
function addElevationToggle(mapInstance) {
  const hillshadeUrl =
    "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}";

  const hillshadeLayer = L.tileLayer(hillshadeUrl, {
    maxZoom: 20,
    opacity: 0.45,
    attribution: "&copy; Esri",
  });

  let isOn = false;

  const control = L.control({ position: "bottomleft" });

  control.onAdd = function () {
    const container = L.DomUtil.create("div", "leaflet-bar");
    const button = L.DomUtil.create("a", "", container);

    button.href = "#";
    button.title = "Toggle elevation hillshade";
    button.textContent = "Elevation: Off";

    button.style.width = "auto";
    button.style.padding = "0 10px";
    button.style.lineHeight = "30px";
    button.style.textDecoration = "none";

    L.DomEvent.disableClickPropagation(container);

    L.DomEvent.on(button, "click", function (evt) {
      L.DomEvent.preventDefault(evt);

      if (isOn) {
        mapInstance.removeLayer(hillshadeLayer);
        isOn = false;
        button.textContent = "Elevation: Off";
      } else {
        hillshadeLayer.addTo(mapInstance);
        isOn = true;
        button.textContent = "Elevation: On";
      }
    });

    return container;
  };

  control.addTo(mapInstance);
}

/* =========================================================
   1) SURVEY MAP (top)
========================================================= */
function initSurveyMap() {
  const surveyMap = L.map("myMap").setView(DEFAULT_CENTER, 11);

  addCartoBase(surveyMap);

  // Search bar
  if (window.GeoSearch && GeoSearch.GeoSearchControl) {
    const provider = new GeoSearch.OpenStreetMapProvider();
    const searchControl = new GeoSearch.GeoSearchControl({
      provider,
      style: "bar",
      autoClose: true,
      showMarker: false,
      retainZoomLevel: false,
    });

    surveyMap.addControl(searchControl);

    surveyMap.on("geosearch/showlocation", function (result) {
      const location = result.location;
      const latlng = L.latLng(location.y, location.x);

      surveyMap.setView(latlng, 12);
      setSurveyMarkerAndInputs(surveyMap, latlng);

      setAmenitiesFocus(latlng);
    });
  }

  surveyMap.on("click", function (evt) {
    const latlng = evt.latlng;

    setSurveyMarkerAndInputs(surveyMap, latlng);
    setAmenitiesFocus(latlng);
  });

  setTimeout(function () {
    surveyMap.invalidateSize();
  }, 0);
}

function setSurveyMarkerAndInputs(mapInstance, latlng) {
  const lonInput = document.getElementById("lon");
  const latInput = document.getElementById("lat");

  if (lonInput) lonInput.value = latlng.lng.toFixed(6);
  if (latInput) latInput.value = latlng.lat.toFixed(6);

  if (surveyMarker) {
    surveyMarker.setLatLng(latlng);
  } else {
    surveyMarker = L.marker(latlng).addTo(mapInstance);
  }

  mapInstance.setView(latlng, Math.max(mapInstance.getZoom(), 10));
}

/* =========================================================
   2) AMENITIES MAP (middle)
========================================================= */
function initAmenitiesMap() {
  amenitiesMap = L.map("amenityMap").setView(DEFAULT_CENTER, 10);

  addCartoBase(amenitiesMap);
  addElevationToggle(amenitiesMap);

  const sources = getAmenitySources();

  const pointOverlays = {};
  const bufferOverlays = {};
  const bufferPairs = [];

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const pair = makeClusterLayerWithBuffers(src);

    pointOverlays[src.label] = pair.pointsLayer;
    bufferOverlays[src.label + " (15-min walk buffer)"] = pair.bufferLayer;

    bufferPairs.push(pair);
  }

  // Default on
  if (pointOverlays["Groceries (King County)"]) {
    pointOverlays["Groceries (King County)"].addTo(amenitiesMap);
  }

  const amenitiesLayersControl = L.control.layers(
    null,
    { ...pointOverlays, ...bufferOverlays },
    { collapsed: isMobileViewport() } // mobile starts collapsed
  ).addTo(amenitiesMap);

  // ✅ Show/Hide button (mobile-friendly, JS only)
  addLayersPanelToggle(amenitiesMap, amenitiesLayersControl);

  amenitiesMap.on("overlayadd", function (e) {
    const match = bufferPairs.find(function (p) {
      return p.bufferLayer === e.layer;
    });
    if (!match) return;

    if (!amenitiesMap.hasLayer(match.pointsLayer)) {
      amenitiesMap.addLayer(match.pointsLayer);
    }

    match.refreshBuffers();
  });

  amenitiesMap.on("overlayremove", function (e) {
    const match = bufferPairs.find(function (p) {
      return p.bufferLayer === e.layer;
    });
    if (!match) return;

    match.bufferLayer.clearLayers();
  });

  let bufferTimer = null;

  function refreshActiveBuffers() {
    for (let i = 0; i < bufferPairs.length; i++) {
      const pair = bufferPairs[i];
      if (amenitiesMap.hasLayer(pair.bufferLayer)) {
        pair.refreshBuffers();
      }
    }
  }

  amenitiesMap.on("moveend zoomend", function () {
    if (bufferTimer) clearTimeout(bufferTimer);

    bufferTimer = setTimeout(function () {
      refreshActiveBuffers();
    }, 200);
  });

  setTimeout(function () {
    amenitiesMap.invalidateSize();
  }, 0);
}

function makeClusterLayerWithBuffers(config) {
  const fields = [config.idField].concat(config.popupFields);
  const bufferLayer = L.layerGroup();

  const pointsLayer = L.esri.Cluster.featureLayer({
    url: config.url,
    where: config.where || "1=1",
    fields: fields,
    simplifyFactor: 0.35,
    precision: 5,
    disableClusteringAtZoom: 16,
    onEachFeature: function (feature, layer) {
      const props = feature && feature.properties ? feature.properties : {};
      layer.bindPopup(buildPopupHtml(props, config.popupFields));
    },
  });

  function refreshBuffers() {
    if (!amenitiesMap) return;
    if (!amenitiesMap.hasLayer(bufferLayer)) return;

    bufferLayer.clearLayers();

    const query = L.esri
      .query({ url: config.url })
      .where(config.where || "1=1")
      .within(amenitiesMap.getBounds())
      .returnGeometry(true)
      .limit(1000);

    query.run(function (error, featureCollection) {
      if (error) {
        console.error("Amenities buffer query error:", config.label, error);
        return;
      }

      const features =
        featureCollection && featureCollection.features
          ? featureCollection.features
          : [];

      for (let i = 0; i < features.length; i++) {
        const geom = features[i].geometry;
        if (!geom || geom.type !== "Point") continue;

        const lng = geom.coordinates[0];
        const lat = geom.coordinates[1];

        L.circle([lat, lng], {
          radius: WALK_BUFFER_RADIUS_M,
          color: config.bufferColor,
          weight: 1,
          fillColor: config.bufferColor,
          fillOpacity: 0.08,
        }).addTo(bufferLayer);
      }
    });
  }

  return {
    label: config.label,
    pointsLayer: pointsLayer,
    bufferLayer: bufferLayer,
    refreshBuffers: refreshBuffers,
  };
}

function setAmenitiesFocus(latlng) {
  if (!amenitiesMap) return;

  amenitiesMap.setView(latlng, Math.max(amenitiesMap.getZoom(), 13));

  if (amenitiesFocusCircle) {
    amenitiesFocusCircle.setLatLng(latlng);
  } else {
    amenitiesFocusCircle = L.circle(latlng, {
      radius: 1200,
      weight: 1,
      fillOpacity: 0.05,
    }).addTo(amenitiesMap);
  }
}

/* =========================================================
   3) SCENARIO MAP (bottom)
========================================================= */
function initScenarioMap() {
  scenarioMap = L.map("scenarioMap").setView(DEFAULT_CENTER, 11);

  addCartoBase(scenarioMap);
  addElevationToggle(scenarioMap);

  scenarioRingLayers = {};
  for (let i = 0; i < SCENARIOS.length; i++) {
    scenarioRingLayers[SCENARIOS[i].label] = L.layerGroup();
  }

  scenarioAmenityLayers = {};
  const sources = getAmenitySources();
  for (let j = 0; j < sources.length; j++) {
    scenarioAmenityLayers[sources[j].label] = L.layerGroup();
  }

  // Defaults
  scenarioRingLayers[SCENARIOS[0].label].addTo(scenarioMap);
  scenarioRingLayers[SCENARIOS[1].label].addTo(scenarioMap);

  if (scenarioAmenityLayers["Groceries (King County)"]) {
    scenarioAmenityLayers["Groceries (King County)"].addTo(scenarioMap);
  }

  const overlays = { ...scenarioRingLayers, ...scenarioAmenityLayers };

  const scenarioLayersControl = L.control.layers(
    null,
    overlays,
    { collapsed: isMobileViewport() } // mobile starts collapsed
  ).addTo(scenarioMap);

  // ✅ Show/Hide button (mobile-friendly, JS only)
  addLayersPanelToggle(scenarioMap, scenarioLayersControl);

  scenarioMap.on("overlayadd", function () {
    redrawScenarioRings();
    refreshScenarioAmenityPoints();
  });

  scenarioMap.on("overlayremove", function () {
    redrawScenarioRings();
    refreshScenarioAmenityPoints();
  });

  // Click scenario map to move origin
  scenarioMap.on("click", function (evt) {
    setScenarioFocus(evt.latlng);
  });

  // Refresh points on pan/zoom
  let scenarioTimer = null;
  scenarioMap.on("moveend zoomend", function () {
    if (scenarioTimer) clearTimeout(scenarioTimer);
    scenarioTimer = setTimeout(function () {
      refreshScenarioAmenityPoints();
    }, 250);
  });

  // Initial draw
  setScenarioFocus(scenarioOrigin);

  setTimeout(function () {
    scenarioMap.invalidateSize();
  }, 0);
}

function setScenarioFocus(latlng) {
  scenarioOrigin = latlng;

  if (!scenarioMap) return;

  if (scenarioMarker) {
    scenarioMarker.setLatLng(latlng);
  } else {
    scenarioMarker = L.marker(latlng).addTo(scenarioMap);
  }

  redrawScenarioRings();
  refreshScenarioAmenityPoints();
}

function redrawScenarioRings() {
  if (!scenarioMap || !scenarioRingLayers) return;

  for (let i = 0; i < SCENARIOS.length; i++) {
    const scenario = SCENARIOS[i];
    const layer = scenarioRingLayers[scenario.label];
    if (!layer) continue;

    layer.clearLayers();
    if (!scenarioMap.hasLayer(layer)) continue;

    const ring = L.circle(scenarioOrigin, {
      radius: scenario.radiusM,
      color: scenario.color,
      weight: 2,
      fillColor: scenario.color,
      fillOpacity: 0.06,
    });

    ring.bindTooltip(
      scenario.label + " — ~" + Math.round(scenario.radiusM) + " m",
      { sticky: true }
    );

    ring.addTo(layer);
  }
}

function getActiveScenariosSorted() {
  const active = [];

  for (let i = 0; i < SCENARIOS.length; i++) {
    const s = SCENARIOS[i];
    const layer = scenarioRingLayers[s.label];
    if (layer && scenarioMap && scenarioMap.hasLayer(layer)) {
      active.push(s);
    }
  }

  active.sort(function (a, b) {
    return a.radiusM - b.radiusM;
  });

  return active;
}

function pickScenarioForDistanceMeters(distanceM) {
  const active = getActiveScenariosSorted();

  for (let i = 0; i < active.length; i++) {
    if (distanceM <= active[i].radiusM) return active[i];
  }

  return null;
}

function refreshScenarioAmenityPoints() {
  if (!scenarioMap || !scenarioAmenityLayers) return;

  const bounds = scenarioMap.getBounds();
  const sources = getAmenitySources();

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    const layer = scenarioAmenityLayers[src.label];
    if (!layer) continue;

    if (!scenarioMap.hasLayer(layer)) {
      layer.clearLayers();
      continue;
    }

    layer.clearLayers();

    const query = L.esri
      .query({ url: src.url })
      .where(src.where || "1=1")
      .within(bounds)
      .returnGeometry(true)
      .limit(2000);

    query.run(function (error, featureCollection) {
      if (error) {
        console.error("Scenario amenity query error:", src.label, error);
        return;
      }

      const features =
        featureCollection && featureCollection.features
          ? featureCollection.features
          : [];

      for (let j = 0; j < features.length; j++) {
        const geom = features[j].geometry;
        if (!geom || geom.type !== "Point") continue;

        const lng = geom.coordinates[0];
        const lat = geom.coordinates[1];

        const pt = L.latLng(lat, lng);
        const distanceM = scenarioOrigin.distanceTo(pt);

        const reachedBy = pickScenarioForDistanceMeters(distanceM);
        const isReachable = Boolean(reachedBy);

        const marker = L.circleMarker(pt, {
          radius: 6,
          color: isReachable ? reachedBy.color : "#888",
          weight: isReachable ? 3 : 1,
          fillColor: src.bufferColor,
          fillOpacity: isReachable ? 0.9 : 0.25,
        });

        const props =
          features[j] && features[j].properties ? features[j].properties : {};

        const extra =
          "<div><strong>Reachable:</strong> " +
          (isReachable ? "Yes" : "No") +
          "</div>" +
          "<div><strong>Reached by:</strong> " +
          (isReachable ? escapeHtml(reachedBy.label) : "None selected") +
          "</div>" +
          "<div><strong>Distance:</strong> " +
          Math.round(distanceM) +
          " m</div>";

        marker.bindPopup(buildPopupHtml(props, src.popupFields) + extra);
        marker.addTo(layer);
      }
    });
  }
}

/* =========================================================
   Amenity sources
========================================================= */
function getAmenitySources() {
  return [
    {
      label: "Groceries (King County)",
      url: "https://gisdata.kingcounty.gov/arcgis/rest/services/OpenDataPortal/admin__food_facilities_point/MapServer/863",
      where: "SEAT_CAP LIKE '%Grocery%'",
      idField: "OBJECTID",
      popupFields: ["NAME", "SITE_ADDRESS", "CITY", "ZIPCODE", "CHAIN_NAME"],
      bufferColor: "#2b8cbe",
    },
    {
      label: "Farmers markets (King County)",
      url: "https://gisdata.kingcounty.gov/arcgis/rest/services/OpenDataPortal/natres___base/MapServer/853",
      where: "1=1",
      idField: "OBJECTID",
      popupFields: ["NAME", "ADDRESS", "CITY", "ZIPCODE", "WEBSITE"],
      bufferColor: "#31a354",
    },
    {
      label: "Public health clinics (King County)",
      url: "https://gisdata.kingcounty.gov/arcgis/rest/services/OpenDataPortal/pubsafe___base/MapServer/178",
      where: "1=1",
      idField: "OBJECTID",
      popupFields: ["NAME", "ADDRESS", "CITY", "ZIPCODE", "WEBSITE"],
      bufferColor: "#e34a33",
    },
    {
      label: "Shopping cart reports (Federal Way)",
      url: "https://geoportal.cityoffederalway.com/res/rest/services/Hosted/ShoppingCartsEdits3/FeatureServer/0",
      where: "1=1",
      idField: "objectid",
      popupFields: ["storename", "outcome", "cartdesc", "datepicked"],
      bufferColor: "#756bb1",
    },
    {
      label: "K-12 schools (King County)",
      url: "https://gisdata.kingcounty.gov/arcgis/rest/services/OpenDataPortal/admin___base/MapServer/107",
      where: "CODE IN (660, 661, 662, 664, 666)",
      idField: "OBJECTID",
      popupFields: ["NAME", "FEATUREDES", "ADDRESS", "DISTRICT", "ZIPCODE"],
      bufferColor: "#ff7f00",
    },
    {
      label: "Parks (King County)",
      url: "https://gisdata.kingcounty.gov/arcgis/rest/services/OpenDataPortal/recreatn__park_label_point/MapServer/884",
      where: "Label_Type = 1",
      idField: "OBJECTID",
      popupFields: ["SiteName", "Owner", "Manager", "SiteType"],
      bufferColor: "#2ca25f",
    },
  ];
}

/* =========================================================
   Popup helpers
========================================================= */
function buildPopupHtml(props, fields) {
  const lines = [];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const value = props[field];

    if (value === undefined || value === null || value === "") continue;

    lines.push(
      "<div><strong>" +
        escapeHtml(field) +
        ":</strong> " +
        escapeHtml(String(value)) +
        "</div>"
    );
  }

  return (
    "<div>" + (lines.length ? lines.join("") : "<em>No details</em>") + "</div>"
  );
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* =========================================================
   Start everything
========================================================= */
document.addEventListener("DOMContentLoaded", function () {
  initSurveyMap();
  initAmenitiesMap();
  initScenarioMap();
});
