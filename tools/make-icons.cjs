// アプリのアイコン（icon-192.png・icon-512.png）を作る。白地に路線の線と駅、始発の緑。
// 使い方: node tools/make-icons.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  for (const s of [192, 512]) {
    const p = await b.newPage({ viewport: { width: s, height: s } });
    const st = (x, y, f = "#fff") => `<circle cx="${x}" cy="${y}" r="7" fill="${f}" stroke="#1f2328" stroke-width="3.5"/>`;
    await p.setContent(`<body style="margin:0"><svg width="${s}" height="${s}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="#f3f1ea"/>
      <polyline points="25,25 75,25 75,50 25,50 25,75 75,75" fill="none" stroke="#1f2328" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" opacity=".12"/>
      <polyline points="25,25 75,25" stroke="#e60012" stroke-width="9" stroke-linecap="round"/>
      <polyline points="75,25 75,50 25,50" fill="none" stroke="#0079c2" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="25,50 25,75 75,75" fill="none" stroke="#009944" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      ${st(25, 25, "#0a7a55")}${st(75, 25)}${st(75, 50)}${st(25, 50)}${st(25, 75)}${st(75, 75, "#d4372c")}</svg></body>`);
    await p.screenshot({ path: path.join(__dirname, "..", `icon-${s}.png`), clip: { x: 0, y: 0, width: s, height: s } });
  }
  await b.close();
})();
