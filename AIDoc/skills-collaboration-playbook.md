# AI Skills 协作使用手册（14个技能）

## 1. 目标

本文档说明以下 14 个技能在项目中的定位、配合关系、典型使用时机，以及一个完整案例，帮助团队形成稳定的 Agent 工作流。

技能清单：

1. brainstorming
2. writing-plans
3. executing-plans
4. subagent-driven-development
5. dispatching-parallel-agents
6. using-superpowers
7. test-driven-development
8. systematic-debugging
9. verification-before-completion
10. requesting-code-review
11. receiving-code-review
12. using-git-worktrees
13. finishing-a-development-branch
14. writing-skills

## 2. 总体关系（分层）

### 2.1 设计与规划层

- brainstorming：把需求从想法澄清为设计方案。
- writing-plans：把设计转成可执行计划（任务拆解、顺序、验收标准）。

### 2.2 执行编排层

- executing-plans：按计划推进实现。
- subagent-driven-development：按模块拆分给子代理执行。
- dispatching-parallel-agents：并行推进多个独立任务，缩短交付时间。
- using-superpowers：增强开发效率（高效搜索、批量修改、上下文整合）。

### 2.3 质量保障层

- test-driven-development：先测试后实现，或先补测试再改逻辑。
- systematic-debugging：结构化定位和收敛问题。
- verification-before-completion：交付前统一验收（构建、测试、行为检查）。

### 2.4 协作评审层

- requesting-code-review：准备并发起高质量评审请求。
- receiving-code-review：消化评审意见并形成修改闭环。

### 2.5 分支与交付层

- using-git-worktrees：多任务并行开发时的隔离与管理。
- finishing-a-development-branch：分支收尾、整理提交、合并前检查。

### 2.6 资产沉淀层

- writing-skills：把高频流程沉淀为可复用技能模板。

## 3. 推荐协作流程

### 3.1 标准全流程（中大型需求）

1. brainstorming
2. writing-plans
3. executing-plans
4. subagent-driven-development 或 dispatching-parallel-agents（按任务复杂度二选一或组合）
5. test-driven-development（关键模块）
6. systematic-debugging（出现偏差时）
7. verification-before-completion
8. requesting-code-review
9. receiving-code-review
10. finishing-a-development-branch
11. writing-skills（可选：沉淀复用）

### 3.2 轻量流程（小改动）

1. writing-plans
2. executing-plans
3. verification-before-completion
4. finishing-a-development-branch

说明：

- 小需求可跳过 brainstorming，但仍建议至少有简化版计划。
- 一旦涉及架构、接口、数据模型调整，建议走全流程。

## 4. 各技能常见使用场景

### 4.1 brainstorming

适用：需求不清晰、方案存在分歧、需要明确范围与成功标准。

产出：设计思路、方案比较、达成一致的设计结论。

### 4.2 writing-plans

适用：准备进入实现阶段。

产出：任务清单、顺序、每步验收标准。

### 4.3 executing-plans

适用：已有计划，进入连续实现。

产出：按计划完成的代码和中间验证结果。

### 4.4 subagent-driven-development

适用：系统可按模块拆分（如前端、后端、测试）。

产出：模块化并行成果，主代理统一集成。

### 4.5 dispatching-parallel-agents

适用：多个独立子任务可并行（如文档、测试、接口改造）。

产出：并行执行结果与合并建议。

### 4.6 using-superpowers

适用：大仓库搜索、跨文件一致性修改、上下文快速提取。

产出：更快定位与更高效编辑路径。

### 4.7 test-driven-development

适用：核心逻辑、高风险变更、需要可回归保障。

产出：测试用例 + 通过的实现。

### 4.8 systematic-debugging

适用：启动失败、行为异常、非确定性问题。

产出：问题假设、验证记录、根因与修复。

### 4.9 verification-before-completion

适用：准备交付、提交或上线前。

产出：构建结果、测试结果、关键行为验证清单。

### 4.10 requesting-code-review

适用：准备进入评审。

产出：高质量评审上下文（改动意图、影响范围、验证证据）。

### 4.11 receiving-code-review

适用：收到评审意见后。

产出：分类处理意见（采纳/讨论/拒绝），并完成闭环。

### 4.12 using-git-worktrees

适用：同时推进多个分支任务，减少切分支成本。

产出：隔离开发目录和更清晰的并行管理。

### 4.13 finishing-a-development-branch

适用：分支收尾、准备合并。

产出：干净提交历史、可合并状态、清晰变更摘要。

### 4.14 writing-skills

适用：团队出现重复流程（例如固定发布步骤、固定排障链路）。

产出：团队可复用技能，降低重复沟通成本。

## 5. 典型配合策略

### 策略 A：需求探索优先

- 先用 brainstorming 明确边界，再用 writing-plans 固化动作。
- 适合需求变化快、多人协作场景。

### 策略 B：交付节奏优先

- 先 writing-plans，执行中结合 verification-before-completion 把关。
- 适合频繁迭代和短周期版本。

### 策略 C：质量稳定优先

- test-driven-development + systematic-debugging + verification-before-completion 作为必经路径。
- 适合核心模块或生产敏感系统。

## 6. 案例：为 hero-pk 新增“天气影响战斗”功能

### 6.1 目标

在对战开始前引入天气因素，影响双方能力系数，并在日志和结果中可见。

### 6.2 推荐技能串联

1. brainstorming
- 明确规则：晴天/阴天/雨天如何影响能力。

2. writing-plans
- 拆分任务：天气数据来源、规则引擎、结果展示、验证。

3. executing-plans
- 落地实现天气服务和战斗流程接入。

4. test-driven-development
- 补充关键规则测试（例如雨天固定 -20%）。

5. systematic-debugging
- 若出现端口冲突、启动异常、规则偏差，进行结构化排查。

6. verification-before-completion
- 构建通过、固定 seed 模拟通过、日志显示正确。

7. requesting-code-review -> receiving-code-review
- 提审并闭环意见。

8. finishing-a-development-branch
- 分支整理、提交、合并准备。

9. writing-skills（可选）
- 将“数值改动后必须模拟验证”的流程沉淀为团队技能。

### 6.3 案例价值

- 从“临时实现”升级为“可复用工作流”。
- 下次新增规则时，团队可按同样流程快速复用。

## 7. 实施建议（团队级）

1. 给每个技能定义触发条件
- 例如“涉及架构变更必须先 brainstorming”。

2. 规定最小交付证据
- 例如“合并前必须有 verification-before-completion 结果”。

3. 固化高频流程
- 每发生 3 次以上重复操作，即考虑用 writing-skills 沉淀。

4. 以流程可执行为优先
- 文档应指向可执行动作，不仅是原则描述。

## 8. 快速参考（TL;DR）

- 不清楚做什么：brainstorming
- 清楚但没计划：writing-plans
- 开始做：executing-plans
- 任务可并行：subagent-driven-development / dispatching-parallel-agents
- 质量控制：test-driven-development + systematic-debugging + verification-before-completion
- 准备交付：requesting-code-review -> receiving-code-review -> finishing-a-development-branch
- 形成组织资产：writing-skills
