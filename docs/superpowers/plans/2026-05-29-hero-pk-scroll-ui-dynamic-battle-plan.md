# Hero PK 卷轴动态战斗 UI 实施计划

> For agentic workers: use small, verifiable slices; each task ends with a runnable check.

## Goal

在不改后端战斗接口的前提下，完成卷轴风动态对战演出：人物动作、技能特效、回合叙事、播放控制、头像展示。

## Architecture

1. 保持 `/api/battle/simulate` 响应不变。
2. 前端在 `app.js` 构建播放引擎和事件分类器。
3. `index.html` 承载舞台与控制器。
4. `styles.css` 提供主题和关键帧动画。

## Task Breakdown

### Task 1: 动态播放引擎

Files:
- `hero-pk/src/main/resources/static/app.js`
- `hero-pk/src/main/resources/static/index.html`

Steps:
- [x] 引入 `visibleLogs`、`playbackIndex`、`playbackSpeed`、`playing` 状态。
- [x] 实现 `startReplay`、`togglePlayback`、`stepBattle`、`replayBattle`。
- [x] 回合按定时器逐条推进并自动滚动。

Validation:
- 开战后日志逐条出现。
- 可暂停/继续/单步/重放。

### Task 2: 卷轴风主题与日志语义化

Files:
- `hero-pk/src/main/resources/static/styles.css`
- `hero-pk/src/main/resources/static/index.html`

Steps:
- [x] 增加纸张底纹、墨色字体、印章红强调色。
- [x] 增加战况播报条。
- [x] 增加日志色调分类（danger/toxic/system/neutral）。

Validation:
- UI 风格与旧版明显区分。
- 关键事件有视觉差异。

### Task 3: 人物攻防动画与技能特效

Files:
- `hero-pk/src/main/resources/static/app.js`
- `hero-pk/src/main/resources/static/index.html`
- `hero-pk/src/main/resources/static/styles.css`

Steps:
- [x] 增加左右人物动作类（前冲、受击、格挡）。
- [x] 增加舞台特效（斩击、破势、格挡、毒雾、回春）。
- [x] 在 `playNext` 根据日志内容触发特效。

Validation:
- 回合推进时可见动作与浮层。
- 暴击/格挡/中毒回合具有对应演出。

### Task 4: 头像资源接入

Files:
- `hero-pk/src/main/resources/static/index.html`
- `hero-pk/src/main/resources/static/styles.css`
- `hero-pk/src/main/resources/static/app.js`
- `hero-pk/src/main/resources/static/avatars/duelist-left.svg`
- `hero-pk/src/main/resources/static/avatars/duelist-right.svg`

Steps:
- [x] 舞台左右位渲染头像。
- [x] 增加头像资源目录与两张 SVG。
- [x] 保持头像在动作状态下可正常显示。

Validation:
- 页面可见左右头像。
- 动作和特效触发时头像不变形。

## Verification Checklist

- [x] `mvn -q -DskipTests clean package` 成功。
- [x] 应用可在 8081 启动。
- [x] 浏览器可验证动态播放和头像展示。

## Remaining Manual Review

1. 由产品/设计确认播报文案风格与武侠语气。
2. 由用户确认移动端展示密度是否需要再压缩。
