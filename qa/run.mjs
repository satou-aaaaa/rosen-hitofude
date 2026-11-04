// 路線図ひと筆の検査。問題の作り方（答えが1つ・線路が交わらない・何千回）・通しで遊ぶ・戻る・ヒント・続きから・上級・記録・スマホ幅・PWA を確かめる。
// 使い方: node qa/run.mjs   失敗があれば終了コード 1。結果は qa-report/report.md。
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

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
const ext = [...html.matchAll(/(?:src|href)="(https?:[^"]+)"/g)].map((m) => m[1]).filter((u) => !/^https:\/\/fonts\.googleapis\.com(\/|$)|^https:\/\/ko-fi\.com\/satouaaaaa$/.test(u));
check("外から読むのは文字（Google Fonts）だけ。スクリプト・広告・解析を入れない", ext.length === 0, ext.join(","));
check("CSP で通信先を自分だけにしている", /connect-src 'self'/.test(html) && !/connect-src[^;"]*https/.test(html));
check("Math.random は練習の種だけ（今日の3路線・特急は日付の乱数）", (html.match(/Math\.random/g) || []).length === 1 && !/Math\.random/.test(readFileSync(path.join(root, "gen.js"), "utf8")));
check("画面にお笑いの言葉を入れない（本物っぽく）", !/お笑い|ギャグ|ボケ|ツッコミ|なんでやねん|（うそ）/.test(html));
{ const og = (k) => (html.match(new RegExp(`<meta (?:property|name)="${k}" content="([^"]+)"`)) || [])[1] || "";
  const png = readFileSync(path.join(root, "og.png"));
  check("SNS で貼ると絵と題が出る（OGP・1200×630・絶対URL）", og("og:title") && og("og:description") && og("og:image") === "https://satou-aaaaa.github.io/rosen-hitofude/og.png" && og("twitter:card") === "summary_large_image" && png.readUInt32BE(16) === 1200 && png.readUInt32BE(20) === 630); }
{ const fy = readFileSync(path.join(root, ".github/ISSUE_TEMPLATE/feedback.yml"), "utf8");
  check("感想フォームは名前・メールを聞かない（楽しさ・よかった所・直してほしい所だけ）", /id: fun/.test(fy) && /id: good/.test(fy) && /id: fix/.test(fy) && !/id: (name|email|mail)/.test(fy) && /labels: \["感想"\]/.test(fy)); }
{ const sw = readFileSync(path.join(root, "sw.js"), "utf8"), mf = JSON.parse(readFileSync(path.join(root, "manifest.webmanifest"), "utf8"));
  const shell = JSON.parse(sw.match(/SHELL = (\[[^\]]+\])/)[1]);
  check("PWA：ネットの返事の保存は、イベントの中で waitUntil に預ける（遅れて届いた新しい版も保存できる）", /e\.waitUntil\(Promise\.race\(\[net\.then[^\n]*Promise\.race\(\[caches\.open[^\n]*wait\(15000\)\]\); \}, \(\) => \{\}\)\.catch\(\(\) => \{\}\), wait\(60000\)\]\)\);/.test(sw) && !/\.then\([^\n]*e\.waitUntil/.test(sw));
  check("PWA：sw.js は画面のファイルを全部保存し、外へ何も送らない", ["./index.html", "./gen.js", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"].every((f) => shell.includes(f)) && !/https?:\/\//.test(sw.replace(/^\/\/.*$/gm, "")));
  check("PWA：manifest にアイコン2つと名前がある", mf.name === "路線図ひと筆" && mf.icons.length >= 2); }

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const isNoise = (t) => /fonts\.(googleapis|gstatic)\.com|ERR_NAME_NOT_RESOLVED|ERR_INTERNET_DISCONNECTED|net::ERR_/.test(t);
const errors = [];
async function newPage(w = 390, h = 844) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
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
  await page.click("#howto-ok");
  check("遊ぶ前の画面に Ko-fi のひとことが無い", (await page.locator(".kofi").count()) === 0);
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
  await tapStation(page, s1[1]); await tapStation(page, s1[2]); await tapStation(page, s1[3]);
  check("つながった駅を押すと進む", (await cur(page)).length === 4);
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
  for (const i of s1.slice(3)) await tapStation(page, i);
  check("全部の駅を通って終点に着くと開通・ヒント1回で★2", (await page.textContent(".verdict")).includes("開通") && (await page.locator(".verdict .stars").textContent()).replace(/[^★]/g, "").length === 3 && (await page.locator(".verdict .stars .off").textContent()).length === 1);
  check("開通したあとは駅を押しても動かない", await page.isDisabled("#undo"));
  await page.click("#next");
  // 2・3路線目はなぞって（ドラッグで）解く
  for (let r = 0; r < 2; r++) {
    const s = await sol(page), pts = [];
    for (const i of s) { const b = await page.locator(`#st${i} circle`).boundingBox(); pts.push([b.x + b.width / 2, b.y + b.height / 2]); }
    await page.mouse.move(...pts[0]); await page.mouse.down();
    for (let j = 1; j < pts.length; j++) { const [x0, y0] = pts[j - 1], [x1, y1] = pts[j]; for (let t = 1; t <= 4; t++) await page.mouse.move(x0 + (x1 - x0) * t / 4, y0 + (y1 - y0) * t / 4); }
    await page.mouse.up();
    if (!(await page.locator(".verdict").count())) { const c = await cur(page); check(`${r + 2}路線目をなぞって解ける`, false, `${c.length}/${s.length} 止まった駅 ${s[c.length]} ${JSON.stringify(pts[c.length])} vp ${JSON.stringify(page.viewportSize())}`); break; }
    await page.click("#next");
  }
  check("なぞって解ける（ドラッグ）・3路線で結果へ", (await page.locator(".mini > div").count()) === 3);
  const share = await page.textContent(".share");
  check("シェアの文に番号と3路線の星があり、駅名（答え）は出さない", /路線図ひと筆 #\d+/.test(share) && /各駅 ★★☆/.test(share) && /急行 ★★★/.test(share) && !(await page.evaluate(() => window.__rh.state().P.names.some((n) => document.querySelector(".share").textContent.includes(n)))));
  check("X・LINE は押したときに開くリンクだけ", /^https:\/\/twitter\.com\/intent\/tweet\?text=/.test(await page.getAttribute("#toX", "href")) && /^https:\/\/line\.me\/R\/share\?text=/.test(await page.getAttribute("#toLine", "href")));
  check("ヒントを使った日は Ko-fi のひとことを出さない", (await page.locator(".kofi").count()) === 0);
  await page.click("#back");
  check("ホームで連続1日・開通3・ヒントなし2・今日の結果を見るに変わる", (await page.textContent(".stats")).replace(/\s/g, "") === "1連続の日3開通した路線2ヒントなし" && (await page.textContent("#go-d")).includes("今日の結果"));
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
    check("保存に失敗したあと別のタブが新しく保存していたら、古いメモリで上書きせずそちらを読む", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 1, tagA: 1 })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 2, tagB: 1 }))); const r = g.load(); mem = null; return !!r.tagB && !r.tagA; }, "rosen-v1"));
    check("保存に失敗したあと別のタブが保存しても、両方の記録（日ごとの結果）を残す", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, days: { "2000-01-01": s0.days[Object.keys(s0.days)[0]] || 1 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, days: { "2000-01-02": 1 } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && !!r.days["2000-01-02"]; }, "rosen-v1"));
    check("保存に失敗したタブの時刻が進んでいても、別のタブで先に進んだ途中経過を古いメモリで戻さない", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(), base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0 }; mem = JSON.stringify(Object.assign({}, s0, { t: 99, runs: Object.assign({}, s0.runs, { d: Object.assign({}, base) }) })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 1, runs: Object.assign({}, s0.runs, { d: Object.assign({}, base, { res: [{}, {}], i: 2 }) }) }))); const r = g.load(); mem = null; return r.runs.d.res.length === 2 && r.runs.d.i === 2; }, "rosen-v1"));
    check("保存に失敗したタブにだけある途中経過は、別のタブが保存しても消さない（終えた回の null は戻さない）", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (a, b) => { mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: a })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: b }))); const r = g.load(); mem = null; return r; }; const r1 = put({ d: base }, {}), r2 = put({ d: base }, { d: null }); return !!r1.runs.d && r1.runs.d.date === "2000-01-01" && r2.runs.d === null; }, "rosen-v1"));
    check("同じ進み具合なら、新しく保存したほうの途中経過を使う", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); const put = (ta, tb) => { mem = JSON.stringify(Object.assign({}, s0, { t: ta, runs: { d: Object.assign({}, base, { zz: "a" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: tb, runs: { d: Object.assign({}, base, { zz: "b" }) } }))); const r = g.load(); mem = null; return r.runs.d.zz; }; return put(9, 5) === "a" && put(5, 9) === "b"; }, "rosen-v1"));
    check("結果を見る前に別のタブが次の日を保存しても、終えた日の記録を残す", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(); const base = { mode: "d", date: "2000-01-01", list: [1, 2, 3], tags: [1, 2, 3], id: "x", res: [], i: 0, hints: [0, 0, 0] }, done = Object.assign({}, base, { res: [0, 1, 2].map(() => ({ m: 0, g: 1, h: 0, f: 0, p: 90, n: 1 })), i: 3 }); mem = JSON.stringify(Object.assign({}, s0, { t: 5, runs: { d: done } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, runs: { d: Object.assign({}, base, { date: "2000-01-02" }) } }))); const r = g.load(); mem = null; return !!r.days["2000-01-01"] && r.runs.d.date === "2000-01-02"; }, "rosen-v1"));
    check("同じ問題の練習をやり直したら、前の回（終えたもの）と取り違えず新しい回を使う", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(), base = { mode: "p", date: "2000-01-01", list: [1], tags: [1], res: [], i: 0, hints: [] }; mem = JSON.stringify(Object.assign({}, s0, { t: 9, runs: { p: Object.assign({}, base, { id: "new" }) } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 5, runs: { p: Object.assign({}, base, { id: "old", res: [{}], i: 1 }) } }))); const r = g.load(); mem = null; return r.runs.p.id === "new"; }, "rosen-v1"));
    check("保存に失敗したあと別のタブが保存しても、帳の★は高いほうを残す", await pn.evaluate((K) => { const g = window.__rh, s0 = g.load(); mem = JSON.stringify(Object.assign({}, s0, { t: 5, dex: { zz: 3 } })); localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: 9, dex: { zz: 1 } }))); const r = g.load(); mem = null; return r.dex.zz === 3; }, "rosen-v1"));
    check("時計が戻っても、保存の時刻 t は前より大きくなる", await pn.evaluate((K) => { const s0 = JSON.parse(localStorage.getItem(K)); const far = Date.now() + 1e9; localStorage.setItem(K, JSON.stringify(Object.assign({}, s0, { t: far }))); save(() => {}); return JSON.parse(localStorage.getItem(K)).t > far; }, "rosen-v1"));
    await pn.close(); }
  { // 同じ日はどのブラウザでも同じ問題：sort の比較の中で乱数を引かない（引く回数がブラウザで変わる）
    const src = ["index.html", ...["gen.js", "data.js"].filter((f) => existsSync(path.join(root, f)))].map((f) => readFileSync(path.join(root, f), "utf8")).join("\n");
    const bad = src.match(/\.sort\(\s*\([^)]*\)\s*=>[^\n;]*\b(R|rng|rand|Math\.random)\s*\(/g) || [];
    check("並べ替えの比較の中で乱数を引いていない（同じ日に人によって問題が変わらない）", bad.length === 0, bad.join(" | ")); }
} catch (e) { // 途中で止まっても、ここまでの結果とレポートは書き出す
  check("QA の操作が最後まで完了する", false, e.message.split("\n")[0]);
} finally {
  await browser.close();
}
check("画面のエラーが無い", errors.length === 0, errors.slice(0, 3).join(" | "));

const ng = results.filter((r) => !r.ok);
const md = `# 路線図ひと筆 QA\n\n${results.map((r) => `- ${r.ok ? "✅" : "❌"} ${r.name}${r.detail ? `（${r.detail}）` : ""}`).join("\n")}\n\n${ng.length ? `❌ ${ng.length}件` : `✅ ${results.length}項目すべて通過`}\n`;
mkdirSync(path.join(root, "qa-report"), { recursive: true });
writeFileSync(path.join(root, "qa-report/report.md"), md);
console.log(md);
process.exit(ng.length ? 1 : 0);
