import type { StyleSpecification } from "maplibre-gl";

// Dark, quiet basemap in the MasterClass palette. Tiles: OpenFreeMap (free, no key).
const C = {
  space: "#1c1c1c",
  water: "#151515",
  land: "#252525",
  park: "#232823",
  border: "#4a4a46",
  state: "#34342f",
  road: "#2f2f2f",
  label: "#8f8d86",
  labelStrong: "#c9c5bb",
};

function graticule() {
  const features: GeoJSON.Feature[] = [];
  for (let lng = -180; lng <= 180; lng += 15) {
    const coords: [number, number][] = [];
    for (let lat = -85; lat <= 85; lat += 5) coords.push([lng, lat]);
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
  }
  for (let lat = -75; lat <= 75; lat += 15) {
    const coords: [number, number][] = [];
    for (let lng = -180; lng <= 180; lng += 5) coords.push([lng, lat]);
    features.push({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
  }
  return { type: "FeatureCollection" as const, features };
}

const font = ["Noto Sans Regular"];

export const mapStyle: StyleSpecification = {
  version: 8,
  projection: { type: "globe" },
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sky: {
    "sky-color": C.space,
    "horizon-color": "#2a2a2a",
    "fog-color": C.space,
    "sky-horizon-blend": 0.6,
    "horizon-fog-blend": 0.6,
    "fog-ground-blend": 0.8,
    "atmosphere-blend": ["interpolate", ["linear"], ["zoom"], 0, 0.55, 4, 0.2, 6, 0],
  },
  sources: {
    omt: { type: "vector", url: "https://tiles.openfreemap.org/planet" },
    graticule: { type: "geojson", data: graticule() },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": C.land } },
    { id: "water", type: "fill", source: "omt", "source-layer": "water", paint: { "fill-color": C.water } },
    {
      id: "park", type: "fill", source: "omt", "source-layer": "park", minzoom: 6,
      paint: { "fill-color": C.park, "fill-opacity": 0.6 },
    },
    {
      id: "graticule", type: "line", source: "graticule",
      paint: { "line-color": "#ffffff", "line-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.07, 5, 0.03, 7, 0], "line-width": 0.6 },
    },
    {
      id: "roads", type: "line", source: "omt", "source-layer": "transportation", minzoom: 5,
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary", "secondary"]]],
      paint: { "line-color": C.road, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 12, 2] },
    },
    {
      id: "state-borders", type: "line", source: "omt", "source-layer": "boundary", minzoom: 3,
      filter: ["all", ["==", ["get", "admin_level"], 4], ["!=", ["get", "maritime"], 1]],
      paint: { "line-color": C.state, "line-width": 0.6, "line-dasharray": [3, 2] },
    },
    {
      id: "country-borders", type: "line", source: "omt", "source-layer": "boundary",
      filter: ["all", ["==", ["get", "admin_level"], 2], ["!=", ["get", "maritime"], 1]],
      paint: { "line-color": C.border, "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 6, 1.2] },
    },
    {
      id: "country-labels", type: "symbol", source: "omt", "source-layer": "place", maxzoom: 6,
      filter: ["==", ["get", "class"], "country"],
      layout: {
        "text-field": ["upcase", ["coalesce", ["get", "name:en"], ["get", "name"]]],
        "text-font": font, "text-size": ["interpolate", ["linear"], ["zoom"], 1, 9, 5, 12],
        "text-letter-spacing": 0.18, "text-max-width": 8,
      },
      paint: { "text-color": C.label, "text-halo-color": C.land, "text-halo-width": 1 },
    },
    {
      id: "city-labels", type: "symbol", source: "omt", "source-layer": "place", minzoom: 4,
      filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": font, "text-size": ["interpolate", ["linear"], ["zoom"], 4, 10, 10, 14],
        "text-max-width": 8, "symbol-sort-key": ["get", "rank"],
      },
      paint: { "text-color": C.labelStrong, "text-halo-color": C.land, "text-halo-width": 1.2, "text-opacity": 0.75 },
    },
  ],
};
