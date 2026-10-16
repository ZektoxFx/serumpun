import { AVOID_RADIUS_M } from '@/lib/domain/alerts';
import { distanceMeters, walkMinutes, type LatLng } from '@/lib/domain/geo';
import { nearestNode, type Graph } from './graph';

/** A confirmed hazard Safe Walk keeps away from; `label` is how the banner names it. */
export type Hazard = LatLng & { id: string; label: string };

export type Route = {
  path: LatLng[];
  distanceM: number;
  minutes: number;
  /** The usual way's minutes, so the banner can say how much longer the safe way is. */
  normalMinutes: number;
  /** The hazards on the usual way. */
  avoided: string[];
  /** No way round them: `path` is the usual way, and the walker must take care. */
  blocked: boolean;
  /** The usual way, drawn beside `path` when they differ. */
  usualPath: LatLng[];
};

/** How far `p` is from the path between `a` and `b`, in metres (flat ground is plenty over a few hundred metres). */
function segmentDistanceM(p: LatLng, a: LatLng, b: LatLng): number {
  const kx = 111_320 * Math.cos((p.lat * Math.PI) / 180);
  const ky = 110_574;
  const ax = (a.lng - p.lng) * kx;
  const ay = (a.lat - p.lat) * ky;
  const dx = (b.lng - a.lng) * kx;
  const dy = (b.lat - a.lat) * ky;
  const length2 = dx * dx + dy * dy;
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** A binary min-heap of [priority, node, metres so far]. */
class Heap {
  private items: [number, number, number][] = [];
  get size() {
    return this.items.length;
  }
  push(item: [number, number, number]) {
    const a = this.items;
    a.push(item);
    for (let i = a.length - 1; i > 0; ) {
      const parent = (i - 1) >> 1;
      if (a[parent][0] <= a[i][0]) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      i = parent;
    }
  }
  pop(): [number, number, number] {
    const a = this.items;
    const top = a[0];
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      for (let i = 0; ; ) {
        const left = 2 * i + 1;
        const right = left + 1;
        let least = i;
        if (left < a.length && a[left][0] < a[least][0]) least = left;
        if (right < a.length && a[right][0] < a[least][0]) least = right;
        if (least === i) break;
        [a[least], a[i]] = [a[i], a[least]];
        i = least;
      }
    }
    return top;
  }
}

/** A* with the straight line as its guide, never along a closed path: the points walked and the metres, or null. */
function aStar(g: Graph, start: number, end: number, closed: (a: number, b: number) => boolean) {
  const goal = g.nodes[end];
  const cost = new Float64Array(g.nodes.length).fill(Infinity);
  const previous = new Int32Array(g.nodes.length).fill(-1);
  const open = new Heap();
  cost[start] = 0;
  open.push([distanceMeters(g.nodes[start], goal), start, 0]);
  while (open.size > 0) {
    const [, n, soFar] = open.pop();
    if (n === end) break;
    if (soFar > cost[n]) continue; // a shorter way to n was queued after this one
    for (const { to, m } of g.adjacency[n]) {
      const next = soFar + m;
      if (next >= cost[to] || closed(n, to)) continue;
      cost[to] = next;
      previous[to] = n;
      open.push([next + distanceMeters(g.nodes[to], goal), to, next]);
    }
  }
  if (cost[end] === Infinity) return null;
  const nodes = [end];
  while (nodes[nodes.length - 1] !== start) nodes.push(previous[nodes[nodes.length - 1]]);
  return { nodes: nodes.reverse(), m: cost[end] };
}

/**
 * Safe Walk: the walk from `from` to `to` along the graph (both ends join it at their nearest point). The usual
 * (shortest) way first; if any of its paths passes within `radiusM` of a hazard, the shortest way with every such path
 * closed; if there is none, the usual way, blocked. Null when the two ends are on paths that never meet.
 */
export function findRoute(g: Graph, from: LatLng, to: LatLng, hazards: Hazard[], radiusM = AVOID_RADIUS_M): Route | null {
  const start = nearestNode(g, from);
  const end = nearestNode(g, to);
  const usual = aStar(g, start, end, () => false);
  if (!usual) return null;
  const near = (a: number, b: number) => (h: Hazard) => segmentDistanceM(h, g.nodes[a], g.nodes[b]) <= radiusM;
  const avoided = hazards.filter((h) => usual.nodes.some((n, i) => i > 0 && near(usual.nodes[i - 1], n)(h))).map((h) => h.id);
  const route = (r: { nodes: number[]; m: number }, blocked: boolean): Route => ({
    path: r.nodes.map((n) => g.nodes[n]),
    distanceM: r.m,
    minutes: walkMinutes(r.m),
    normalMinutes: walkMinutes(usual.m),
    avoided,
    blocked,
    usualPath: usual.nodes.map((n) => g.nodes[n]),
  });
  if (avoided.length === 0) return route(usual, false);
  const safe = aStar(g, start, end, (a, b) => hazards.some(near(a, b)));
  return safe ? route(safe, false) : route(usual, true);
}
