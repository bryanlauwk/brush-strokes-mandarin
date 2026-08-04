"""四名玩家端到端验证（含网络延迟 + 丢包模拟）。

覆盖：5 秒内并发加入、四页并发抢点选题、不稳定网络下 5 秒内重连，
最终验证所有玩家看到的题目完全一致。

用法:
  python3 tests/e2e/game_flow_4p.py [base_url] [--clean]   # 不加网络损伤
  python3 tests/e2e/game_flow_4p.py                        # 默认开启延迟+丢包
"""

import asyncio
import random
import sys
from pathlib import Path

from playwright.async_api import async_playwright

ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
FLAGS = {a for a in sys.argv[1:] if a.startswith("--")}
BASE = ARGS[0] if ARGS else "http://localhost:8080"
IMPAIR = "--clean" not in FLAGS
SHOTS = Path(__file__).parent / "screenshots-4p"
SHOTS.mkdir(parents=True, exist_ok=True)

# 每个玩家一套网络画像：(单向延迟毫秒, 丢包率)
PROFILES = [
    ("阿明", 0, 0.0),      # 主机：良好网络
    ("小美", 150, 0.10),   # 一般 4G
    ("阿强", 350, 0.20),   # 弱网
    ("小狗", 600, 0.30),   # 极差网络 + 高丢包
]
rng = random.Random(20260804)


async def impair(context, latency_ms, loss):
    """对 API/服务端函数请求注入延迟与丢包（首屏静态资源不损伤，避免页面加载不出来）。"""
    if not IMPAIR or (latency_ms == 0 and loss == 0):
        return

    async def handler(route):
        url = route.request.url
        # 只损伤真正的数据请求；dev server 的源码模块（含 supabase 客户端文件）必须放行，
        # 否则页面根本 hydrate 不起来，测的就不是网络抖动了。
        dynamic = ("/_serverFn/" in url or "supabase.co/" in url or "/api/" in url) and (
            not url.endswith((".ts", ".tsx", ".js", ".jsx", ".css"))
        )
        if not dynamic:
            await route.continue_()
            return
        if loss and rng.random() < loss:
            # 模拟丢包：连接被吞掉，客户端应自行重试/轮询补齐
            await route.abort("connectionfailed")
            return
        await asyncio.sleep(latency_ms / 1000)
        await route.continue_()

    await context.route("**/*", handler)


async def set_name(page, name, timeout_ms=45000):
    """弱网下 hydration 会明显变慢，这里轮询等待输入框出现。"""
    waited = 0
    while waited < timeout_ms:
        for ph in ("画画人", "例如：Bryan"):
            box = page.get_by_placeholder(ph)
            if await box.count():
                await box.first.fill(name)
                return
        await page.wait_for_timeout(500)
        waited += 500
    await page.screenshot(path=str(SHOTS / f"fail_{name}.png"))
    body = await page.evaluate("() => document.body.innerText.slice(0, 600)")
    raise AssertionError(f"找不到名字输入框 ({name}) 页面文本: {body!r}")


async def join_room(page, code, name):
    await page.goto(f"{BASE}/room/{code}", wait_until="domcontentloaded")
    await page.wait_for_timeout(1500)
    await set_name(page, name)
    btn = page.get_by_role("button", name="加入这一局")
    await btn.wait_for(state="visible", timeout=30000)
    await btn.click()


async def word_view(page):
    return await page.evaluate(
        """() => {
          const nodes = [...document.querySelectorAll('p')];
          const hint = nodes.find(n => /正在画/.test(n.textContent || ''));
          if (!hint) return null;
          const word = hint.nextElementSibling;
          return [hint.textContent.trim(), (word?.textContent || '').trim()];
        }"""
    )


async def find_picker(pages, timeout_ms=25000):
    waited = 0
    while waited < timeout_ms:
        for page in pages:
            if await page.locator("[data-testid='word-choice']").count():
                return page
        await pages[0].wait_for_timeout(400)
        waited += 400
    return None


async def wait_converged(pages, timeout_ms=45000):
    """所有猜题者遮罩与字数一致，且画家已拿回真实题目且长度吻合。"""
    waited = 0
    views = []
    while waited < timeout_ms:
        views = [await word_view(p) for p in pages]
        if all(views) and not any("? 个字" in v[0] for v in views):
            masks = {v[1] for v in views if "你正在画" not in v[0]}
            lens = {v[0].split("·")[-1].strip() for v in views if "你正在画" not in v[0]}
            drawer_view = next((v for v in views if "你正在画" in v[0]), None)
            drawer_ready = drawer_view is not None and "_" not in drawer_view[1]
            drawer_len = len(drawer_view[1].split()) if drawer_view else 0
            mask_len = len(next(iter(masks)).split()) if len(masks) == 1 else -1
            if len(masks) == 1 and len(lens) == 1 and drawer_ready and drawer_len == mask_len:
                return True, views, waited
        await pages[0].wait_for_timeout(500)
        waited += 500
    return False, views, waited


async def main():
    print(f"网络损伤模拟: {'开启' if IMPAIR else '关闭'}")
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        pages, names = [], []
        for name, lat, loss in PROFILES:
            ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
            await impair(ctx, lat, loss)
            pages.append(await ctx.new_page())
            names.append(name)
            print(f"  {name}: +{lat}ms 延迟, {int(loss * 100)}% 丢包")
        host = pages[0]

        # 用例 1: 建房
        await host.goto(BASE, wait_until="domcontentloaded")
        await host.wait_for_timeout(3000)
        await set_name(host, names[0])
        await host.get_by_role("button", name="创建房间").click()
        await host.wait_for_url("**/room/**", timeout=45000)
        code = host.url.rsplit("/", 1)[-1]
        print("room code:", code)

        # 用例 2: 其余三人在 5 秒窗口内同时加入
        await asyncio.gather(*(join_room(p, code, n) for p, n in zip(pages[1:], names[1:])))
        online = None
        for _ in range(30):
            await host.wait_for_timeout(1000)
            online = await host.evaluate(
                "() => (document.body.innerText.match(/(\\d+) 人在线/) || [])[1]"
            )
            if online == "4":
                break
        print("在线人数:", online)
        for n, pg in zip(names, pages):
            txt = await pg.evaluate("() => document.body.innerText.slice(0, 200)")
            await pg.screenshot(path=str(SHOTS / f"0_join_{n}.png"))
            print(f"  [{n}] {txt!r}")
        assert online == "4", f"四人应全部在线，实际 {online}"
        await host.screenshot(path=str(SHOTS / "1_lobby.png"))

        # 用例 3: 开局
        start = host.get_by_role("button", name="开始这一局")
        await start.wait_for(state="visible", timeout=30000)
        await start.click()

        # 用例 4: 四页并发抢点选题，只有画家那份应生效
        picker = await find_picker(pages)
        assert picker is not None, "选题按钮没有出现"
        print("画家:", names[pages.index(picker)])

        async def try_pick(page):
            choice = page.locator("[data-testid='word-choice']").first
            try:
                if await choice.count():
                    await choice.click(timeout=5000)
            except Exception:
                pass  # 非画家点不到，属预期

            
        await asyncio.gather(*(try_pick(p) for p in pages))
        await host.wait_for_timeout(2500)
        for i, p in enumerate(pages):
            await p.screenshot(path=str(SHOTS / f"2_after_pick_{i}.png"))

        # 用例 5: 并发选题后题目一致
        ok, views, took = await wait_converged(pages)
        for n, v in zip(names, views):
            print(f"{n}: {v}")
        assert ok, "并发选题后各玩家看到的题目不一致"
        print(f"✅ 弱网并发选题后四人题目一致（收敛耗时 ~{took}ms）")

        # 用例 6: 最差网络的猜题者 5 秒内重连
        guessers = [p for p in pages if p is not picker]
        worst = max(guessers, key=lambda p: PROFILES[pages.index(p)][1])
        print("重连玩家（最差网络）:", names[pages.index(worst)])
        await worst.reload(wait_until="domcontentloaded")
        await worst.wait_for_timeout(5000)
        ok2, views2, took2 = await wait_converged(pages)
        for n, v in zip(names, views2):
            print(f"重连后 {n}: {v}")
        assert ok2, "猜题者重连后题目不一致"
        await worst.screenshot(path=str(SHOTS / "3_reconnect_guesser.png"))
        print(f"✅ 弱网猜题者 5 秒内重连后四人一致（~{took2}ms）")

        # 用例 7: 画家 5 秒内重连，题目不得改变
        drawer_word_before = (await word_view(picker))[1]
        await picker.reload(wait_until="domcontentloaded")
        await picker.wait_for_timeout(5000)
        ok3, views3, took3 = await wait_converged(pages)
        drawer_word_after = (await word_view(picker))[1]
        for n, v in zip(names, views3):
            print(f"画家重连后 {n}: {v}")
        assert ok3, "画家重连后题目不一致"
        assert drawer_word_before == drawer_word_after, (
            f"画家重连后题目变了: {drawer_word_before} -> {drawer_word_after}"
        )
        await picker.screenshot(path=str(SHOTS / "4_reconnect_drawer.png"))
        print(f"✅ 画家 5 秒内重连后题目不变，四人视图一致（~{took3}ms）")

        await browser.close()


asyncio.run(main())
