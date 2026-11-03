// SNS で貼られたときの絵（og.png 1200×630）を作る。今日の路線（答え）は入れない（練習用の種の路線図を使う）。
// 使い方: node tools/make-og.cjs（qa/ の playwright を使う）
const path = require("path");
const { chromium } = require(path.join(__dirname, "..", "qa", "node_modules", "playwright"));
(async () => {
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto("file://" + path.join(__dirname, "..", "index.html"));
  const map = await p.evaluate(() => document.querySelector(".hero svg").outerHTML);
  await p.setContent(`<body style="margin:0;font-family:'Noto Sans CJK JP',sans-serif">
  <div style="width:1200px;height:630px;box-sizing:border-box;padding:70px 70px;background:#f3f1ea;color:#1f2328;position:relative;overflow:hidden">
    <div style="font-size:32px;color:#0a7a55;font-weight:700;letter-spacing:.08em">だれでも同じ 1日3路線・3分</div>
    <div style="font-size:96px;font-weight:900;margin-top:18px;letter-spacing:.06em">路線図ひと筆</div>
    <div style="font-size:40px;margin-top:24px;line-height:1.5">始発から終点まで、<br>全部の駅を1回ずつ。<br>道は1つだけ。</div>
    <div style="position:absolute;left:0;right:0;bottom:0;height:22px;background:#0a7a55"></div>
    <div style="position:absolute;right:60px;top:40px;width:430px;background:#fff;border-radius:18px;padding:10px;box-shadow:0 4px 0 #0001">${map}</div>
  </div></body>`);
  await p.screenshot({ path: path.join(__dirname, "..", "og.png") });
  await b.close();
})();
