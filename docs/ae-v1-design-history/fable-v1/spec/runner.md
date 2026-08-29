# 规范 · Runner（ae-run，盲仪器①）

> 上层设计见 `../design.md` §13。runner 是唯一执行 `command` proof 并写
> `command_result` 的路径——agent 直接跑命令产生的任何输出都不是证据。
> 它知道怎么执行一个 argv 并记录，永远不知道命令的意思（宪法）。

## 1. source manifest 算法（M2 的机械定义）

输入：契约内该 proof 的 `source_set {paths, declared_untracked}`。

```
1. 候选全集 = git tracked（HEAD∪index）∪ index 新增 ∪ declared_untracked 逐字面路径
2. 对 paths 的每个 glob 在候选全集上匹配（gitignore 语义的 ** 展开），并集
3. 按 Unicode 码点排序
4. 逐路径记录：
   {path, status: present | absent,
    mode: 100644 | 100755 | symlink,
    content_sha256: 工作区字节（present 时；absent 记 null）}
   - symlink：digest 取链接目标字符串本身；目标 realpath 逃出 repo → 记
     {escape: true}（事实，不在此处判罪——判罪在门与守门①）
   - declared_untracked 中不存在的路径记 absent（存在性本身是事实）
5. manifest 文件 = canonical JSON（排序键、LF）写入 runs/RUN-*/source-manifest.json
   manifest_digest = sha256(canonical_bytes)
```

性质：**set 外的任何变动不影响 digest**（无关改动不误伤证据）；set 内
staged/unstaged/untracked 的任何字节变化必然改变 digest；回滚到旧状态 digest 复原
（内容寻址——已证状态的证据自动重新可采信，见 ledger-gate §5）。

诚实边界：命令实际读取了 set 外文件时 manifest 盖不住——这是 source_set 声明缺陷。
两道补偿：守门①冻结前挑战 set 完整性；判官对输出中观察到的 set 外读取报
coverage finding（种子地板 PF-source-set-honest）。

## 2. 执行策略

```
输入: feature, proof_id, attempt
流程:
  读契约(current revision) → 定位 proof → 校验 count_rule digest
  → 计算 pre manifest
  → capability 预检: recipe 要求的 enforced 隔离宿主给不出
      → 写 capability_observation{absent} 闭合该 attempt 为 unavailable, exit 3
  → 执行:
      argv 数组直接 exec（无 shell 解释; argv[0] 是解释器 ⟹ 契约必须已标 high_risk,
        否则拒绝执行, exit 2）
      cwd = realpath(recipe.cwd), 必须在 repo root 之下, 否则拒绝 exit 2
      env = {PATH, HOME, LANG, LC_ALL, TZ} ∪ recipe.env_declared 白名单
            （只白名单, 无黑名单; ANTHROPIC_*/AWS_*/GITHUB_TOKEN 等一切未声明变量
             一概不继承——不是过滤敏感, 是只给声明过的）
      timeout: SIGTERM → 5s 宽限 → SIGKILL, 作用于进程组（fork 后代一并终止）
      stdout/stderr: 各流上限 2 MiB; 全量落 runs/RUN-*/std{out,err}, 超限部分截断
        并置 truncated: true（事件里是 digest+尾 4KiB+截断标志, 原文在 runs/）
  → count_rule 执行（若声明; 截断流上 count=null, 见 contract §4）
  → 计算 post manifest（TOCTOU: pre≠post ⟹ 门判该 attempt invalid, runner 仍如实记录）
  → 写 command_result 事件（追加协议见 ledger-gate §2）
退出码: 0=已执行并记录（命令本身红绿与 runner 无关）; 2=拒绝执行(策略违规);
        3=unavailable; 1=runner 自身故障（记录不完整, 什么都不算数）
```

**E6 的失真路径在此关死**：命令 exit 127 → 事件如实 `{exit_code: 127}`、runner
exit 0（"执行并记录"成功）；谓词 `exit_code_in [0]` 为假 → proof failed。
runner 的退出码与命令的退出码彻底分离，各自只报告自己。

网络策略两档（contract §3.1）：`declared`＝记录意图、人签过、不强制（v1 默认，
因当前宿主无沙箱——强制档会让一切命令 unavailable）；`enforced`＝要求宿主隔离，
缺席即 unavailable 不裸跑。**能检测不能阻止的，标 tamper-evident，不称 guarantee。**

## 3. 写保护

`contract/`、`ledger/`、`state/`、`.ae/policies/`、`.ae/transactions/` 永不在任何
recipe 的合法写路径内。runner 不做实时拦截（无沙箱时拦不住），靠三道事后网：
pre/post manifest（set 内改动显形）、门对保护路径的独立 digest 校验（契约与账本
被改必然断链/断 digest）、PreToolUse hook 纵深。写了就会被看见，这是 v1 能诚实
承诺的全部。

## 4. 攻击矩阵（P1 出口，逐条唯一预期）

| ID | 注入 | 唯一预期 |
|---|---|---|
| R-01 | argv 含 shell 元字符 `;`, `&&`, `$()` | 作为字面参数传给进程（无 shell 展开）；命令自身行为如实记录 |
| R-02 | cwd = `../../etc` 或绝对外部路径 | runner exit 2，无事件外的任何执行 |
| R-03 | cwd 经 symlink 逃出 repo | realpath 后同 R-02 |
| R-04 | recipe 命令写 `ledger/events.ndjson` | 事后网显形：链校验断 → feature_status integrity_error；该 attempt invalid |
| R-05 | 命令 fork 后代并超时 | 进程组 SIGKILL；事件记 {signal, duration}；`signal_is_null` 谓词为假 |
| R-06 | 输出 100 MiB | 2 MiB 截断＋truncated:true；`output_not_truncated` 为假；count=null ⟹ 计数谓词 invalid |
| R-07 | recipe 依赖未声明的 `SECRET_KEY` 环境变量 | 变量不存在（白名单外不继承）；命令按自身行为失败并如实记录 |
| R-08 | `network: {policy: deny, strength: enforced}` 而宿主无隔离 | capability_observation{absent} → unavailable，命令不启动 |
| R-09 | 同 feature 两个 run 并发 | feature 级文件锁：后者等待或 exit 2（记录锁冲突），无交叉写 |
| R-10 | run 中途改 source set 内文件 | pre≠post → 门判 attempt invalid（事件如实保留） |
| R-11 | high_risk 未标而 argv[0]=bash | runner exit 2，拒绝执行 |
| R-12 | count_rule digest 与契约不符 | runner exit 2（防运行时换规则） |

每条都要有 fixture；预期是唯一的——"invalid 或 unavailable 均可"这种写法本身算失败
（验收原则 6）。
