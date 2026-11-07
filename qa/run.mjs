// 路線図ひと筆の検査。問題の作り方（答えが1つ・線路が交わらない・何千回）・通しで遊ぶ・戻る・ヒント・続きから・上級・記録・スマホ幅・PWA を確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { checkTransfer } from "./transfer-check.mjs";
import { checkSwStall } from "./sw-check.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const url = pathToFileURL(path.join(root, "index.html")).href; // # などを含むフォルダ名でも開ける
const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

// 1. 問題の作り方（ブラウザを使わない）。乱数で組むので何千回も作って毎回確かめる（shared-workflows incidents/2026-10-31-roppo-empty-village.md）
const sb = {}; sb.globalThis = sb; vm.runInNewContext(readFileSync(path.join(root, "gen.js"), "utf8"), sb);
const { make, countPaths, SIZES, HARD, seedOf } = sb.ROSEN;
function verify(p) {
  const n = p.pts.length, adj = p.pts.map(() => []), key = (a, b) => (a < b ? a + "-" + b : b + "-" + a), es = new Set();
  for (const [a, b] of p.edges) { adj[a].push(b); adj[b].push(a); es.add(key(a, b)); }
  const errs = [];
  if (new Set(p.sol).size !== n || p.sol.length !== n) errs.push("答えが全部の駅を通らない");
  for (let i = 1; i < n; i++) if (!es.has(key(p.sol[i - 1], p.sol[i]))) errs.push("答えに線路の無い区間");
  if (p.sol[0] !== p.s || p.sol[n - 1] !== p.e) errs.push("答えの始発・終点がずれる");
  if (countPaths(n, adj, p.s, p.e, 2) !== 1) errs.push("答えが1つでない");
  for (const [a, b] of p.edges) { const dx = Math.abs(p.pts[a][0] - p.pts[b][0]), dy = Math.abs(p.pts[a][1] - p.pts[b][1]); if (dx > 1 || dy > 1 || dx + dy === 0) errs.push("となりでない駅をつなぐ"); }
  const diag = new Map();
  for (const [a, b] of p.edges) if (p.pts[a][0] !== p.pts[b][0] && p.pts[a][1] !== p.pts[b][1]) { const k = Math.min(p.pts[a][0], p.pts[b][0]) + "," + Math.min(p.pts[a][1], p.pts[b][1]); diag.set(k, (diag.get(k) || 0) + 1); }
  if ([...diag.values()].some((c) => c > 1)) errs.push("斜めの線路が交わる");
  if (new Set(p.pts.map((q) => q.join())).size !== n) errs.push("駅が重なる");
  return errs;
}
for (const [label, list, N] of [["各駅", [SIZES[0]], 1500], ["快速", [SIZES[1]], 1000], ["急行", [SIZES[2]], 500], ["特急", [HARD], 150]]) {
  const bad = []; let extras = 0;
  for (let s = 1; s <= N; s++) { const z = list[0], p = make((s * 2654435761) >>> 0, z.W, z.H, z.holes, z.extra); const e = verify(p); if (e.length) bad.push(`${s}:${e[0]}`); extras += p.edges.length - (p.pts.length - 1); }
  check(`${label}を${N}回作って、毎回答えが1つ・線路が交わらない・答えが正しい`, bad.length === 0, bad.slice(0, 3).join(" | "));
  check(`${label}は答え以外の線路（まよう道）が平均${Math.round(list[0].extra * 0.8)}本以上`, extras / N >= list[0].extra * 0.8, `${(extras / N).toFixed(1)}本`);
}
{ const set = new Set(); for (let d = 1; d <= 60; d++) { const k = new Date(Date.UTC(2026, 10, 3 + d)).toISOString().slice(0, 10); set.add(JSON.stringify(make(seedOf(k + ":2"), SIZES[2].W, SIZES[2].H, SIZES[2].holes, SIZES[2].extra).sol)); }
  check("60日分の急行がすべてちがう（飽きない）", set.size === 60, `${set.size}/60`); }
{ const t = Date.now(); for (let s = 1; s <= 20; s++) make(s * 97, HARD.W, HARD.H, HARD.holes, HARD.extra); const ms = (Date.now() - t) / 20;
  check("いちばん大きい特急でも1問を0.5秒以内に作れる（スマホで待たせない）", ms < 500, `${ms.toFixed(0)}ms`); }

const html = readFileSync(path.join(root, "index.html"), "utf8");
check("終えた回を消すのは同じ回のときだけ・0時を過ぎたホームの「今日」のボタンは描き直す（2026-11-04 CodeRabbit）", /c\.date === run\.date && c\.id === run\.id\) s2\.runs\[MODE\] = null/.test(html) && /\$\("go-d"\)\.onclick = \(\) => \(k !== todayKey\(\) \? home\(\)/.test(html));
check("別のタブで今日の分を終えたあと、古い画面から今日・上級をもう一度始めない（2026-11-04 CodeRabbit）", /\(mode === "d" && s\.days\[k\]\) \|\| \(mode === "h" && s\.hdays\[k\]\)\) return;/.test(html));
check("README の URL のすぐ後ろに全角の字を続けない（Link check が URL の一部と読む。2026-11-04）", !/https?:\/\/[\x21-\x7e]*[^\x00-\x7f]/.test(readFileSync(new URL("../README.md", import.meta.url), "utf8").replace(/\]\(https?:\/\/[^)\s]+\)/g, "").replace(/<https?:\/\/[^>\s]+>/g, "")));
check("同じ回の途中経過は、全体の時刻でなく進み具合（解き途中の手の数）で選ぶ（2026-11-04 CodeRabbit）", /prog = \(r\) => [^\n]*r\.path\.length \* 10/.test(html));
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習・とことんの種だけ（今日の3路線・特急は日付の乱数）", (html.match(/Math\.random/g) || []).length === 3 && !/Math\.random/.test(readFileSync(path.join(root, "gen.js"), "utf8")));
check("好きなだけ遊べる：🎫・回数の制限・「…すると開く」を画面に入れない（2026-11-06 satou さん）", !/🎫|ELIFE|lifeStr|すると開く|で開きます/.test(html));
check("Ko-fi はページ下の1行と、結果の画面の1行（.kofi）だけ", (html.match(/ko-fi\.com\/satouaaaaa/g) || []).length === 2 && /<footer>[^\n]*ko-fi\.com/.test(html) && /class="note kofi"/.test(html));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/.test(html));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/rosen-hitofude/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームの name が3字以上（「感想」の2字だと GitHub がフォームを出さず白紙の Issue になる。shared-workflows incidents/2026-11-05-feedback-form-not-shown.md）", [...((fy.match(/^name:\s*(.+)$/m) || [])[1] || "").trim()].length >= 3 && /^description:\s*\S/m.test(fy), (fy.match(/^name:.*$/m) || [""])[0]);
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）", /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  { const st = await checkSwStall(sw); check("PWA：本文の途中で通信が止まっても4秒で保存したものを返す・ふつうはネットの返事", st.ok, JSON.stringify(st)); }
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：ネットの返事の保存は、イベントの中で waitUntil に預ける（遅れて届いた新しい版も保存できる）", /e\.waitUntil\(new Promise\(\(r\) => \{ saved = r; \}\)\)/.test(sw));
  check("PWA：sw.js は画面のファイルを全部保存し、外へ何も送らない", ["./index.html", "./transfer.js", "./gen.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f)) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "路線図ひと筆" && mf.icons.length >= 2); }

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/.test(t);
const errors = [];
async function newPage(w = 390, h = 844, days = 0) { // days: 時計を何日進めるか（過去7日・カレンダーの検査）
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  if (days) await page.addInitScript((off) => { const RD = Date; window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; }, days * 864e5);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && !isNoise(m.text())) errors.push(m.text()); });
  await page.goto(url); await page.evaluate(() => localStorage.clear()); await page.reload();
  return page;
}
// 駅を本当に押す（画面の座標で）
async function tapStation(page, i) {
  const box = await page.locator(`#st${i} circle`).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const sol = (page) => page.evaluate(() => window.__rh.state().P.sol);
const cur = (page) => page.evaluate(() => window.__rh.state().path);
try {
  const page = await newPage();
  check("はじめて開くと遊び方が出る", await page.locator("#howto[open]").count() === 1);
  await page.keyboard.press("Escape"); await page.waitForTimeout(100); check("遊び方を Esc で閉じられる", await page.locator("#howto[open]").count() === 0);
  await page.reload(); await page.waitForTimeout(200); check("遊び方を Esc で閉じても、開き直したとき出ない", await page.locator("#howto[open]").count() === 0);
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(200); await page.click("#howto-ok"); await page.reload(); await page.waitForTimeout(200); check("遊び方を「わかった」で閉じてすぐ読み直しても出ない", await page.locator("#howto[open]").count() === 0);
  { let again = 0; for (let i = 0; i < 10; i++) { await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(200); await page.keyboard.press("Escape"); await page.reload(); await page.waitForTimeout(200); again += await page.locator("#howto[open]").count(); } check("遊び方を Esc で閉じてすぐ読み直しても出ない（10回）", again === 0); }
  await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForTimeout(200); check("「わかった」を押したその場で「見た」が残る", await page.locator("#howto-ok").evaluate((b) => { b.click(); return Object.keys(localStorage).some((k) => { try { return JSON.parse(localStorage.getItem(k)).tut === true; } catch { return false; } }); }));
  check("連続の日が0のときは出さない（休んだ日を責めない）", !(await page.textContent("#app")).includes("連続"));
  check("遊ぶ前の画面に Ko-fi のひとことが無い", (await page.locator(".kofi").count()) === 0);
  check("はじめて開いた日から上級（特急）を押せる（好きなだけ遊べる・🔒で開くモードを入れない。2026-11-06 satou さん）", (await page.locator("#go-h").count()) === 1 && (await page.locator("#go-e").count()) === 1 && (await page.locator("#go-p").count()) === 1 && !/🔒|すると開く|で開きます|🎫/.test(await page.textContent("#app")));
  check("感想を送るリンクがある", (await page.getAttribute("#f-fb", "href")) === "https://github.com/satou-aaaaa/rosen-hitofude/issues/new?template=feedback.yml");
  const same = await page.evaluate(() => { const k = window.__rh.todayKey(), a = window.__rh.dailyTags(k).map((t) => JSON.stringify(window.__rh.puzzle(t).sol)); return a.length === 3 && new Set(a).size === 3; });
  check("今日の3路線はちがう3つ", same);

  await page.click("#go-d");
  const s1 = await sol(page);
  check("はじめは始発にいる", JSON.stringify(await cur(page)) === JSON.stringify([s1[0]]));
  // となりでない駅は押せない
  const far = await page.evaluate(() => { const { P } = window.__rh.state(); return P.pts.findIndex((_, i) => i !== P.s && !P.adj[P.s].includes(i)); });
  await tapStation(page, far);
  check("線路でつながっていない駅は押しても進まない", (await cur(page)).length === 1);
  check("線路でつながっていない駅を押すと、その駅が小さくゆれる（押したのは伝わる）", (await page.locator(`#st${far}.nope`).count()) === 1);
  await tapStation(page, s1[1]); await tapStation(page, s1[2]); await tapStation(page, s1[3]);
  check("つながった駅を押すと進む", (await cur(page)).length === 4);
  check("着いた駅がはずむ（押した手ごたえ）", (await page.locator(`#st${s1[3]}.pop`).count()) === 1);
  await tapStation(page, s1[1]);
  check("通った駅を押すとそこまで戻る", (await cur(page)).length === 2);
  await page.click("#undo");
  check("ひとつ戻るで1つ前の駅へ", (await cur(page)).length === 1);
  // 終点は最後まで入れない
  const eNear = await page.evaluate(() => { const { P } = window.__rh.state(); return P.adj[P.s].includes(P.e); });
  if (eNear) { await tapStation(page, s1[s1.length - 1]); check("終点は最後の1駅になるまで入れない", (await cur(page)).length === 1); }
  // ヒント：まちがった道のあとに押すと正しいところまで戻して次を光らせる
  const wrong = await page.evaluate(() => { const { P } = window.__rh.state(); return P.adj[P.s].find((j) => j !== P.sol[1] && j !== P.e); });
  if (wrong != null) { await tapStation(page, wrong); await page.click("#hint"); check("ヒントはまちがった所まで戻して、次の正しい駅を光らせる", JSON.stringify(await cur(page)) === JSON.stringify([s1[0]]) && await page.locator(".hintst").count() === 1); }
  else { await page.click("#hint"); check("ヒントで次の駅が光る", await page.locator(".hintst").count() === 1); }
  // 途中で読み込み直しても、通った駅とヒントの回数が残る
  await tapStation(page, s1[1]); await tapStation(page, s1[2]);
  await page.reload(); await page.click("#go-d");
  check("途中で閉じても、通った駅のまま続きから", (await cur(page)).length === 3);
  await page.click("#back"); await page.click("#go-p"); await page.locator(".pick button").first().click(); await page.click("#back"); await page.click("#go-d");
  check("練習を始めても、今日の途中経過は消えない（通った駅のまま続きから）", (await cur(page)).length === 3 && (await page.evaluate(() => window.__rh.mode())) === "d");
  check("終点の先にしか無い駅は「もう行けない駅」に入れ、終点そのものは入れない（終点は最後にしか入れないため。2026-11-05 CodeRabbit）", await page.evaluate(() => { const P = { pts: [0, 0, 0, 0], adj: [[1], [0, 2], [1, 3], [2]], s: 0, e: 2 }; return JSON.stringify(window.__rh.lostOf(P, [0])) === "[3]" && JSON.stringify(window.__rh.lostOf(P, [0, 1])) === "[3]"; }));
  { // 行き止まり・もう行けない駅を知らせる（答えは言わない）
    const r = await page.evaluate(() => { const g = window.__rh, { P } = g.state(), back = g.state().path.slice();
      const walk = [P.s]; while (true) { const c = walk[walk.length - 1], n = P.adj[c].filter((j) => !walk.includes(j) && j !== P.e); if (!n.length) break; const w = n.find((j) => j !== P.sol[walk.length]) ?? n[0]; walk.push(w); }
      g.tryStep(P.s); for (const i of walk.slice(1)) g.tryStep(i);
      const vis = new Set(walk), cur = walk[walk.length - 1], warn = document.getElementById("warn");
      const lostX = (P, walk) => { const vis = new Set(walk), cur = walk[walk.length - 1], ok = new Set(); const go = (x) => { ok.add(x); if (x === P.e) return; P.adj[x].forEach((w) => { if (!vis.has(w) && !ok.has(w)) go(w); }); }; go(cur); return P.pts.map((_, v) => v).filter((v) => !vis.has(v) && !ok.has(v)); }; const want = lostX(P, walk);
      const lostOk = JSON.stringify([...document.querySelectorAll(".st.lost")].map((e) => +e.id.slice(2)).sort((a, b) => a - b)) === JSON.stringify(want);
      const out = { len: walk.length, n: P.pts.length, shown: !warn.hidden, text: warn.textContent, lostOk, lost: document.querySelectorAll(".st.lost").length };
      g.tryStep(P.s); for (const i of back.slice(1)) g.tryStep(i);
      out.after = warn.hidden && !document.querySelector(".st.lost"); return out; });
    check("行き止まりになると「行き止まり」と出て、赤い点線はもう行けない駅だけ・戻ると消える", r.len < r.n && r.shown && r.text.includes("行き止まり") && r.lostOk && r.after, JSON.stringify(r));
  }
  { // 何百通りのまちがった道で、知らせの正しさを確かめる（行けない駅だけを赤くし、行き止まりでは必ず知らせる）
    const r = await page.evaluate(() => { const g = window.__rh, P0 = g.state().P, back = g.state().path.slice(); let bad = 0, warned = 0, stuckN = 0;
      for (let t = 0; t < 300; t++) { let x = (t * 2654435761) >>> 0; const R = () => ((x = (Math.imul(x, 1103515245) + 12345) >>> 0) / 4294967296);
        g.tryStep(P0.s); const walk = [P0.s];
        for (let k = 0; k < 40; k++) { const c = walk[walk.length - 1], n = P0.adj[c].filter((j) => !walk.includes(j) && (j !== P0.e || walk.length === P0.pts.length - 1)); if (!n.length) break; const w = n[Math.floor(R() * n.length)]; walk.push(w); g.tryStep(w); if (walk.length === P0.pts.length) break; }
        if (g.state().won) continue;
        const vis = new Set(walk), cur = walk[walk.length - 1], stuck = !P0.adj[cur].some((j) => !vis.has(j) && (j !== P0.e || walk.length === P0.pts.length - 1));
        const lostX = (P, walk) => { const vis = new Set(walk), cur = walk[walk.length - 1], ok = new Set(); const go = (x) => { ok.add(x); if (x === P.e) return; P.adj[x].forEach((w) => { if (!vis.has(w) && !ok.has(w)) go(w); }); }; go(cur); return P.pts.map((_, v) => v).filter((v) => !vis.has(v) && !ok.has(v)); }; const lost = lostX(P0, walk);
        const shown = [...document.querySelectorAll(".st.lost")].map((e) => +e.id.slice(2)).sort((a, b) => a - b);
        if (JSON.stringify(shown) !== JSON.stringify(lost) || (stuck && document.getElementById("warn").hidden)) bad++;
        if (stuck) stuckN++; if (!document.getElementById("warn").hidden) warned++; }
      g.tryStep(P0.s); for (const i of back.slice(1)) g.tryStep(i); return { bad, warned, stuckN }; });
    check("300通りのまちがった道で、赤い点線はもう行けない駅とぴったり同じ・行き止まりは必ず知らせる", r.bad === 0 && r.stuckN > 0, JSON.stringify(r));
  }
  { // 遠くで切り離された駅のかたまりも全部赤くする（2026-11-04 CodeRabbit：2026-11-04 の1路線目で 17→16→15→12→8→4→1→0 と進むと11駅が行けなくなるのに、1駅しか赤くならなかった）
    const r = await page.evaluate(() => { const g = window.__rh, P = g.puzzle("d:2026-11-04:0"), walk = [17, 16, 15, 12, 8, 4, 1, 0];
      const okWalk = walk[0] === P.s && walk.every((v, i) => i === 0 || P.adj[walk[i - 1]].includes(v));
      return { okWalk, lost: g.lostOf(P, walk) }; });
    check("切り離された駅のかたまりも、もう行けない駅として全部知らせる", r.okWalk && JSON.stringify(r.lost) === "[2,3,5,6,7,9,10,11,13,14,18]", JSON.stringify(r));
  }
  for (const i of s1.slice(3)) await tapStation(page, i);
  check("全部の駅を通って終点に着くと開通・ヒント1回で★2（取れなかった星は白抜きの☆）", (await page.textContent(".verdict")).includes("開通") && (await page.locator(".verdict .stars").textContent()).replace(/[^★]/g, "").length === 2 && (await page.locator(".verdict .stars .off").textContent()) === "☆");
  check("開通したあとは駅を押しても動かない", await page.isDisabled("#undo"));
  check("はじめて開通すると、開通の画面に小さく「🏅 実績：はじめての開通」", (await page.locator(".verdict .achnew").textContent()).includes("はじめての開通"));
  check("開通すると、通った順に駅が光る（解けた手ごたえ）", (await page.locator(".st.won-st").count()) === s1.length);
  await page.click("#next");
  // 2・3路線目はなぞって（ドラッグで）解く
  for (let r = 0; r < 2; r++) {
    const s = await sol(page), pts = [];
    for (const i of s) { const b = await page.locator(`#st${i} circle`).boundingBox(); pts.push([b.x + b.width / 2, b.y + b.height / 2]); }
    await page.mouse.move(...pts[0]); await page.mouse.down();
    for (let j = 1; j < pts.length; j++) { const [x0, y0] = pts[j - 1], [x1, y1] = pts[j]; for (let t = 1; t <= 4; t++) await page.mouse.move(x0 + (x1 - x0) * t / 4, y0 + (y1 - y0) * t / 4); }
    await page.mouse.up();
    if (!(await page.locator(".verdict").count())) { const c = await cur(page); check(`${r + 2}路線目をなぞって解ける`, false, `${c.length}/${s.length} 止まった駅 ${s[c.length]} ${JSON.stringify(pts[c.length])} vp ${JSON.stringify(page.viewportSize())}`); break; }
    if (r === 0) check("取った実績は2回目には出さない", (await page.locator(".verdict .achnew").count()) === 0);
    await page.click("#next");
  }
  check("なぞって解ける（ドラッグ）・3路線で結果へ", (await page.locator(".mini > div").count()) === 3);
  const share = await page.textContent(".share");
  check("シェアの文に番号と3路線の星があり、駅名（答え）は出さない", /路線図ひと筆 #\d+/.test(share) && /各駅 ★★☆/.test(share) && /急行 ★★★/.test(share) && !(await page.evaluate(() => window.__rh.state().P.names.some((n) => document.querySelector(".share").textContent.includes(n)))));
  check("X・LINE は押したときに開くリンクだけ", /^https:\/\/twitter\.com\/intent\/tweet\?text=/.test(await page.getAttribute("#toX", "href")) && /^https:\/\/line\.me\/R\/share\?text=/.test(await page.getAttribute("#toLine", "href")));
  check("ヒントを使った日は Ko-fi のひとことを出さない", (await page.locator(".kofi").count()) === 0);
  await page.click("#back");
  check("ホームで乗った日1・開通3・ヒントなし2・連続1日（1以上なので小さく出す）・今日の結果を見るに変わる", (await page.textContent(".stats")).replace(/\s/g, "") === "1乗った日3開通した路線2ヒントなし" && (await page.textContent(".rank .streak")) === "連続1日" && (await page.textContent("#go-d")).includes("今日の結果"));
  check("乗車スタンプに今日の「済」", (await page.locator(".stamps .got.today").count()) === 1);

  // 上級：ヒントが無い・解くと結果
  await page.click("#go-h");
  check("上級（特急）はヒントのボタンが無く、56マスより少し少ない駅", (await page.locator("#hint").count()) === 0 && (await page.evaluate(() => window.__rh.state().P.pts.length)) === 52);
  for (const i of (await sol(page)).slice(1)) await page.evaluate((i) => window.__rh.tryStep(i), i);
  await page.click("#next");
  check("特急を解くと結果の画面", (await page.textContent("header")).includes("特急"));
  check("ヒントなしで初めて解いた上級の結果に Ko-fi のひとことが1行", (await page.locator(".kofi").count()) === 1);
  await page.click("#back");
  check("ホームの特急は結果を見るに変わる", (await page.textContent("#go-h")).includes("結果"));

  // 練習：記録の日を増やさない
  await page.click("#go-p"); await page.locator(".pick button").first().click();
  for (const i of (await sol(page)).slice(1)) await page.evaluate((i) => window.__rh.tryStep(i), i);
  await page.click("#next");
  check("練習は今日の記録を増やさず、終わると練習の選び直しへ", (await page.evaluate(() => Object.keys(window.__rh.load().days).length)) === 1 && (await page.locator(".pick").count()) === 1);
  // 別のタブで先に進んでいたら、古い画面の開通は記録に足さず、今の路線を出し直す
  await page.locator(".pick button").first().click();
  const cnt0 = await page.evaluate(() => window.__rh.load().cnt);
  await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("rosen-v1")); s.runs.p.tags[0] = "p:0:12345"; localStorage.setItem("rosen-v1", JSON.stringify(s)); });
  for (const i of (await sol(page)).slice(1)) await page.evaluate((i) => window.__rh.tryStep(i), i);
  check("古いタブで開通しても数えず、今の路線（別の画面で変わった方）を出し直す", (await page.evaluate(() => window.__rh.load().cnt)) === cnt0 && (await page.locator(".verdict").count()) === 0);
  await page.close();

  { // とことん：次々に出る・各駅→快速→急行→特急・ヒントは何回でも（🎫なし。2026-11-06 satou さん「好きなだけ遊んでほしい」）・降りると自己ベスト（2026-11-05 satou さん「一日で遊べる量が少なすぎる」）
    const pe = await newPage(); await pe.click("#howto-ok");
    const solveE = async () => { await pe.evaluate(() => { const g = window.__rh, { P } = g.state(); g.tryStep(P.s); for (const i of P.sol.slice(1)) g.tryStep(i); }); await pe.click("#next"); };
    check("とことんの並び（300回）：各駅3→快速5→急行10→特急42、同じ種は出ない", await pe.evaluate(() => { const g = window.__rh; for (let n = 0; n < 300; n++) { const L = g.endlessList(); if (L.length !== 60 || new Set(L.map((t) => t.split(":")[2])).size !== 60) return false; if (!L.every((t, i) => t.split(":")[1] === String(i < 3 ? 0 : i < 8 ? 1 : i < 18 ? 2 : 3))) return false; } return true; }));
    check("とことんの路線は大きさどおりに作れて、答えが1本の道（各大きさ5本ずつ）", await pe.evaluate(() => { const g = window.__rh, L = g.endlessList(); return [0, 3, 8, 18].every((st) => L.slice(st, st + 5).every((t) => { const P = g.puzzle(t), z = g.sizeOf(t); return P.pts.length === z.W * z.H - z.holes && P.sol.length === P.pts.length && P.sol[0] === P.s && P.sol[P.sol.length - 1] === P.e; })); }));
    check("とことんを使い切ると特急を20路線足す（300回）：前の種と重ならない", await pe.evaluate(() => { const g = window.__rh; for (let n = 0; n < 300; n++) { const L = g.endlessList(), M = g.moreList(L), A = L.concat(M); if (M.length !== 20 || !M.every((t) => t.split(":")[1] === "3") || new Set(A.map((t) => t.split(":")[2])).size !== 80) return false; } return true; }));
    check("ホームに「とことん」の大きなボタン", (await pe.locator("#go-e.main").count()) === 1);
    await pe.click("#go-e");
    for (let j = 0; j < 3; j++) await solveE();
    check("とことんは何路線目かを出し、🎫は無い・4路線目から快速", (await pe.textContent("header")).includes("4路線目") && (await pe.textContent("header")).includes("快速") && (await pe.evaluate(() => window.__rh.load().runs.e.life)) === undefined && !(await pe.textContent("#app")).includes("🎫") && (await pe.textContent("#quit")).includes("3路線で終える"));
    for (let j = 0; j < 4; j++) await pe.click("#hint");
    check("とことんのヒントは何回でも押せて（4回）、回は終わらない", !(await pe.locator("#hint").isDisabled()) && (await pe.locator("#quit").count()) === 1 && (await pe.evaluate(() => window.__rh.load().runs.e.curHints)) === 4);
    await pe.evaluate(() => { const k = "rosen-v1", s = JSON.parse(localStorage.getItem(k)); s.runs.e.curHints = 2; s.runs.e.path = null; localStorage.setItem(k, JSON.stringify(s)); });
    await pe.click("#back");
    check("ホームのボタンは「とことんの続きから」", (await pe.textContent("#go-e")).includes("続きから（4路線目）"));
    await pe.click("#go-e");
    check("とことんは途中で閉じても続きから（4路線目・ヒント2回のまま）", (await pe.textContent("header")).includes("4路線目") && (await pe.evaluate(() => window.__rh.load().runs.e.curHints)) === 2);
    await pe.click("#quit");
    check("降りると開通の数と自己ベスト更新が出て、記録に残る（今日の記録・連続には入らない・シェアは出さない）", (await pe.textContent("#eres")).includes("3路線") && (await pe.textContent("#ebest")).includes("自己ベスト更新") && (await pe.locator("#share").count()) === 0 && (await pe.evaluate(() => { const s = window.__rh.load(); return s.ebest === 3 && !s.runs.e && Object.keys(s.days).length === 0 && s.cnt === 3; })));
    await pe.click("#go-e"); await pe.click("#quit");
    check("ベストに届かないと、ベストと「あと何路線で更新」を出し、ベストは下げない", (await pe.textContent("#ebest")).includes("あと4路線で更新") && (await pe.evaluate(() => window.__rh.load().ebest)) === 3);
    await pe.click("#go-e");
    await pe.evaluate(() => { const k = "rosen-v1", s = JSON.parse(localStorage.getItem(k)); s.runs.e.life = 0; localStorage.setItem(k, JSON.stringify(s)); }); await pe.click("#back"); await pe.click("#go-e");
    check("前の版の途中経過（🎫の life が0）でも読めて、ヒントは押せる", !(await pe.locator("#hint").isDisabled()) && !(await pe.textContent("#app")).includes("🎫"));
    await pe.evaluate(() => { const k = "rosen-v1", s = JSON.parse(localStorage.getItem(k)); const r = s.runs.e; r.tags = r.tags.slice(0, 1); r.i = 0; r.path = null; r.curHints = 0; localStorage.setItem(k, JSON.stringify(s)); }); await pe.click("#back"); await pe.click("#go-e");
    await solveE();
    check("とことんの並びを使い切っても終わらず、特急を足して次の路線へ", await pe.evaluate(() => { const r = window.__rh.load().runs.e; return r.i === 1 && r.tags.length === 21 && r.tags[1].split(":")[1] === "3"; }) && (await pe.locator("#quit").count()) === 1 && (await pe.textContent("header")).includes("特急"));
    check("路線を足した後も同じ回として見分ける（並びでなく id）", await pe.evaluate(() => { const g = window.__rh, r = g.load().runs.e, r2 = Object.assign({}, r, { tags: r.tags.slice(0, 1) }), o = Object.assign({}, r, { id: "other" }); return g.runId(r) === g.runId(r2) && g.runId(r) !== g.runId(o) && g.runId({ tags: ["a"] }) !== g.runId({ tags: ["b"] }); }));
    await pe.click("#quit");
    check("終わりの画面に「もう一度とことん」", (await pe.locator("#go-e.main").count()) === 1 && (await pe.textContent("#go-e")).includes("もう一度"));
    check("保存に失敗したあとの統合でも、自己ベストは大きいほうを残す", await pe.evaluate((K) => { const g = window.__rh, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 9, ebest: 2 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, ebest: 7 }))); const r = g.load().ebest; mem = null; return r === 7; }, "rosen-v1"));
    await pe.close(); }
  { // 今日の3路線の結果に「続けて遊ぶ：とことん」
    const pr = await newPage(); await pr.click("#howto-ok"); await pr.click("#go-d");
    for (let j = 0; j < 3; j++) { await pr.evaluate(() => { const g = window.__rh, { P } = g.state(); for (const i of P.sol.slice(1)) g.tryStep(i); }); await pr.click("#next"); }
    check("今日の3路線の結果に「続けて遊ぶ：とことん」の大きなボタン", (await pr.locator("#go-e.main").count()) === 1 && (await pr.textContent("#go-e")).includes("とことん"));
    await pr.click("#go-e");
    check("結果の画面からとことんを始められる", (await pr.evaluate(() => window.__rh.mode())) === "e" && (await pr.textContent("header")).includes("1路線目"));
    await pr.close(); }
  for (const w of [320, 390]) { // とことんの遊ぶ画面（特急も）・終わりの画面もスマホ幅で崩れない
    const pv = await newPage(w, 700); await pv.click("#howto-ok");
    const look = () => pv.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.id || e.textContent.trim().slice(0, 6)) }));
    const h0 = await look(); await pv.click("#go-e"); const a = await look();
    await pv.evaluate(() => { const k = "rosen-v1", s = JSON.parse(localStorage.getItem(k)); s.runs.e.i = 20; localStorage.setItem(k, JSON.stringify(s)); }); await pv.click("#back"); await pv.click("#go-e"); const b = await look();
    const hd = await pv.evaluate(() => document.querySelector("header").getBoundingClientRect().height);
    const gap = await pv.evaluate(() => { const svg = document.querySelector("#map svg"); return svg.getBoundingClientRect().width / svg.viewBox.baseVal.width * 60; });
    await pv.click("#quit"); const c = await look();
    check(`幅${w}px：ホーム・とことんの遊ぶ画面（特急も）・終わりの画面は横にはみ出さず、押せる所は高さ44px以上・駅の間は40px以上`, [h0, a, b, c].every((x) => !x.over && x.small.length === 0) && hd < 70 && gap >= 40 && (await pv.textContent("#eres")).includes("20路線"), [h0, a, b, c].flatMap((x) => x.small).join(",") + ` 見出し${hd}px 駅の間${gap.toFixed(0)}px`);
    await pv.close(); }
  // スマホ幅：はみ出さない・押せる所は44px以上・駅の押せる広さ
  for (const w of [320, 390]) {
    const p3 = await newPage(w, 700); const fb2 = await p3.evaluate(() => { const a = document.querySelector("#howto #fb2"); return a ? a.getBoundingClientRect().height : 0; }); check(`幅${w}px：遊び方の「感想を送る」も高さ44px以上`, fb2 >= 44, `${fb2}px`); await p3.click("#howto-ok");
    const homeOk = await p3.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    await p3.click("#go-d");
    const r = await p3.evaluate(() => ({ over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim() || e.id) }));
    check(`幅${w}px：横にはみ出さず、押せる所は高さ44px以上`, homeOk && !r.over && r.small.length === 0, r.small.join(","));
    await p3.close();
  }
  { const p4 = await newPage(320, 700); await p4.click("#howto-ok");
    await p4.evaluate(() => { const k = window.__rh.todayKey(); const s = { v: 1, tut: true, days: {}, hdays: {}, cnt: 0, clean: 0, runs: { h: { mode: "h", date: k, tags: [`h:${k}`], i: 0, hints: [], path: null } }, kofi: {} }; localStorage.setItem("rosen-v1", JSON.stringify(s)); });
    await p4.reload(); await p4.evaluate(() => window.__rh.play("h"));
    const gap = await p4.evaluate(() => { const svg = document.querySelector("#map svg"); return svg.getBoundingClientRect().width / svg.viewBox.baseVal.width * 60; });
    check("幅320pxの特急でも、駅と駅の間が40px以上（押しまちがえにくい）", gap >= 40, `${gap.toFixed(0)}px`);
    await p4.close(); }
  // 2026-11-07 UI/UX：はじめての人がスマホで迷わない（最初のボタンが見える・上級のボタンが1行・札が切れない・行ける駅・開通の知らせが近い）
  for (const [w, h] of [[390, 844], [320, 640]]) {
    const pu = await newPage(w, h); await pu.click("#howto-ok");
    const hm = await pu.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(), svg = document.querySelector(".hero svg").getBoundingClientRect();
      const tags = [...document.querySelectorAll(".hero svg rect[rx='5']")].map((e) => e.getBoundingClientRect());
      const lines = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const bands = [];
        for (const q of [...rg.getClientRects()].filter((q) => q.width > 0 && q.height > 0)) { const b = bands.find((b) => q.top < b.bottom && q.bottom > b.top); if (b) { b.top = Math.min(b.top, q.top); b.bottom = Math.max(b.bottom, q.bottom); } else bands.push({ top: q.top, bottom: q.bottom }); }
        return bands.length; }; // 縦に重なる文字の箱は同じ行（<small> は上の位置がずれる）
      return { d: r("go-d").bottom, h: r("go-h").height, hl: lines(document.getElementById("go-h")), e: r("go-e").bottom, over: document.documentElement.scrollWidth > innerWidth, tagOk: tags.length === 2 && tags.every((t) => t.top >= svg.top - 0.5) }; });
    check(`${w}×${h}：ホームの「今日の3路線に乗る」が最初の画面に収まり、上級のボタンは1行・横にはみ出さない`, hm.d <= h && hm.hl === 1 && hm.h <= 56 && !hm.over && (w === 320 || hm.e <= h), JSON.stringify(hm));
    check(`${w}×${h}：ホームの路線図で「始」「終」の札が上で切れない`, hm.tagOk);
    await pu.click("#go-d");
    const pl = await pu.evaluate(() => { const g = window.__rh, { P } = g.state(); const can = () => [...document.querySelectorAll("#map .st.can")].map((e) => +e.id.slice(2)).sort((a, b) => a - b);
      const want = (path) => { const vis = new Set(path), c = path[path.length - 1], lost = g.lostOf(P, path); return P.adj[c].filter((j) => !vis.has(j) && !lost.includes(j) && (j !== P.e || path.length === P.pts.length - 1)).sort((a, b) => a - b); };
      const a = JSON.stringify(can()) === JSON.stringify(want([P.s])); for (const i of P.sol.slice(1, 4)) g.tryStep(i);
      const b = JSON.stringify(can()) === JSON.stringify(want(P.sol.slice(0, 4))) && can().length >= 1;
      const tut = document.querySelector(".tut"); return { a, b, tutLines: tut ? Math.round(tut.getBoundingClientRect().height / parseFloat(getComputedStyle(tut).lineHeight || 20)) : 0, tutLen: tut ? tut.textContent.length : 0 }; });
    check(`${w}×${h}：いま行ける駅（となりで、まだ通っていない駅）だけに緑の縁が付く（正しい駅は言わない）`, pl.a && pl.b, JSON.stringify(pl));
    check(`${w}×${h}：はじめの一言は短い（30字以内）`, pl.tutLen > 0 && pl.tutLen <= 30, JSON.stringify(pl));
    await pu.evaluate(() => { const g = window.__rh, { P } = g.state(); for (const i of P.sol.slice(4)) g.tryStep(i); });
    await pu.waitForTimeout(150);
    const wn = await pu.evaluate(() => ({ ctl: getComputedStyle(document.querySelector(".row.ctl")).display, can: document.querySelectorAll("#map .st.can").length, nx: document.querySelector(".verdict").getBoundingClientRect().top - document.getElementById("map").getBoundingClientRect().bottom }));
    check(`${w}×${h}：開通したら使えないボタンの列をしまい、開通の知らせ（次の路線へ）を路線図のすぐ下（80px以内）に出す`, wn.ctl === "none" && wn.can === 0 && wn.nx < 80, JSON.stringify(wn));
    await pu.click("#next");
    check(`${w}×${h}：次の路線ではボタンの列がまた出る`, await pu.evaluate(() => getComputedStyle(document.querySelector(".row.ctl")).display !== "none" && !document.getElementById("app").classList.contains("won")));
    await pu.close(); }
  { // 上の段の「始」「終」の札は、どの大きさの路線図でも図の中に収まる（何百枚も作って見る）
    const pz = await newPage(390, 844); await pz.click("#howto-ok");
    const TOPv = Number((html.match(/\bTOP = (\d+(?:\.\d+)?)/) || [])[1]); // index.html の TOP（札の上にあける幅）と同じ値で見る
    const r = await pz.evaluate((TOP) => { const g = window.__rh; let bad = 0, top = 0, extra = 0;
      for (let z = 0; z < 4; z++) for (let s = 1; s <= 150; s++) { const P = g.puzzle(`p:${z}:${s * 7919}`), d = document.createElement("div"); d.innerHTML = g.mapSvg(P, {}); const vb = d.firstChild.getAttribute("viewBox").split(" ").map(Number);
        const ys = [...d.querySelectorAll("rect[rx='5']")].map((e) => +e.getAttribute("y")); if (ys.some((y) => y < vb[1])) bad++; if (vb[1] < 0) top++;
        if (ys.length && ys.every((y) => y >= TOP) && vb[1] < 0) extra++; } // 札が上の段に無いのに上をあけた図
      return { bad, top, extra }; }, TOPv);
    check("600枚の路線図で「始」「終」の札が図の上で切れない（上の段にあるときだけ上をあけ、それ以外はあけない）", Number.isFinite(TOPv) && r.bad === 0 && r.top > 0 && r.extra === 0, JSON.stringify({ TOP: TOPv, ...r }));
    // 上級（特急）は行ける駅の印を出さない
    await pz.evaluate(() => { const k = window.__rh.todayKey(); localStorage.setItem("rosen-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, cnt: 0, clean: 0, runs: { h: { mode: "h", date: k, tags: [`h:${k}`], i: 0, hints: [], path: null } }, kofi: {} })); });
    await pz.reload(); await pz.evaluate(() => window.__rh.play("h"));
    check("上級（特急）は行ける駅の印を出さない（ヒントなし）", (await pz.locator("#map .st.can").count()) === 0);
    await pz.close(); }
  { // 実績：いまの記録から毎回数える。腕前・集める・続けるを混ぜ、まだのものは条件と進み具合
    const pa = await newPage(320, 700); await pa.click("#howto-ok");
    const r = await pa.evaluate(() => { const g = window.__rh, base = { v: 1, tut: true, days: {}, hdays: {}, late: {}, cnt: 0, clean: 0, runs: {}, kofi: {} };
      const got = (o) => g.achGot(Object.assign({}, base, o)).sort().join(",");
      const d = (n) => new Date(Date.UTC(2026, 10, 4 + n)).toISOString().slice(0, 10), many = (from, n, h = [1, 1, 1]) => Object.fromEntries(Array.from({ length: n }, (_, i) => [d(from + i), { h }]));
      return { n: g.ACH.length, kinds: [...new Set(g.ACH.map((a) => a[3]))].sort().join(","),
        empty: got({}), first: got({ cnt: 1 }),
        perfect: got({ cnt: 3, clean: 3, days: { [d(0)]: { h: [0, 0, 0] } } }),
        types: got({ cnt: 4, clean: 4, days: { [d(0)]: { h: [0, 2, 1] } }, late: { [d(1)]: { h: [1, 0, 0] } }, hdays: { [d(0)]: { h: [0] } } }),
        week6: got({ days: many(0, 3), late: many(4, 3) }), week7: got({ days: many(0, 4), late: many(4, 3) }),
        month: got({ days: many(0, 10) }), hard5: got({ hdays: many(0, 5, [0]) }), days30: got({ days: many(0, 20), late: many(40, 10) }),
        prog: g.achProg(Object.assign({}, base, { hdays: many(0, 2, [0]) }), g.ACH.find((a) => a[0] === "hard5")).join("/") }; });
    check("実績は10〜14個で、腕前・集める・続けるの3種類", r.n >= 10 && r.n <= 14 && r.kinds === ["腕前", "集める", "続ける"].sort().join(","), `${r.n}個 ${r.kinds}`);
    check("実績の数え方：何も無ければ0・開通1で「はじめての開通」・全部ヒントなしの日で「完ぺきな一日」", r.empty === "" && r.first === "first" && r.perfect.split(",").includes("perfect") && !r.first.includes("perfect"), JSON.stringify(r));
    check("実績の数え方：全種別で★3は各駅・快速・急行（あとからも）と特急をそろえたとき", r.types.split(",").includes("types") && r.types.split(",").includes("late1"), r.types);
    check("実績の数え方：1週間そろえるは、今日の分とあとからの分で7日続けて埋まったとき（6日では取れない）", r.week7.split(",").includes("week") && !r.week6.split(",").includes("week"), `${r.week6} / ${r.week7}`);
    check("実績の数え方：ひと月10日・特急5日・合わせて30日（連続でなく合計）", r.month.split(",").includes("month") && r.hard5.split(",").includes("hard5") && r.days30.split(",").includes("days30") && !r.month.split(",").includes("days30"), `${r.month} | ${r.hard5} | ${r.days30}`);
    check("まだの実績は進み具合を数で持つ（特急2日なら 2/5）", r.prog === "2/5", r.prog);
    await pa.evaluate(() => { const k = window.__rh.todayKey(); localStorage.setItem("rosen-v1", JSON.stringify({ v: 1, tut: true, days: { [k]: { h: [0, 0, 0] } }, hdays: {}, cnt: 50, clean: 31, runs: {}, kofi: {} })); });
    await pa.reload();
    check("実績より前から遊んでいた人は、もう取れている実績を「見せた」にしてまとめて出さない", await pa.evaluate(() => { const s = window.__rh.load(); return !!s.ach && s.ach.first === 1 && s.ach.clean30 === 1 && s.ach.perfect === 1; }));
    { // 3路線目を開通して結果を見ずに閉じた、実績より前からの人：開き直して結果へ進んでも、前に取れていた実績をまとめて出さない（2026-11-04 CodeRabbit）
      const keepRec = await pa.evaluate(() => localStorage.getItem("rosen-v1"));
      await pa.evaluate(() => { const g = window.__rh, k = g.todayKey(), y = new Date(Date.parse(k + "T00:00:00Z") - 864e5).toISOString().slice(0, 10); localStorage.setItem("rosen-v1", JSON.stringify({ v: 1, tut: true, days: { [y]: { h: [0, 0, 0] } }, hdays: {}, cnt: 40, clean: 31, runs: { d: { mode: "d", date: k, tags: g.dailyTags(k), i: 3, hints: [0, 0, 0], path: null } }, kofi: {} })); });
      await pa.reload();
      const r = await pa.evaluate(() => ({ head: document.querySelector("header")?.textContent || "", ach: document.querySelector(".achnew")?.textContent || "" }));
      check("結果を見ずに閉じた日を開き直しても、前から取れていた実績（はじめての開通など）を新しく出さない", !r.ach.includes("はじめての開通"), JSON.stringify(r));
      await pa.evaluate((v) => localStorage.setItem("rosen-v1", v), keepRec); await pa.reload();
    }
    check("ホームの実績ボタンに取った数（3/12 のように）", /🏅 実績 \d+\/\d+/.test(await pa.textContent("#go-ach")));
    await pa.click("#go-ach");
    const v = await pa.evaluate(() => ({ items: document.querySelectorAll(".ach").length, got: document.querySelectorAll(".ach.got").length, pg: [...document.querySelectorAll(".ach:not(.got)")].every((e) => /\d+\/\d+/.test(e.querySelector(".pg")?.textContent || "") && e.querySelector("small").textContent.length > 0), over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim() || e.id) }));
    check("実績の画面：全部の実績が並び、まだのものは条件と「3/10」のような進み具合", v.items === 12 && v.got >= 3 && v.pg, JSON.stringify(v));
    check("幅320px：実績の画面が横にはみ出さず、押せる所は高さ44px以上", !v.over && v.small.length === 0, v.small.join(","));
    await pa.close(); }
  { // 乗車記録（カレンダー）と、取りこぼした過去7日をあとから遊ぶ。時計を40日進めて確かめる
    const pl = await newPage(320, 700, 40); await pl.click("#howto-ok");
    const k = await pl.evaluate(() => window.__rh.todayKey()), add = (n) => new Date(Date.parse(k) + n * 864e5).toISOString().slice(0, 10);
    // 何百日分：取りこぼした日は過去7日のうち遊んでいない日だけ・はじめの日より前は無い・あとからの問題はその日の3路線と同じ
    const many = await pl.evaluate(() => { const g = window.__rh, EP = "2026-11-04", add = (k, n) => new Date(Date.parse(k) + n * 864e5).toISOString().slice(0, 10), errs = [];
      for (let t = 0; t < 400; t++) { const k = add(EP, t), s = { days: {}, late: {}, hdays: {} };
        for (let j = 1; j <= 9; j++) { const d = add(k, -j); if ((t * 7 + j * 3) % 5 === 0) s.days[d] = { h: [0, 0, 0] }; else if ((t + j) % 7 === 0) s.late[d] = { h: [1, 1, 1] }; }
        const m = g.missedDays(s, k);
        if (m.length > 7 || m.some((d) => d >= k || d < add(k, -7) || d < EP || s.days[d] || s.late[d])) errs.push(k);
        for (let j = 1; j <= 7; j++) { const d = add(k, -j); if (d >= EP && !s.days[d] && !s.late[d] && !m.includes(d)) errs.push(k + "!" + d); }
        for (const d of m) if (JSON.stringify(g.dailyTags(d)) !== JSON.stringify([0, 1, 2].map((i) => `d:${d}:${i}`))) errs.push("tag" + d); }
      return errs; });
    check("400日分：取りこぼした日は過去7日のうち遊んでいない日だけ（はじめの日より前は無い）・問題はその日の3路線と同じ種", many.length === 0, many.slice(0, 3).join(","));
    const sameP = await pl.evaluate((d) => { const g = window.__rh, a = JSON.stringify(g.dailyTags(d).map((t) => g.puzzle(t).sol)); return a; }, add(-3));
    const R0 = await (async () => { const pz = await browser.newPage(); await pz.goto(url); const v = await pz.evaluate((d) => JSON.stringify(window.__rh.dailyTags(d).map((t) => window.__rh.puzzle(t).sol)), add(-3)); await pz.close(); return v; })();
    check("あとから遊ぶ問題は、その日に遊んだ人と同じ（別の画面で作っても同じ答え）", sameP === R0);
    await pl.evaluate(({ k, add }) => { localStorage.setItem("rosen-v1", JSON.stringify({ v: 1, tut: true, days: { [add[0]]: { h: [0, 0, 0] }, [add[1]]: { h: [2, 1, 0] } }, hdays: { [add[0]]: { h: [0] } }, late: {}, cnt: 7, clean: 5, runs: {}, kofi: {} })); }, { k, add: [add(-1), add(-2)] });
    await pl.reload();
    check("ホームに「取りこぼした日をあとから（5日）」", (await pl.textContent("#go-late")).includes("5日"));
    // 今日の途中経過を作ってから、あとから遊ぶ
    await pl.click("#go-d"); const s0 = await sol(pl); await tapStation(pl, s0[1]); await pl.click("#back");
    await pl.click("#go-cal");
    const c = await pl.evaluate(() => ({ cls: [...document.querySelectorAll(".cal .c")].map((e) => e.className + ":" + e.textContent), btn: document.querySelectorAll(".cal button.c").length, list: document.querySelectorAll(".misses button").length, over: document.documentElement.scrollWidth > innerWidth, small: [...document.querySelectorAll("button, a")].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.textContent.trim() || e.id) }));
    const cellOf = (d) => c.cls.find((x) => x.split(":")[1].startsWith(String(+d.slice(8, 10))) && !x.includes("wd")) || "";
    check("乗車記録：全部★3の日はいちばん濃く、特急の日に金の点、今日に枠", k.slice(0, 7) !== add(-1).slice(0, 7) || /\bd3\b/.test(c.cls.join(" ")) && / hd/.test(c.cls.join(" ")) && / today/.test(c.cls.join(" ")), c.cls.join(" | "));
    check("乗車記録：取りこぼした日（過去7日・まだの日）だけが押せる", c.list === 5 && c.btn === c.cls.filter((x) => x.includes("↺乗る") || x.includes("続き")).length, `${c.list} ${c.btn}`);
    check("幅320px：乗車記録が横にはみ出さず、押せる所は高さ44px以上", !c.over && c.small.length === 0, c.small.join(","));
    check("乗車記録：連続の日は1以上のときだけ小さく出す（きのう・おととい乗ったので連続2日）", (await pl.textContent("#app")).includes("連続2日"));
    await pl.click("#cal-prev");
    check("乗車記録：前の月へ戻れる", (await pl.textContent("#cal-ym")) !== `${+k.slice(0, 4)}年${+k.slice(5, 7)}月`);
    await pl.click("#back"); await pl.click("#go-cal");
    const target = add(-3);
    await pl.locator(`.misses button[data-d="${target}"]`).click();
    check("あとから遊ぶと、その日の3路線（同じ問題）が始まる", await pl.evaluate((d) => { const g = window.__rh; return g.mode() === "a" && g.state().P === g.puzzle(`d:${d}:0`); }, target));
    for (let r = 0; r < 3; r++) { for (const i of (await sol(pl)).slice(1)) await pl.evaluate((i) => window.__rh.tryStep(i), i); await pl.click("#next"); }
    const st = await pl.evaluate((d) => { const g = window.__rh, s = g.load(); return { late: s.late[d], days: Object.keys(s.days).length, today: !!s.days[g.todayKey()], streak: g.streak(s.days), cnt: s.cnt, runA: s.runs.a, runD: s.runs.d && s.runs.d.path && s.runs.d.path.length, ach: s.ach && s.ach.late1 }; }, target);
    check("あとから遊んだ日は late に残り、今日の記録・日ごとの記録・連続の日は増えない（3日前をつないでも連続2日のまま。開通の数には入る）", !!st.late && JSON.stringify(st.late.h) === "[0,0,0]" && st.days === 2 && !st.today && st.streak === 2 && st.cnt === 10 && !st.runA, JSON.stringify(st));
    check("あとから遊んでも、今日の途中経過（runs.d）は消えない", st.runD === 2, String(st.runD));
    check("あとから遊んだ結果：見出しに「あとから」・全部ヒントなしでも Ko-fi の1行を出さない・新しい実績が小さく出る", (await pl.textContent("header")).includes("あとから") && (await pl.locator(".kofi").count()) === 0 && (await pl.textContent(".achnew")).includes("取りこぼし回収"));
    check("結果に「あと少しの実績」を1つだけ出す：まだの実績のうち目標にいちばん近いもの（取った・0のものは選ばない。研究の要点 12）", await pl.evaluate(() => { const g = window.__rh, s = g.load(), nx = g.nextAch(s), el = document.querySelectorAll("#achnext"); if (!nx) return false; const ok = g.ACH.every((a) => { const [n, t] = g.achProg_(s, a); return !(n > 0 && n < t) || n / t <= nx.r + 1e-12; }); return ok && el.length === 1 && el[0].textContent.includes(nx.name) && el[0].textContent.includes("あと" + nx.left) && !g.achGot(s).includes(nx.id); }));
    check("あとから遊んだ日のシェアの文に「あとから」と書き、駅名を出さない", /#\d+ \d+\/\d+（あとから）/.test(await pl.textContent(".share")) && !(await pl.evaluate(() => window.__rh.state().P.names.some((n) => document.querySelector(".share").textContent.includes(n)))));
    await pl.click("#go-cal");
    check("乗車記録：あとから遊んだ日は別の印（点線）で残り、もう押せない", (await pl.locator(".cal .c.late").count()) === 1 && (await pl.locator(`.misses button[data-d="${target}"]`).count()) === 0);
    check("乗車記録の画面でも、あとから遊んだ日で連続の日は増えない（連続2日のまま）", (await pl.textContent("#app")).includes("連続2日") && !(await pl.textContent("#app")).includes("連続3日"));
    { // A日を途中まで→B日を始める→A日に戻ると続きから（runs.a を黙って消さない。2026-11-04 星座つなぎで CodeRabbit が指摘）
      const A = add(-4), B = add(-5);
      await pl.evaluate((d) => window.__rh.startRun("a", null, d), A);
      const sa = await sol(pl); await pl.evaluate((i) => window.__rh.tryStep(i), sa[1]); await pl.evaluate((i) => window.__rh.tryStep(i), sa[2]);
      await pl.evaluate((d) => window.__rh.startRun("a", null, d), B);
      const onB = await pl.evaluate(() => window.__rh.load().runs.a.date);
      await pl.evaluate((d) => window.__rh.startRun("a", null, d), A);
      const backA = await pl.evaluate(() => { const g = window.__rh, s = g.load(); return { date: s.runs.a.date, path: g.state().path.length, parked: Object.keys(s.apark || {}) }; });
      check("あとから：A日を途中まで→B日を始める→A日に戻ると、通った駅のまま続きから（B日は預けて残る）", onB === B && backA.date === A && backA.path === 3 && backA.parked.includes(B), JSON.stringify({ onB, backA }));
      await pl.evaluate(() => window.__rh.startRun("a", null, window.__rh.load().runs.a.date)); await pl.click("#back");
    }
    const before = await pl.evaluate(() => JSON.stringify(window.__rh.load().runs.a || null));
    await pl.evaluate((d) => window.__rh.startRun("a", null, d), add(-8));
    check("8日より前の日・遊んだ日は、あとから始められない", (await pl.evaluate(() => JSON.stringify(window.__rh.load().runs.a || null))) === before && (await pl.evaluate((d) => { window.__rh.startRun("a", null, d); return JSON.stringify(window.__rh.load().runs.a || null); }, add(-1)) === before));
    await pl.close(); }
  { // 保存できないブラウザでも遊べる（開いているあいだは途中経過を覚えている）
    const pb = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pb.on("pageerror", (e) => errors.push(e.message));
    await pb.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("blocked"); }; });
    await pb.goto(url); await pb.click("#howto-ok"); await pb.click("#go-d");
    check("保存できないブラウザでも、今日の1問目が始まる", (await pb.locator("#map svg").count()) === 1);
    await pb.click("#back");
    check("保存できないブラウザでも、遊び方が何度も開かない", !(await pb.locator("#howto[open]").count()));
    await pb.close(); }
  { // 前の記録が残っていて、書き込みだけ失敗する（容量いっぱいなど）ときも、メモリの新しい進み具合を使う
    const pq = await browser.newPage({ viewport: { width: 390, height: 844 } });
    pq.on("pageerror", (e) => errors.push(e.message));
    await pq.addInitScript(() => { const orig = Storage.prototype.setItem; orig.call(localStorage, "rosen-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, kofi: {}, runs: {} })); Storage.prototype.setItem = () => { throw new Error("full"); }; });
    await pq.goto(url); await pq.click("#go-d");
    check("前の記録があり書き込みだけ失敗しても、今日の1問目が始まる", (await pq.locator("#map svg").count()) === 1);
    await pq.close(); }
  { // 最後の1問を終えて「結果を見る」を押す前に閉じた日は、開き直すと結果へ進み記録がつく
    const pc = await newPage();
    await pc.evaluate(() => { const g = window.__rh, k = g.todayKey(); localStorage.setItem("rosen-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, cnt: 0, clean: 0, kofi: {}, runs: { d: { mode: "d", date: k, tags: g.dailyTags(k), i: 3, hints: [0, 0, 0], path: null } } })); });
    await pc.reload();
    check("最後の1問のあと閉じても、開き直すと結果へ進み今日の記録がつく", await pc.evaluate(() => { const g = window.__rh; return !!g.load().days[g.todayKey()] && !g.load().runs.d; }));
    await pc.close(); }
  { // 0時の前に最後の1問を終えて閉じ、翌日に開いても、終えた日の記録として残る
    { // 今日の結果を開いたまま0時を過ぎてから「上級」を押しても、翌日の上級は始めない
    const pm = await newPage();
    await pm.evaluate(() => { const g = window.__rh, k = new Date(Date.parse(g.todayKey())).toISOString().slice(0, 10); localStorage.setItem("rosen-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, cnt: 0, clean: 0, kofi: {}, runs: { d: { mode: "d", date: k, tags: g.dailyTags(k), i: 3, hints: [0, 0, 0], path: null } } })); });
    await pm.reload();
    const had = await pm.locator("#go-h").count();
    await pm.evaluate(() => { const RD = Date, off = 864e5; window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; }); // 時計を1日進める
    if (had) await pm.click("#go-h");
    check("結果を開いたまま日付が変わったら、上級のボタンを押しても翌日の上級は始まらない", had > 0 && (await pm.evaluate(() => window.__rh.mode())) !== "h");
    await pm.close(); }
    const pn = await newPage();
    await pn.evaluate(() => { const g = window.__rh, k = new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10); localStorage.setItem("rosen-v1", JSON.stringify({ v: 1, tut: true, days: {}, hdays: {}, dex: {}, cnt: 0, clean: 0, kofi: {}, runs: { d: { mode: "d", date: k, tags: g.dailyTags(k), i: 3, hints: [0, 0, 0], path: null } } })); });
    await pn.reload();
    check("前の日に終えて閉じても、翌日に開くとその日の記録がつく", await pn.evaluate(() => { const g = window.__rh; return !!g.load().days[new Date(Date.parse(g.todayKey()) - 864e5).toISOString().slice(0, 10)] && !g.load().runs.d; }));
    check("前の日の結果の画面からは、今日の上級を始められない（今日の分を先に）", !(await pn.locator("#go-h").count()));
    check("保存に失敗したタブで前の日を「あとから」選んでいたら、統合してもその日を続けられ、別の日の途中は apark に預ける", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(), A = { mode: "a", date: "2000-01-05", tags: [1, 2, 3], list: [1, 2, 3], i: 1, hints: [0], id: "A" }, B = { mode: "a", date: "2000-01-06", tags: [1, 2, 3], list: [1, 2, 3], i: 1, hints: [0], id: "B" }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: Object.assign({}, s0.runs, { a: A }), apark: {} })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: Object.assign({}, s0.runs, { a: B }), apark: {} }))); const r = g.load(); mem = null; localStorage.setItem(K, JSON.stringify(s0)); return r.runs.a.date === "2000-01-05" && !!r.apark["2000-01-06"] && r.apark["2000-01-06"].i === 1; }, "rosen-v1"));
    check("保存に失敗したあと、預かり（apark）に同じ日があっても、進んだほうの途中経過を残す", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(), A2 = { mode: "a", date: "2000-01-05", tags: [1, 2, 3], list: [1, 2, 3], i: 2, hints: [0, 0], id: "A" }, A1 = Object.assign({}, A2, { i: 1, hints: [0] }), B = { mode: "a", date: "2000-01-06", tags: [1, 2, 3], list: [1, 2, 3], i: 0, hints: [], id: "B" }; mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: Object.assign({}, s0.runs, { a: A2 }), apark: {} })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: Object.assign({}, s0.runs, { a: B }), apark: { "2000-01-05": A1 } }))); const r = g.load(); mem = null; localStorage.setItem(K, JSON.stringify(s0)); return r.runs.a.date === "2000-01-06" && r.apark["2000-01-05"].i === 2; }, "rosen-v1"));
    check("保存に失敗したあと別のタブが新しく保存していたら、古いメモリで上書きせずそちらを読む", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 1, tagA: 1 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 2, tagB: 1 }))); const r = g.load(); mem = null; return !!r.tagB && !r.tagA; }, "rosen-v1"));
    check("保存に失敗したあと別のタブが保存しても、両方の記録（日ごとの結果）を残す", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, days: { "2000-01-01": s0.days[Object.keys(s0.days)[0]] || 1 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, days: { "2000-01-02": 1 } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && !!r.days["2000-01-02"]; }, "rosen-v1"));
    check("保存に失敗したタブの時刻が進んでいても、別のタブで先に進んだ途中経過を古いメモリで戻さない", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0 }; mem = JSON.stringify(Object.assign({}, s0, { t: 99, runs: Object.assign({}, s0.runs, { d: Object.assign({}, base) }) })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 1, runs: Object.assign({}, s0.runs, { d: Object.assign({}, base, { res: [{}, {}], i: 2 }) }) }))); const r = g.load(); mem = null; return r.runs.d.res.length === 2 && r.runs.d.i === 2; }, "rosen-v1"));
    check("保存に失敗したタブにだけある途中経過は、別のタブが保存しても消さない（その日を終えた記録があれば null を使う・終えた回は日ごとの結果に残す）", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (a, b, dd) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: a })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: b }, dd ? { days: Object.assign({}, s0.days, dd) } : {}))); const r = g.load(); mem = null; return r; }; const r1 = put({ d: base }, {}), r2 = put({ d: base }, { d: null }, { "2000-01-01": 1 }), r3 = put({ d: base }, { d: null }), r4 = put({ d: done }, { d: null }); return !!r1.runs.d && r1.runs.d.date === "2000-01-01" && r2.runs.d === null && !!r3.runs.d && r3.runs.d.date === "2000-01-01" && r4.runs.d === null && !!r4.days["2000-01-01"]; }, "rosen-v1"));
    check("同じ進み具合なら、新しく保存したほうの途中経過を使う", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (ta, tb) => { mem = JSON.stringify(Object.assign({}, s0, { t: ta, runs: { d: Object.assign({}, base, { zz: "a" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: tb, runs: { d: Object.assign({}, base, { zz: "b" }) } }))); const r = g.load(); mem = null; return r.runs.d.zz; }; return put(9, 5) === "a" && put(5, 9) === "b"; }, "rosen-v1"));
    check("結果を見る前に別のタブが次の日を保存しても、終えた日の記録を残す", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: done } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { date: "2000-01-02" }) } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && r.runs.d.date === "2000-01-02"; }, "rosen-v1"));
    check("同じ問題の練習をやり直したら、前の回（終えたもの）と取り違えず新しい回を使う", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(), base = { mode: "p", date: "2000-01-01", list: [1], tags: [1], res: [], i: 0, hints: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { p: Object.assign({}, base, { id: "new" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { p: Object.assign({}, base, { id: "old", res: [{}], i: 1 }) } }))); const r = g.load(); mem = null; return r.runs.p.id === "new"; }, "rosen-v1"));
    check("保存に失敗したあと別のタブが保存しても、帳の★は高いほうを残す", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, dex: { zz: 3 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, dex: { zz: 1 } }))); const r = g.load(); mem = null; return r.dex.zz === 3; }, "rosen-v1"));
    check("保存に失敗したあと、両方の預かり（apark）に同じ日があれば、保存時刻でなく進んだほうを残す（2026-11-05 CodeRabbit）", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(), A2 = { mode: "a", date: "2000-01-05", tags: [1, 2, 3], list: [1, 2, 3], i: 2, hints: [0, 0], id: "A" }, A1 = Object.assign({}, A2, { i: 1, hints: [0] }); const run = (oldP, newP) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, apark: { "2000-01-05": oldP } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, apark: { "2000-01-05": newP } }))); const r = g.load(); mem = null; localStorage.setItem(K, JSON.stringify(s0)); return r.apark["2000-01-05"].i; }; return run(A2, A1) === 2 && run(A1, A2) === 2; }, "rosen-v1"));
    check("保存に失敗したあと、ヒントを何度使っても、通った駅が多い途中経過を残す（2026-11-05 CodeRabbit）", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(), A = { mode: "a", date: "2000-01-05", tags: [1, 2, 3], list: [1, 2, 3], i: 0, hints: [], id: "A", path: [0, 1, 2], curHints: 0 }, B = Object.assign({}, A, { path: [0, 1], curHints: 15 }); const run = (oldP, newP) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, apark: { "2000-01-05": oldP } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, apark: { "2000-01-05": newP } }))); const r = g.load(); mem = null; localStorage.setItem(K, JSON.stringify(s0)); return r.apark["2000-01-05"].path.length; }; return run(A, B) === 3 && run(B, A) === 3; }, "rosen-v1"));
    check("保存に失敗したあと、続ける日（runs.a）と同じ日の預かり（apark）のほうが進んでいれば、そちらで続ける（2026-11-05 CodeRabbit）", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(), A2 = { mode: "a", date: "2000-01-05", tags: [1, 2, 3], list: [1, 2, 3], i: 2, hints: [0, 0], id: "A" }, A1 = Object.assign({}, A2, { i: 1, hints: [0] }), B = { mode: "a", date: "2000-01-06", tags: [1, 2, 3], list: [1, 2, 3], i: 1, hints: [0], id: "B" }; mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: Object.assign({}, s0.runs, { a: B }), apark: { "2000-01-05": A2 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: Object.assign({}, s0.runs, { a: A1 }), apark: {} }))); const r = g.load(); mem = null; localStorage.setItem(K, JSON.stringify(s0)); return r.runs.a.date === "2000-01-05" && r.runs.a.i === 2 && !(r.apark || {})["2000-01-05"] && !!(r.apark || {})["2000-01-06"]; }, "rosen-v1"));
    check("保存に失敗したあと、どちらの側が古い形（late・ach・apark が無い）でも、新しい入れ物を失わない（2026-11-04 星座つなぎで CodeRabbit が指摘）", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(), old = { v: 1, tut: true, days: {}, hdays: {}, cnt: 0, clean: 0, runs: {}, kofi: {} }, neu = Object.assign({}, old, { late: { "2000-01-03": { h: [0, 0, 0] } }, ach: { first: 1 }, apark: { "2000-01-04": { mode: "a", date: "2000-01-04", tags: [1, 2, 3], i: 0, hints: [], path: null } } });
      const put = (m, l) => { mem = JSON.stringify(m); localStorage.setItem(K, JSON.stringify(l)); const r = g.load(); mem = null; return !!r.late["2000-01-03"] && r.ach && r.ach.first === 1 && !!(r.apark || {})["2000-01-04"]; };
      const ok = put(Object.assign({}, old, { t: 9 }), Object.assign({}, neu, { t: 5 })) && put(Object.assign({}, neu, { t: 5 }), Object.assign({}, old, { t: 9 })) && put(Object.assign({}, neu, { t: 9 }), Object.assign({}, old, { t: 5 })) && put(Object.assign({}, old, { t: 5 }), Object.assign({}, neu, { t: 9 }));
      localStorage.setItem(K, JSON.stringify(s0)); return ok; }, "rosen-v1"));
    check("時計が戻っても、保存の時刻 t は前より大きくなる", await pn.evaluate((K) => { const s0 = JSON.parse(localStorage.getItem(K)); const far = Date.now() + 1e9; localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: far }))); save(() => {}); return JSON.parse(localStorage.getItem(K)).t > far; }, "rosen-v1"));
    await pn.close(); }
  { // 色だけで分けない・キーボードだけで遊べる・読み上げに知らせる（shared-workflows routines/game-dev.md「だれでも遊べるように」A1・A6・A7・A8）
    const pk = await newPage(); await pk.click("#howto-ok"); await pk.click("#go-d");
    const S = await sol(pk);
    const a = await pk.evaluate(() => { const g = [...document.querySelectorAll("#map .st")]; return { n: g.length, btn: g.every((e) => e.getAttribute("role") === "button" && e.getAttribute("tabindex") === "0" && /・(いまいる駅|まだの駅|通った駅|もう行けない駅)・となり /.test(e.getAttribute("aria-label") || "")), role: document.querySelector("#map svg").getAttribute("role"), live: document.querySelector("#live")?.getAttribute("aria-live"), dots: document.querySelector(".dots")?.getAttribute("aria-label") || "", hOn: document.querySelector(".dots i.on").getBoundingClientRect().height, hNext: document.querySelector(".dots i:not(.on):not(.done)").getBoundingClientRect().height, nextBg: getComputedStyle(document.querySelector(".dots i:not(.on):not(.done)")).backgroundColor }; });
    check("駅は全部キーボードで選べるボタン（role=button・tabindex）で、名前と「いまいる・通った・まだ・もう行けない」・となりの駅を読み上げる", a.n > 0 && a.btn && a.role === "group", JSON.stringify(a).slice(0, 200));
    check("進み具合の点は色だけで分けない（いまの路線は高く・まだの路線は中が空・数を文字でも持つ）", a.hOn > a.hNext && /rgba\(0, 0, 0, 0\)|transparent/.test(a.nextBg) && a.dots === "3路線のうち1つ目", JSON.stringify(a));
    check("読み上げソフトへの知らせの場所（aria-live）がある", a.live === "polite");
    await pk.focus(`#st${S[1]}`); await pk.keyboard.press("Enter");
    check("キーボードの Enter で、選んだ駅へ進める（なぞらなくても遊べる）", (await cur(pk)).length === 2);
    await pk.waitForTimeout(100);
    check("進むと、駅名とのこりの駅の数を読み上げの場所に出す", (await pk.textContent("#live")).includes("のこり"), await pk.textContent("#live"));
    check("通った駅・いまいる駅は、読み上げの名前でも分かる", /いまいる駅/.test(await pk.getAttribute(`#st${S[1]}`, "aria-label")) && /通った駅/.test(await pk.getAttribute(`#st${S[0]}`, "aria-label")));
    const far2 = await pk.evaluate(() => { const { P, path } = window.__rh.state(), c = path[path.length - 1]; return P.pts.findIndex((_, i) => !path.includes(i) && !P.adj[c].includes(i)); });
    await pk.focus(`#st${far2}`); await pk.keyboard.press(" "); await pk.waitForTimeout(100);
    check("つながっていない駅をスペースで押すと進まず、「線路がつながっていません」と文字で知らせる", (await cur(pk)).length === 2 && (await pk.textContent("#live")).includes("つながっていません"));
    const mv = await pk.evaluate(() => { const { P } = window.__rh.state(); const i = P.pts.findIndex(([x], j) => P.pts.some(([qx, qy], k) => k !== j && qx > x && qy === P.pts[j][1])); document.getElementById("st" + i).focus(); return { i, x: P.pts[i][0] }; });
    await pk.keyboard.press("ArrowRight");
    const mv2 = await pk.evaluate(() => { const e = document.activeElement; return e && e.dataset ? { i: +e.dataset.i, x: window.__rh.state().P.pts[+e.dataset.i][0] } : null; });
    check("矢印のキーで、となりの駅へ選ぶ所を動かせる", mv2 && mv2.i !== mv.i && mv2.x > mv.x, JSON.stringify([mv, mv2]));
    await pk.click("#hint"); await pk.waitForTimeout(100);
    const nx = await pk.evaluate(() => { const { P, path } = window.__rh.state(); return P.names[P.sol[path.length]]; });
    check("ヒントの「光った駅」は駅名でも知らせる（光るのが見えにくい人にも）", (await pk.textContent("#live")).includes(nx) && (await pk.textContent(".toast")).includes(nx));
    await pk.close();
    // 色の見分けを助ける・動きを減らす設定
    const pv = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await pv.addInitScript(() => { try { localStorage.setItem("a11y-v1", JSON.stringify({ cvd: true, calm: true })); } catch (e) {} window.__vib = 0; try { Object.defineProperty(navigator, "vibrate", { value: () => { window.__vib++; return true; }, configurable: true }); } catch (e) {} });
    pv.on("pageerror", (e) => errors.push(e.message));
    await pv.goto(url); await pv.evaluate(() => { const k = Object.keys(localStorage).filter((x) => x !== "a11y-v1"); k.forEach((x) => localStorage.removeItem(x)); }); await pv.reload();
    await pv.click("#howto-ok"); await pv.click("#go-d");
    const Sv = await sol(pv);
    const cv = await pv.evaluate(() => { const ok = ["#D55E00", "#0072B2", "#009E73", "#E69F00", "#CC79A7", "#56B4E9", "#B8A000", "#8C5A2B", "#7F3C8D"].map((h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`); const ls = [...document.querySelectorAll("#map .ln")]; return ls.length > 0 && ls.every((l) => ok.includes(getComputedStyle(l).stroke)); });
    check("色の見分けを助ける設定で、路線の色がカラーユニバーサルデザインの組に替わる", cv);
    await pv.focus(`#st${Sv[1]}`); await pv.keyboard.press("Enter");
    const farv = await pv.evaluate(() => { const { P, path } = window.__rh.state(), c = path[path.length - 1]; return P.pts.findIndex((_, i) => !path.includes(i) && !P.adj[c].includes(i)); });
    await pv.focus(`#st${farv}`); await pv.keyboard.press("Enter"); await pv.waitForTimeout(50);
    check("動きを減らす設定では振動させず、つながっていない駅はゆれの代わりに文字（toast）で知らせる", (await pv.evaluate(() => window.__vib)) === 0 && (await cur(pv)).length === 2 && (await pv.locator(".toast").count()) === 1 && (await pv.textContent(".toast")).includes("つながっていません"));
    await pv.close();
  }
  { // 同じ日はどのブラウザでも同じ問題：sort の比較の中で乱数を引かない（引く回数がブラウザで変わる）
    const src = ["index.html", ...["gen.js", "data.js"].filter((f) => existsSync(path.join(root, f)))].map((f) => readFileSync(path.join(root, f), "utf8")).join("\n");
    const bad = src.match(/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/g) || [];
    check("並べ替えの比較の中で乱数を引いていない（同じ日に人によって問題が変わらない）", bad.length === 0, bad.join(" | ")); }
} catch (e) { // 途中で止まっても、ここまでの結果とレポートは書き出す
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  try { // キーボードで選んだボタンに枠が出る（all:unset のカレンダーのます目でも消えない。2026-11-04 CodeRabbit の指摘）。止まっても失敗として記録し、レポートまで進む
    const pf = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await pf.goto(url); await pf.evaluate(() => localStorage.clear()); await pf.reload();
    await pf.click("#howto-ok").catch(() => {});
    const bad = [];
    for (const open of [null, "#go-cal"]) {
      if (open) await pf.click(open);
      await pf.keyboard.press("Shift");
      bad.push(...await pf.evaluate(() => {
        const cal = document.querySelector(".cal");
        if (cal) { const b = document.createElement("button"); b.className = (cal.querySelector("button") || cal.lastElementChild).className + " miss"; b.textContent = "1"; cal.append(b); }
        return [...document.querySelectorAll("button:not([disabled]),a[href]")].filter((b) => b.checkVisibility()).filter((b) => { b.focus(); const cs = getComputedStyle(b); return !b.matches(":focus-visible") || cs.outlineStyle === "none" || parseFloat(cs.outlineWidth) < 2; }).map((b) => b.className || b.id || b.tagName);
      }));
    }
    check("キーボードで選んだボタン（カレンダーのあとから遊ぶ日も）に枠が出る", bad.length === 0, bad.join(","));
    await pf.close();
  } catch (e) { check("キーボードで選んだボタン（カレンダーのあとから遊ぶ日も）に枠が出る", false, e.message.split("\n")[0]); }
  try { // 引き継ぎコード（別の端末へ記録を移す。shared-workflows template/qa/transfer-check.mjs）
    await checkTransfer({ browser, url, game: "rosen-hitofude", sample: { "rosen-v1": JSON.stringify({ v: 1, tut: true }) }, check, open: async (p) => { await p.click("#howto-ok", { timeout: 1500 }).catch(() => {}); } });
  } catch (e) { check("引き継ぎコード", false, e.message.split("\n")[0]); }
  // 保存に失敗したら知らせる（2026-11-07 暑さ指数よみで見つけた。黙って記録が消えないように）
  { const ps = await browser.newPage(); await ps.goto(url); await ps.waitForTimeout(200);
    check("保存に失敗したら、保存できるまで知らせ続け、保存できたら消す", await ps.evaluate(async () => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error("full"); }; save(() => {}); save(() => {}); const one = document.querySelectorAll("#savewarn").length === 1 && document.getElementById("savewarn").textContent.includes("保存できませんでした"); await new Promise((r) => setTimeout(r, 2500)); const stay = !!document.getElementById("savewarn"); Storage.prototype.setItem = orig; save(() => {}); return one && stay && !document.getElementById("savewarn"); }));
    check("保存できない帯は画面のいちばん上に場所を取り（ボタンに重ならない）、読み上げの知らせにも出し、ほかの知らせのあとも警告が残る・保存できたら帯と警告が消え、ほかの知らせは残る", await ps.evaluate(async () => { const W = "保存できませんでした", tick = () => new Promise((r) => setTimeout(r, 50)); const orig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error("full"); }; save(() => {}); const b = document.getElementById("savewarn"); const top = !!b && document.body.firstElementChild === b && getComputedStyle(b).position === "sticky"; const l = document.getElementById("live"); let live = true, kept = true, other = true; if (l) { live = l.textContent.includes(W); l.textContent = ""; await tick(); l.textContent = "べつの知らせ"; await tick(); kept = l.textContent.includes("べつの知らせ") && l.textContent.includes(W); } Storage.prototype.setItem = orig; save(() => {}); await tick(); if (l) other = l.textContent === "べつの知らせ"; return top && live && kept && other && !document.getElementById("savewarn"); }));
    check("保存できない帯は、長い画面を下までスクロールしても画面の上に見えている（body の高さで止まらない）", await ps.evaluate(async () => { const orig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error("full"); }; save(() => {}); const pad = document.createElement("div"); pad.style.height = "3000px"; document.body.appendChild(pad); scrollTo(0, document.documentElement.scrollHeight); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); const b = document.getElementById("savewarn"), r = b && b.getBoundingClientRect(); const ok = !!r && scrollY > 1000 && r.top >= -1 && r.top < 5; pad.remove(); scrollTo(0, 0); Storage.prototype.setItem = orig; save(() => {}); return ok && !document.getElementById("savewarn"); }));
    await ps.close(); }
  await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));
{ // 見やすさ・読みやすさ・偏り（shared-workflows template/qa/a11y.mjs の写し。routines/game-dev.md「だれでも遊べるように」）
  const { spawnSync } = await import("node:child_process");
  const a = spawnSync(process.execPath, [path.join(root, "qa", "a11y.mjs")], { encoding: "utf8", env: process.env });
  check("見やすさ・読みやすさの検査（qa/a11y.mjs。中身は qa-report/a11y.md）", a.status === 0, (a.stdout.match(/^- ❌.*$/gm) || []).join(" / ") || (a.status ? a.stderr.slice(-300) : ""));
}

const ng = results.filter((r) => !r.ok);
const md = `# 路線図ひと筆 QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
