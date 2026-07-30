## 已确认的根因

查了线上数据库的表结构：`players` 表只有 `id, room_id, name, score, round_score, has_guessed, is_host, avatar, joined_at, last_seen` — **没有 `avatar_svg` 这一列**（`rooms` 也没有 `room_theme`）。

但代码在建房/加入时都会写入 `avatar_svg`：

```
insertPlayer(supabaseAdmin, { room_id, name, avatar, avatar_svg })
→ 数据库报「column avatar_svg does not exist」
→ 代码 throw new Error("加入失败")
```

`insertRoom` 有缺列回退逻辑，`insertPlayer` 没有 —— 所以每一次建房/加入都必然报「加入失败」。这也解释了为什么头像看起来"没生成"：即便前端拍照成功，头像也永远存不进房间。

## 修复计划

1. **补数据库字段（主修）**
   - migration：`players` 加 `avatar_svg text`，`rooms` 加 `room_theme text`（代码已有回退，但补上更干净）。
   - 不改动现有 RLS / GRANT 策略。

2. **让插入失败不再变成一句无信息的「加入失败」**
   - 给 `insertPlayer` 加和 `insertRoom` 一样的缺列回退：写 `avatar_svg` 失败时，去掉该字段重试，玩家仍能进房。
   - 错误提示带上真实原因（例如「房间数据没准备好，请再试一次」），方便下次排查。

3. **头像改为非强制（按你的选择）**
   - 首页与房间加入页：没有拍照时，用名字生成默认卡通头像（`createDefaultAvatar` 已存在）直接进房，不再拦截。
   - 「必填」标签改为「可选」，按钮不再因没头像而 disabled；进房后仍可随时重拍替换。

4. **前端拍照链路核查**
   - 确认相机拍照 / 上传后预览圈能正确显示（`svgToDataUrl` 渲染），若发现取色区域越界导致灰白头像，一并修正。
   - 用浏览器脚本走一遍：拍照 → 建房 → 进房 → 计分板显示头像，确认端到端可用。

## 技术细节

- 涉及文件：新 migration、`src/lib/game.functions.ts`（insertPlayer 回退 + 头像可选）、`src/routes/index.tsx`、`src/routes/room.$code.tsx`、`src/components/game/SelfieAvatar.tsx`。
- 不改游戏轮次、聊天、RLS 逻辑。
