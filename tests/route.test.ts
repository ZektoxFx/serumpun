import { findRoute } from '@/lib/route/findRoute';
import { loadGraph, nearestNode, type GraphFile } from '@/lib/route/graph';
import tiny from './fixtures/tiny-graph.json';

// A 2×3 grid about 100 m apart: 0-1-2 along the bottom, 3-4-5 along the top, and three rungs (0-3, 1-4, 2-5), so a
// walk from 0 to 2 has a direct way (through 1) and a way round (through 3, 4 and 5).
const g = loadGraph(tiny as GraphFile);
const at = (i: number) => g.nodes[i];
const hazard = (i: number) => ({ ...at(i), id: `h${i}`, label: `hazard ${i}` });

describe('Safe Walk routing', () => {
  it('with no hazards, follows the direct line', () => {
    const r = findRoute(g, at(0), at(2), [])!;
    expect(r.path).toEqual([at(0), at(1), at(2)]);
    expect(r.avoided).toEqual([]);
    expect(r.blocked).toBe(false);
    expect(Math.round(r.distanceM)).toBe(200);
    expect(r.minutes).toBe(3); // 200 m at 78 m a minute, rounded up
    expect(r.normalMinutes).toBe(r.minutes);
  });

  it('goes round a hazard on the direct middle node, and says how much longer', () => {
    const r = findRoute(g, at(0), at(2), [hazard(1)])!;
    expect(r.path).toEqual([at(0), at(3), at(4), at(5), at(2)]);
    expect(r.avoided).toEqual(['h1']);
    expect(r.blocked).toBe(false);
    expect(r.minutes).toBeGreaterThan(r.normalMinutes);
  });

  it('avoids a hazard halfway along a path, far from both of its ends', () => {
    const halfway = { lat: 3.18, lng: 101.51045, id: 'mid', label: 'halfway' }; // 50 m from nodes 0 and 1
    const r = findRoute(g, at(0), at(2), [halfway])!;
    expect(r.avoided).toEqual(['mid']);
    expect(r.path.slice(0, 2)).toEqual([at(0), at(3)]);
    expect(Math.round(r.distanceM)).toBe(400);
  });

  it('says blocked, with the usual path, when hazards close both ways', () => {
    const r = findRoute(g, at(0), at(2), [hazard(1), hazard(4)])!;
    expect(r.blocked).toBe(true);
    expect(r.path).toEqual([at(0), at(1), at(2)]);
    expect(r.avoided).toEqual(['h1']);
  });

  it('snaps the ends to the nearest nodes', () => {
    expect(nearestNode(g, { lat: 3.18002, lng: 101.51005 })).toBe(0);
    const r = findRoute(g, { lat: 3.17995, lng: 101.50995 }, { lat: 3.18005, lng: 101.5119 }, [])!;
    expect(r.path[0]).toEqual(at(0));
    expect(r.path.at(-1)).toEqual(at(2));
  });

  it('finds nothing between paths that never meet', () => {
    const apart = loadGraph({ nodes: [[3.18, 101.51], [3.18, 101.5109], [3.19, 101.52], [3.19, 101.5209]], edges: [[0, 1], [2, 3]] });
    expect(findRoute(apart, apart.nodes[0], apart.nodes[3], [])).toBeNull();
  });
});
