"use strict";

let amenitiesMap = null;
let focusCircle = null;

function initSurveyMap() {
  // Match your screenshot: world view + OSM tiles
  const surveyMap = L.map("myMap").setView([47.6567, -122.3066], 11);
 
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(surveyMap);

  // Search bar (same look as your screenshot)
  if (window.GeoSearch && GeoSearch.GeoSearchControl) {
    const provider = new GeoSearch.OpenStreetMapProvider();
    const searchControl = new GeoSearch.GeoSearchControl({
      provider,
      style: "bar",
      autoClose: true,
      showMarker: false,
      retainZoomLevel: false
    });

    surveyMap.addControl(searchControl);

    surveyMap.on("geosearch/showlocation", function (result) {
      const loc = result.location;
      const latlng = L.latLng(loc.y, loc.x);
      surveyMap.setView(latlng, 12);

      setSurveyMarkerAndInputs(surveyMap, latlng);
      setAmenitiesFocus(latlng);
    });
  }

  // Click to set lon/lat
  surveyMap.on("click", function (evt) {
    setSurveyMarkerAndInputs(surveyMap, evt.latlng);
    setAmenitiesFocus(evt.latlng);
  });

  // If Bootstrap/layout shifts, this prevents “blank map”
  setTimeout(function () {
    surveyMap.invalidateSize();
  }, 0);
}

let surveyMarker = null;

function setSurveyMarkerAndInputs(map, latlng) {
  const lonInput = document.getElementById("lon");
  const latInput = document.getElementById("lat");

  if (lonInput) lonInput.value = latlng.lng.toFixed(6);
  if (latInput) latInput.value = latlng.lat.toFixed(6);

  if (surveyMarker) {
    surveyMarker.setLatLng(latlng);
  } else {
    surveyMarker = L.marker(latlng).addTo(map);
  }

  map.setView(latlng, Math.max(map.getZoom(), 10));
}

function initAmenitiesMap() {
  // Minimal basemap: no labels (keeps your colored cluster circles)
  amenitiesMap = L.map("amenityMap").setView([47.6062, -122.3321], 10);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png", {
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  }).addTo(amenitiesMap);

  const layers = {
    "Groceries (King County)": makeClusterLayer({
      url: "https://gisdata.kingcounty.gov/arcgis/rest/services/OpenDataPortal/admin__food_facilities_point/MapServer/863",
      where: "SEAT_CAP LIKE '%Grocery%'",
      idField: "OBJECTID",
      popupFields: ["NAME", "SITE_ADDRESS", "CITY", "ZIPCODE", "CHAIN_NAME"]
    }),

    "Farmers markets (King County)": makeClusterLayer({
      url: "https://gisdata.kingcounty.gov/arcgis/rest/services/OpenDataPortal/natres___base/MapServer/853",
      where: "1=1",
      idField: "OBJECTID",
      popupFields: ["NAME", "ADDRESS", "CITY", "ZIPCODE", "WEBSITE"]
    }),

    "Public health clinics (King County)": makeClusterLayer({
      url: "https://gisdata.kingcounty.gov/arcgis/rest/services/OpenDataPortal/pubsafe___base/MapServer/178",
      where: "1=1",
      idField: "OBJECTID",
      popupFields: ["NAME", "ADDRESS", "CITY", "ZIPCODE", "WEBSITE"]
    }),

    "Shopping cart reports (Federal Way)": makeClusterLayer({
      url: "https://geoportal.cityoffederalway.com/res/rest/services/Hosted/ShoppingCartsEdits3/FeatureServer/0",
      where: "1=1",
      idField: "objectid",
      popupFields: ["storename", "outcome", "cartdesc", "datepicked"]
    })
  };

  // Turn groceries on by default
  layers["Groceries (King County)"].addTo(amenitiesMap);

  // Toggle control
  L.control.layers(null, layers, { collapsed: false }).addTo(amenitiesMap);

  setTimeout(function () {
    amenitiesMap.invalidateSize();
  }, 0);
}

function makeClusterLayer(config) {
  const fields = [config.idField].concat(config.popupFields);

  return L.esri.Cluster.featureLayer({
    url: config.url,
    where: config.where,
    fields: fields,
    simplifyFactor: 0.35,
    precision: 5,
    disableClusteringAtZoom: 16,
    onEachFeature(feature, layer) {
      const props = feature && feature.properties ? feature.properties : {};
      layer.bindPopup(buildPopupHtml(props, config.popupFields));
    }
  });
}

function setAmenitiesFocus(latlng) {
  if (!amenitiesMap) return;

  amenitiesMap.setView(latlng, Math.max(amenitiesMap.getZoom(), 13));

  if (focusCircle) {
    focusCircle.setLatLng(latlng);
  } else {
    focusCircle = L.circle(latlng, {
      radius: 1200,
      weight: 1,
      fillOpacity: 0.05
    }).addTo(amenitiesMap);
  }
}

function buildPopupHtml(props, fields) {
  const lines = [];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const value = props[field];

    if (value === undefined || value === null || value === "") continue;

    lines.push(
      "<div><strong>" + escapeHtml(field) + ":</strong> " + escapeHtml(String(value)) + "</div>"
    );
  }

  return "<div>" + (lines.length ? lines.join("") : "<em>No details</em>") + "</div>";
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

document.addEventListener("DOMContentLoaded", function () {
  initSurveyMap();
  initAmenitiesMap();
});
