export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="zh-MY">
  <head>
    <meta charset="utf-8" />
    <title>信号掉了一拍 · 乱画俱乐部</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      * { box-sizing: border-box; }
      body { font: 15px/1.7 system-ui, -apple-system, sans-serif; background: #101014; color: #f5f5ef; display: grid; place-items: center; min-height: 100vh; margin: 0; padding: 1.5rem; color-scheme: dark; }
      .card { max-width: 28rem; width: 100%; text-align: center; padding: 2rem; }
      h1 { font-size: 1.65rem; color: #d8ff3e; margin: 0 0 0.75rem; }
      p { color: #a5a6b0; margin: 0 0 1.5rem; }
      .actions { display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap; }
      a, button { min-height: 48px; padding: 0.65rem 1.2rem; border-radius: 12px; font: inherit; font-weight: 700; cursor: pointer; text-decoration: none; border: 1px solid transparent; }
      .primary { background: #d8ff3e; color: #101014; }
      .secondary { background: #19191f; color: #f5f5ef; border-color: #34343e; }
      :focus-visible { outline: 2px solid #d8ff3e; outline-offset: 4px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>信号掉了一拍。</h1>
      <p>页面暂时没载入。再试一次，或回入口重新入场。</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">再试一次</button>
        <a class="secondary" href="/">回到俱乐部</a>
      </div>
    </div>
  </body>
</html>`;
}
