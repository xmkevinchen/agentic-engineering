# 落地计划 P0–P5

> **Status: historical — a source proposal, not a plan.** This is one of the
> independent proposals written before AE v1's design was consolidated. It was
> never the specification, and the specification it fed into has itself since
> been archived. **Nothing here has authority over current work.** The set and
> how each source was judged: [`README.md`](../../README.md). The current account of what AE
> is and where it is going: [`rebuild.md`](../../../../rebuild.md).

> 约束：个人项目，单人，兼职节奏。因此每期 0.5–2 天；期末三件套缺一不可：
> **可运行物**（真实文件，真实路径）、**可证伪出口**（一个能失败的测试，多为故障注入）、
> **删除清单**（精简是逐期兑现的，不是最后一期的愿望）。
> 自举纪律：P0 产出的契约流程，第一个用户就是 P1 自己——AE 用 AE 造 AE。

依赖：P0 → P1 → P2 → P3 → P4 → P5（严格串行，单人无并行收益）。总量 6–10 个工作日（兼职折算）。

---

## P0 · 契约与人确认（0.5–1 天）

**做**：
- 新增 `plugins/ae/templates/contract.template.md`：AC 模板落地
  （falsifier / mode / scope / floor / red_at_freeze，AC≤7 预算及超额说明位）。
- `skills/discuss/SKILL.md` 收口改动（最小 diff）：讨论产物由自由结论改为契约草案；
  守门①的挑战词换成四问（够不够 / 多不多 / 覆盖真实业务没有 / 异族视角缺什么）＋
  "查过地板没有"。
- 人确认动作定义：确认即 `contract_confirm` 事件（P1 前先以 contract.md frontmatter
  的 confirmed 行代记，P1 接入账本后补写事件）。

**出口（可证伪）**：用这套流程给 P1 立契约并由人确认 r1——这份契约本身就是 P0 的
验收品。若模板写不出 P1 的 falsifier，模板不合格，P0 不算完。

**删**：无。先立后破。

---

## P1 · runner ＋ 账本（1–2 天）

**做**：
- 新脚本① `plugins/ae/scripts/ae-run.py`（盲仪器）：
  读 contract.md 某 AC → timeout/项目 cwd/净化环境执行 verify →
  追加哈希链事件（含 output_digest、output_tail、snapshot.manifest_digest）。
- manifest_digest 实现：对工作区实际内容取摘要（临时 index + `git write-tree` 技法，
  或遍历散列——实现自由，出口固定：staged/unstaged/untracked 任一变化必须改变摘要）。
- `ledger.jsonl` 读写与链校验函数（gate 在 P2 复用）。

**出口（故障注入 ×3）**：
1. 记完事件后改一行代码 → 链校验通过但摘要不匹配，事件被判过期；
2. verify 命令 exit 127 → 事件如实记 fail 且 ae-run.py 以非零退出（E6 的失真路径关死）；
3. 手工篡改历史某事件一字节 → 链校验失败。

**删**：collect-ac-evidence.py 标记弃用（P2 收尸）。

---

## P2 · gate ＋ review 接线（1–2 天）

**做**：
- 新脚本② `plugins/ae/scripts/ae-gate.py`（盲仪器）：design §1.4 的代数原样实现，
  三值输出＋done 判定＋degraded 汇总。
- `skills/review/SKILL.md` 收口改动：判官逐 AC 读（AC＋证据＋必要代码，不读执行叙事）
  → 写 `judgement` 事件；空洞判定常设指令（0 例运行判 unproven）；守门②表述落位。
  **隔离判官在此获得显式工单（E10-③ 的关死）。**

**出口（故障注入 ×3）**：
1. 一条 AC 无任何事件 → unproven 阻塞 done；
2. 执行席位伪造 judgement → actor 校验拒收；
3. 构造"0 tests ran 但 exit 0"的绿 → 判官按常设指令打回 unproven。

**删**：collect-ac-evidence.py 删除；parse-review-verdict.sh 对照新 judgement 事件审计
（重叠即删）。

---

## P3 · 宿主见证（1 天）

**做**：
- `backend_invocation` 事件：复用 7fbc4b0 已落的归档可达性查询路径，把 MCP 日志核对
  结果写进账本（宿主侧写，代理席永远写不了这一种事件）。
- BACKEND 首行席位合同标准化进 `skills/agent-selection/`＋`agent-teams/`
  （run-2 已验证的措辞，从 session 手工纪律升为文字化合同）。
- 席位规格加模型档位字段；`pipeline.template.yml` 新增 `cross_family_seats:`
  （adequacy/judge required，debate optional）。

**出口（重放 ×2）**：
1. 重放 E1 剧本（诱导性 spawn prompt）→ gate 拒绝授予 cross-family 标签（无
   backend_invocation 事件）；
2. 重放 E3 剧本 → 诚实降级：workflow_attested＋degraded 记录，流程不假装。

**删**：check-relay-attestation.sh / check-family-reachability.sh 与新事件重叠部分
（审计后合并或删）。

---

## P4 · 知识棘轮（1–1.5 天）

**做**：
- `.ae/graph` → `.ae/knowledge` 更名；建 `map.md / checks.md / lessons/` 三件。
- 归档步扩展（F-082 归档写盘雏形之上）：逃逸缺陷与被推翻判决蒸馏进 checks.md/lessons。
- 契约模板 floor 槽接读取；`floor_change` 事件＋松绑需 human_ack 的 gate 校验（M5）。

**出口（读取命中，可证伪）**：P0–P3 dogfood 产生的至少一条真实教训落入 checks.md，
且 P5 的契约 floor 槽引用了它。零命中 = 本期不算完（写入侧统计不算数——E5/§1.5 原则）。

**删**：graph-*.py 八件按宪法逐一过堂（预期大部分删除，替代=归档时判官 lint）。

---

## P5 · 大清算 ＋ 发布 1.0.0（1–2 天）

**做**：
- 38 脚本逐一过盲仪器宪法，三栏记录（保留/重写/删除＋理由）——未亲读不预判，逐个过。
- 六值 verify_by → mode＋scope 迁移（存量特性目录一次性转换）。
- 24 skill 审计：逐个问"它消失了，什么算做完会不会变"；同时按 Fable 迁移实测结论
  （过度规定性 prompt 降低新模型输出质量）给 discuss/review/work（861/756/595 行）做
  去规定性瘦身——步骤散文降为目标＋约束＋检查点。
- 发布：plugin.json → 1.0.0、CHANGELOG、README 组件计数（CLAUDE.md 发布三步）。

**出口（终极 dogfood）**：一个真实新 feature 全程走新闭环到归档；全测试套＋jargon
tripwire 绿；五类失效注入（F1–F5 各一）全部被对应机制拦下。

**删**：本期就是删除清单本身的执行与记录。

---

## 风险与对策（只列会真发生的）

1. **人确认成为瓶颈**（单人项目里"人"和"agent 的操纵者"是同一位）→ 契约确认允许批量
   窗口：一次会话集中确认多份 r1；但确认动作本身不省略——省略它，F3/E8 立即回归。
2. **manifest_digest 性能**→ 只在事件写入时计算一次；大仓可缓存按 mtime 失效。
3. **判官成本**→ 判官输入受限（AC＋证据＋必要代码），不读全库；同族新鲜上下文为默认
   降级路径，跨家族只压在两个 required 席位上。
