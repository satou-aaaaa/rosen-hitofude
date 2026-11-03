// 路線図の問題を作る（ブラウザと検査で同じものを使う）。
(function (G) {
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function seedOf(str) { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  // 解の数を数える（limit まで）。始発 s から終点 e まで、全部の駅を1回ずつ
  function countPaths(n, adj, s, e, limit = 2) {
    const vis = new Uint8Array(n); let cnt = 0, steps = 0;
    function dead(cur, left) {
      let ones = 0;
      for (let v = 0; v < n; v++) {
        if (vis[v]) continue;
        let d = 0; for (const w of adj[v]) if (!vis[w] || w === cur) d++;
        if (d === 0) return true;
        if (d === 1 && v !== e) { ones++; if (ones > 1) return true; }
      }
      return false;
    }
    function go(cur, left) {
      if (cnt >= limit || ++steps > 4e6) return;
      if (left === 0) { if (cur === e) cnt++; return; }
      if (cur === e) return;
      if (dead(cur, left)) return;
      for (const w of adj[cur]) if (!vis[w]) { vis[w] = 1; go(w, left - 1); vis[w] = 0; }
    }
    vis[s] = 1; go(s, n - 1);
    return steps > 4e6 ? limit : cnt;
  }
  // W×H のマスに駅を置き、ランダムなひと筆の道を作ってから、答えが1つのまま線路を足す
  function make(seed, W, H, holes, extra) {
    const R = rng(seed);
    for (let tries = 0; tries < 200; tries++) {
      const cells = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) cells.push([x, y]);
      const hole = new Set(); while (hole.size < holes) { const i = Math.floor(R() * cells.length); const [x, y] = cells[i]; if (x > 0 && y > 0 && x < W - 1 && y < H - 1) hole.add(i); }
      const pts = cells.filter((_, i) => !hole.has(i)), n = pts.length, id = new Map(pts.map((p, i) => [p[0] + "," + p[1], i]));
      const nb = pts.map(([x, y]) => { const out = []; for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]]) { const j = id.get((x + dx) + "," + (y + dy)); if (j != null) out.push(j); } return out; });
      const isDiag = (a, b) => pts[a][0] !== pts[b][0] && pts[a][1] !== pts[b][1];
      // 斜めは少なめにして、同じ四角で斜め2本が交わらないようにする
      const crossKey = (a, b) => { const x = Math.min(pts[a][0], pts[b][0]), y = Math.min(pts[a][1], pts[b][1]); return x + "," + y; };
      // ひと筆の道（Warnsdorff ＋ 乱数）
      const start = Math.floor(R() * n), path = [start], used = new Uint8Array(n); used[start] = 1; const diagUsed = new Set();
      let ok = true;
      while (path.length < n) {
        const cur = path[path.length - 1];
        let cand = nb[cur].filter((j) => !used[j] && (!isDiag(cur, j) || (!diagUsed.has(crossKey(cur, j)) && R() < 0.35)));
        if (!cand.length) { ok = false; break; }
        const deg = (j) => nb[j].filter((k) => !used[k]).length;
        cand.sort((a, b) => deg(a) - deg(b) + (R() - 0.5) * 1.2);
        const nx = cand[0]; used[nx] = 1; if (isDiag(cur, nx)) diagUsed.add(crossKey(cur, nx)); path.push(nx);
      }
      if (!ok) continue;
      const key = (a, b) => (a < b ? a + "-" + b : b + "-" + a);
      const edges = new Set(), adj = pts.map(() => []);
      const add = (a, b) => { edges.add(key(a, b)); adj[a].push(b); adj[b].push(a); };
      const del = (a, b) => { edges.delete(key(a, b)); adj[a].splice(adj[a].indexOf(b), 1); adj[b].splice(adj[b].indexOf(a), 1); };
      for (let i = 1; i < n; i++) add(path[i - 1], path[i]);
      const s = path[0], e = path[n - 1];
      // 足せる線路の候補（たて・よこは多め、斜めは少し）
      const cands = [];
      for (let a = 0; a < n; a++) for (const b of nb[a]) if (a < b && !edges.has(key(a, b))) { if (!isDiag(a, b) || R() < 0.3) cands.push([a, b]); }
      for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
      let added = 0;
      for (const [a, b] of cands) {
        if (added >= extra) break;
        if (isDiag(a, b) && diagUsed.has(crossKey(a, b))) continue;
        add(a, b);
        if (countPaths(n, adj, s, e) === 1) { added++; if (isDiag(a, b)) diagUsed.add(crossKey(a, b)); } else del(a, b);
      }
      if (added < Math.ceil(extra * 0.6)) continue;
      return { W, H, pts, edges: [...edges].map((k) => k.split("-").map(Number)), s, e, sol: path };
    }
    throw new Error("問題を作れない");
  }
  const SIZES = [{ W: 4, H: 5, holes: 1, extra: 8, name: "各駅" }, { W: 5, H: 6, holes: 2, extra: 14, name: "快速" }, { W: 6, H: 7, holes: 3, extra: 22, name: "急行" }];
  const HARD = { W: 7, H: 8, holes: 4, extra: 30, name: "特急" };
  G.ROSEN = { rng, seedOf, countPaths, make, SIZES, HARD };
})(typeof window !== "undefined" ? window : globalThis);
