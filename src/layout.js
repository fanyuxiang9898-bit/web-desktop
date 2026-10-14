(function (root) {
  'use strict';
  const clone = nodes => nodes.map(({ id, x, y, w, h }) => ({ id, x, y, w, h }));
  const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  function validate(nodes, cols) {
    if (!Number.isInteger(cols) || cols < 1 || cols > 12 || !Array.isArray(nodes) || nodes.length > 100) return false;
    const ids = new Set();
    return nodes.every((n, i) => {
      if (typeof n.id !== 'string' || ids.has(n.id)) return false;
      ids.add(n.id);
      return ['x', 'y', 'w', 'h'].every(k => Number.isInteger(n[k])) && n.x >= 0 && n.y >= 0 && n.y <= 1000 && n.w >= 1 && n.h >= 1 && n.h <= 20 && n.x + n.w <= cols && !nodes.slice(0, i).some(b => overlap(n, b));
    });
  }
  function createEngine(nodes, cols) {
    const engine = new root.GridStack.Engine({ column: cols, mode: 'float' });
    engine.batchUpdate();
    for (const node of nodes) engine.addNode({ ...node });
    engine.batchUpdate(false, false);
    return engine;
  }
  function compact(nodes, cols) {
    const engine = createEngine(nodes, cols);
    engine.compact('compact');
    return clone(engine.nodes);
  }
  function change(nodes, cols, id, patch, swapId) {
    const original = clone(nodes);
    const current = original.find(n => n.id === id);
    if (!current) throw new Error('Element not found');
    const next = { ...current, ...patch, id };
    next.w = Math.min(cols, Math.max(1, Math.round(next.w)));
    next.h = Math.min(20, Math.max(1, Math.round(next.h)));
    next.x = Math.min(cols - next.w, Math.max(0, Math.round(next.x)));
    next.y = Math.min(1000, Math.max(0, Math.round(next.y)));
    const target = original.find(n => n.id === swapId && n.id !== id);
    let result;
    if (target) {
      const a = { ...current, x: target.x, y: target.y };
      const b = { ...target, x: current.x, y: current.y };
      const exchanged = original.map(n => n.id === id ? a : n.id === swapId ? b : n);
      if (validate(exchanged, cols)) result = exchanged;
      else {
        // Reserve the destination; GridStack makes room for differently-sized tiles.
        a.x = Math.min(a.x, cols - a.w);
        b.x = Math.min(b.x, cols - b.w);
        const engine = createEngine([{ ...a, locked: true }, b, ...original.filter(n => n.id !== id && n.id !== swapId)], cols);
        engine.nodes.forEach(n => { delete n.locked; });
        result = clone(engine.nodes);
      }
    } else {
      const engine = createEngine(original, cols);
      engine.moveNode(engine.nodes.find(n => n.id === id), { ...next, pack: false });
      result = clone(engine.nodes);
    }
    result = compact(result, cols);
    if (!validate(result, cols)) throw new Error('Invalid layout; operation cancelled');
    return result;
  }
  root.WebDesktopLayout = { clone, overlap, validate, compact, change };
  if (typeof module !== 'undefined') module.exports = root.WebDesktopLayout;
})(globalThis);
