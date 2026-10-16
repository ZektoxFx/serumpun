// Builds public/data/elmina-walk.json, Safe Walk's walking graph, from OpenStreetMap: every way people can walk in City
// of Elmina's box, as points (one per OSM node, 6 decimals) and the paths between them, keeping only the largest set of
// connected paths so every walk can join it. Run with `node scripts/build-walk-graph.mjs` and commit the JSON.
// Map data © OpenStreetMap contributors, ODbL.
import fs from 'node:fs';

const BBOX = '3.160,101.492,3.214,101.529'; // south, west, north, east
const WALKABLE = [
  'footway', 'path', 'pedestrian', 'steps', 'living_street', 'residential', 'service', 'unclassified', 'track', 'tertiary',
  'tertiary_link', 'secondary', 'secondary_link',
];
const QUERY = `[out:json][timeout:120];way["highway"~"^(${WALKABLE.join('|')})$"]["access"!="private"]["foot"!="no"](${BBOX});out geom;`;
// The public Overpass servers, tried in turn: any of them can be busy or down for a while.
const SERVERS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const OUT = 'public/data/elmina-walk.json';

async function fetchWays() {
  for (const url of SERVERS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: new URLSearchParams({ data: QUERY }),
        headers: { 'User-Agent': 'serumpun-walk-graph/1.0 (SDP Hackathon 2026)' },
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return (await res.json()).elements.filter((e) => e.type === 'way' && e.geometry);
    } catch (error) {
      console.warn(`${url}: ${error.message}`);
    }
  }
  throw new Error('No Overpass server answered; try again later.');
}

const round = (x) => Math.round(x * 1e6) / 1e6;
const ways = await fetchWays();
const index = new Map(); // OSM node id -> point index
const nodes = [];
const edges = new Map(); // "a,b" with a < b -> [a, b]
for (const way of ways) {
  const ids = way.nodes.map((osmId, i) => {
    if (!index.has(osmId)) {
      index.set(osmId, nodes.length);
      nodes.push([round(way.geometry[i].lat), round(way.geometry[i].lon)]);
    }
    return index.get(osmId);
  });
  for (let i = 1; i < ids.length; i++) {
    const a = Math.min(ids[i - 1], ids[i]);
    const b = Math.max(ids[i - 1], ids[i]);
    if (a !== b) edges.set(`${a},${b}`, [a, b]);
  }
}

// Keep the largest connected set of paths: a walk that joined an island could never reach anything else.
const parent = nodes.map((_, i) => i);
const root = (i) => {
  while (parent[i] !== i) {
    parent[i] = parent[parent[i]];
    i = parent[i];
  }
  return i;
};
for (const [a, b] of edges.values()) parent[root(a)] = root(b);
const sizes = new Map();
for (let i = 0; i < nodes.length; i++) sizes.set(root(i), (sizes.get(root(i)) ?? 0) + 1);
const biggest = [...sizes].sort((x, y) => y[1] - x[1])[0][0];
const renumber = new Map(); // old index -> new index
const kept = [];
nodes.forEach((p, i) => {
  if (root(i) !== biggest) return;
  renumber.set(i, kept.length);
  kept.push(p);
});
const keptEdges = [...edges.values()].filter(([a]) => renumber.has(a)).map(([a, b]) => [renumber.get(a), renumber.get(b)]);

fs.mkdirSync('public/data', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ attribution: '© OpenStreetMap contributors, ODbL', nodes: kept, edges: keptEdges }));
console.log(
  `${ways.length} ways: ${kept.length} points and ${keptEdges.length} paths kept of ${nodes.length} points, ` +
    `${Math.round(fs.statSync(OUT).size / 1024)} KB`,
);
