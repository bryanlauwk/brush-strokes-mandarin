## 诊断（已查证）

查了你正在看的房间 `FACFM`，数据库里的实际状态是：

- `status = waiting`（还没开局）
- `drawer_id = 空`
- 房里只有 **1 位玩家**

代码里画布的开关是 `canDraw = 我是画画人 && room.status === "drawing"`（`src/routes/room.$code.tsx`），而 `DrawBoard` 在 `canDraw` 为 false 时会直接忽略所有笔触事件，同时整块工具栏（颜色／笔刷／橡皮）也不渲染。

所以「画不到」不是画布坏了，而是：**游戏还没开始**。开局按钮又要求至少 2 人（`players.length >= 2`），你一个人在房里，永远停在等待状态 → 画布全程锁死，而界面并没有把这件事讲清楚。

## 要做的改动

1. **等待厅自由涂鸦**
   `status === "waiting"` 时开放画布给所有人随便画（本地 + 实时广播，不计分、不写入正式回合记录），开局时自动清空。这样一进房就有得画，不会觉得「坏了」。

2. **锁定原因写清楚**
   画布顶栏的提示文字按状态分开：
   - 等待中 → 「等开局，先随便涂两笔」
   - 选题中 → 「画画人在选题目…」
   - 别人在画 → 「轮到 XXX 画，你负责猜」

3. **开局条件提示**
   等待卡片上，人数不足时显示「还差 1 人才能开始（现在 1/2）」，并把开始按钮的禁用原因讲明白，而不是只是灰掉。

4. **工具栏常驻**
   工具栏不再随 `canDraw` 整块消失，改成不可用时保留但置灰，避免界面忽然少一块让人以为出错。

## 技术细节

- `src/components/game/DrawBoard.tsx`：把 `canDraw` 拆成 `canDraw`（可落笔）与 `lockReason`（提示文案）；工具栏改用 `disabled` 状态而非条件渲染。
- `src/routes/room.$code.tsx`：`waiting` 状态下传 `canDraw={true}`，笔触只走 `broadcastLive` / 本地 `appendLocalStroke`，**不**调用 `pushStroke` 服务端函数；`startGame` 成功后清空本地涂鸦。
- 等待卡片（同文件内 `WaitingCard`）加人数进度文案。
- 不动数据库、不动 RLS、不动计分逻辑。
