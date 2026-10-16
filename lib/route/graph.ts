import { distanceMeters, type LatLng } from '@/lib/domain/geo';

/** The walking graph file (public/data/elmina-walk.json): points as [lat, lng], and paths as pairs of point indexes. */
export type GraphFile = { nodes: [number, number][]; edges: [number, number][] };

/** The points, and for each one its neighbours with the walk to each in metres. */
export type Graph = { nodes: LatLng[]; adjacency: { to: number; m: number }[][] };

export function loadGraph(file: GraphFile): Graph {
  const nodes = file.nodes.map(([lat, lng]) => ({ lat, lng }));
  const adjacency: Graph['adjacency'] = nodes.map(() => []);
  for (const [a, b] of file.edges) {
    const m = distanceMeters(nodes[a], nodes[b]);
    adjacency[a].push({ to: b, m });
    adjacency[b].push({ to: a, m });
  }
  return { nodes, adjacency };
}

/** The point of the graph closest to `p`: where a walk from or to `p` joins the paths. */
export function nearestNode(g: Graph, p: LatLng): number {
  let best = 0;
  let bestM = Infinity;
  g.nodes.forEach((n, i) => {
    const m = distanceMeters(n, p);
    if (m < bestM) {
      best = i;
      bestM = m;
    }
  });
  return best;
}
