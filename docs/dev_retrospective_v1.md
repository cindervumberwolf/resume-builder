# Resume Builder GPT — 第一版开发回顾

> 归档时间：2026-04-15
> 版本：v1（Custom GPT + Actions 架构，Railway 部署）

---

## 一、项目概述

### 目标
构建一个私有 Custom GPT，用于：
1. 润色和改写简历 bullet，基于用户提供的真实事实
2. 将用户简历模块化存储，针对特定 JD 调取匹配模块
3. 直接编译 LaTeX，生成可下载的 PDF 简历

### 最终架构：Custom GPT + Actions + Railway 后端

```
用户 (ChatGPT 界面)
    ↕ 对话
Custom GPT (Instructions + Knowledge)
    ↕ OpenAPI Actions (REST)
Express.js API (Railway 容器)
    ├── SQLite 数据库（模块、JD、exemplar 存储）
    └── XeLaTeX 编译器（中英文 PDF 生成）
```

---

## 二、架构演进过程

### 阶段 1：MCP App 方案（已放弃）

最初设计为 ChatGPT MCP App（Model Context Protocol），通过 MCP Server 暴露工具给 GPT 使用。

**放弃原因：**
- PDF 在会话中传输导致 App 被关闭
- MCP Server 需要本地维护，部署摩擦大
- ChatGPT App 对 PDF 上传/处理的原生支持弱

### 阶段 2：Custom GPT + Actions 方案（当前版本）

转向 Custom GPT，将后端逻辑封装为 REST API，通过 OpenAPI schema 定义 Actions。

**优势：**
- GPT 原生支持 PDF 上传、Knowledge 文件、Code Interpreter
- 后端只需维护标准 REST API，无 MCP 依赖
- Knowledge 文件可存放风格指南、LaTeX 模板等参考资料

---

## 三、后端技术栈

| 组件 | 选型 | 说明 |
|------|------|------|
| 运行时 | Node.js 22 + TypeScript | 编译为 JS 后部署 |
| Web 框架 | Express.js | 轻量 REST API |
| 数据库 | SQLite (better-sqlite3) | 轻量本地存储，无需外部 DB 服务 |
| Schema 验证 | Zod | TypeScript-first 校验 |
| LaTeX 编译 | XeLaTeX + texlive-lang-chinese | 支持中英文混排 |
| 中文字体 | Noto Sans CJK SC | 通过 fonts-noto-cjk 安装 |
| 容器化 | Docker（多阶段构建） | builder 阶段编译 TS，production 阶段运行 |
| 部署平台 | Railway | Git push 自动触发重新构建 |
| API 规范 | OpenAPI 3.1.0 | 定义 GPT Actions |

### API Endpoints

| operationId | 方法 | 路径 | 功能 |
|-------------|------|------|------|
| `storeModules` | POST | `/api/modules` | 存储简历模块和 bullet |
| `listModules` | GET | `/api/modules` | 列出所有存储模块 |
| `storeJd` | POST | `/api/jd` | 存储 JD |
| `listJds` | GET | `/api/jd` | 列出所有 JD |
| `matchModules` | POST | `/api/match` | 按 JD 匹配最相关模块 |
| `compileLatex` | POST | `/api/latex/compile` | 编译 LaTeX 返回 PDF 下载链接 |

---

## 四、GPT 配置文件清单

| 文件 | 用途 | 放置位置 |
|------|------|----------|
| `custom_gpt_instructions_compact.md` | GPT 行为指令（核心） | GPT Instructions 文本框 |
| `resume_style_guide_v2.md` | 风格规范、地区规则、反模式 | GPT Knowledge |
| `latex_template_preserved.tex` | LaTeX 简历模板 | GPT Knowledge |
| `action_verbs_draft.md` | 动词参考库 | GPT Knowledge |
| `anti_patterns_draft.md` | 禁用表达参考 | GPT Knowledge |
| `openapi.yaml` | Actions API 定义 | GPT Actions Schema |

---

## 五、遇到的问题与解决方案

### 5.1 部署相关

#### 问题：Docker build 失败 — `.db` 文件不在 Git 中
SQLite 数据库文件被 `.gitignore` 排除，Railway 构建时找不到。

**解决方案：** 修改 Dockerfile，将 `init.js` 和 `seed.js` 移到容器启动时执行（`CMD` 阶段），而不是构建时，同时确保 `schema.ts` 用 `fs.mkdirSync` 自动创建 `data/` 目录。

#### 问题：TypeScript 编译失败 — `npx tsc` 找不到
Production 镜像中没有安装 devDependencies，导致 `typescript` 不可用。

**解决方案：** 改为多阶段 Docker 构建：
- `builder` 阶段：`npm ci`（含 devDeps）→ `npx tsc`
- `production` 阶段：`npm ci --omit=dev` + 复制 `dist/`

#### 问题：Railway 反向代理导致 PDF 链接为 HTTP，被浏览器拦截
Railway 架构为 `用户 → HTTPS → nginx → HTTP → Node.js`，`req.protocol` 返回 `http`。

**解决方案：**
```typescript
app.set("trust proxy", 1); // 让 Express 读取 X-Forwarded-Proto
// latex.ts 中额外 fallback：
const proto = req.get("x-forwarded-proto") ?? req.protocol;
```

---

### 5.2 LaTeX 编译相关

#### 问题：中文简历编译报错 — `xeCJK` 宏包缺失
Dockerfile 安装了 `texlive-xetex` 但缺少 `texlive-lang-chinese`，导致 `\usepackage{xeCJK}` 失败。

**解决方案：** 在 Dockerfile 中增加 `texlive-lang-chinese` 和 `fonts-noto-cjk`，并在 LaTeX 模板中显式声明字体：
```latex
\usepackage{xeCJK}
\setCJKmainfont{Noto Sans CJK SC}
\setCJKsansfont{Noto Sans CJK SC}
\setCJKmonofont{Noto Sans CJK SC}
```

#### 问题：LaTeX 编译慢（首次 ~30 秒）
容器每次冷启动都需要重新扫描字体，Noto CJK 字体文件体积大。

**解决方案：** 在 Docker build 阶段预热字体缓存：
```dockerfile
RUN fc-cache -fv && \
    # 编译一个 warmup 文档，触发字体索引写入镜像层
    cd /tmp/warmup && xelatex -interaction=nonstopmode warmup.tex || true
```

#### 问题：GPT 用 Code Interpreter 编译 LaTeX，而不是调用 `compileLatex` Action
GPT 自行选择使用内置 Python 沙盒运行 xelatex，绕过了我们的 Railway 服务。

**解决方案：** 在 Instructions 中加入强制禁令：
> ALWAYS call the `compileLatex` Action for PDF compilation. NEVER use Code Interpreter, Python, or subprocess to compile LaTeX under any circumstances.

---

### 5.3 GPT 行为相关

#### 问题：每次 Action 调用都弹出确认框
ChatGPT 对所有 POST 操作默认要求用户确认。

**解决方案：** 在 `openapi.yaml` 的每个 POST operation 中加入：
```yaml
x-openai-isConsequential: false
```
之后用户点一次 "Always Allow" 即可永久静默。

#### 问题：Instructions 超过 8000 字符限制
初版 Instructions（`custom_gpt_instructions_v2.md`）共 12825 字符，无法保存。

**解决方案：** 将详细规则、示例、地区规范移入 Knowledge 文件，Instructions 只保留核心行为逻辑和工作流，压缩至 ~5500 字符。

#### 问题：bullet 改写输出不稳定（同一输入多次运行质量差异大）
当用户没有提供 outcome/impact 时，GPT 每次随机填充不同的结尾，部分版本明显弱于其他。

**根因分析：** 缺少事实锚点时 GPT 的输出完全由概率采样决定，没有约束。

**解决方案：** 引入两个机制：
1. **Soft outcome**：当无 outcome 时，从任务性质推导逻辑必然的方向/用途（如 `weekly reports → to support business review`），只描述方向，不捏造幅度
2. **标注缺失维度**：每次改写后强制附加提示，告知用户哪些维度（scale/method/hard outcome）缺失，引导补充真实数据

#### 问题：角色差异化改写（同事实 × 不同 JD）存在越界扩写风险
为使咨询版和数科版产生明显差异，初版 role archetypes 示例中引入了用户未提供的数字、工具和细节，违反"不捏造"原则。

**结论：** 同一批稀薄事实，角色差异只能体现在动词选择和句式侧重上，差异空间有限。正确做法是先追问用户补充细节，而不是靠捏造制造视觉差异。

---

## 六、Instructions 设计原则（经验总结）

1. **强制禁令用 NEVER/ALWAYS/mandatory**：软性建议（如 "prefer"）容易被 GPT 在执行用户明确指令时覆盖
2. **不靠 GPT 自觉调用 Knowledge**：Knowledge 文件是 GPT 的背景上下文，不需要显式调用，也无法强制；只能通过 Instructions 规定行为约束
3. **事实稀薄时不能靠 GPT 填补**：GPT 填充缺失信息会导致输出不稳定且存在捏造风险，应引导用户补充或使用逻辑推导的 soft outcome
4. **角色原型差异化有边界**：差异化的前提是用户提供了足够丰富的事实，Instructions 应当引导用户提供，而不是让 GPT 自行创造
5. **Instructions 字符限制是硬约束**：在 8000 字符限制内，详细示例和参考材料必须放进 Knowledge 文件

---

## 七、待优化方向

| 优先级 | 方向 | 说明 |
|--------|------|------|
| 高 | bullet 改写测试稳定性 | soft outcome 机制上线后需重新跑 R-01、Q-02 验证 |
| 高 | 评测集系统化运行 | 目前评测集（`eval/test_suite.md`）有 25 个用例，需完整跑一遍建立基线 |
| 中 | exemplar 数据接入 | 数据采集脚本已准备（Oxford、Yale），但 exemplar 尚未批量导入后端 |
| 中 | LaTeX 编译速度 | 字体预热已加入 Dockerfile，待验证实际效果 |
| 低 | 多用户支持 | 当前 SQLite 是单用户设计，如需多人使用需引入用户 ID 隔离 |

---

## 八、文件结构（当前版本）

```
resume/
├── server/
│   └── src/
│       ├── api.ts              # Express 主入口，trust proxy 设置
│       ├── db/
│       │   ├── client.ts       # SQLite CRUD
│       │   ├── schema.ts       # 表结构 + 自动建目录
│       │   ├── init.ts         # 初始化脚本
│       │   └── seed.ts         # 种子数据
│       ├── routes/
│       │   └── latex.ts        # LaTeX 编译路由
│       └── types/              # Zod schema + TypeScript 类型
├── Dockerfile                  # 多阶段构建 + xelatex 预热
├── openapi.yaml                # GPT Actions 定义
├── custom_gpt_instructions_compact.md  # GPT Instructions（当前生效版本）
├── custom_gpt_instructions_v2.md       # 完整版草稿（备份）
├── resume_style_guide_v2.md    # Knowledge：风格规范
├── latex_template_preserved.tex # Knowledge：LaTeX 模板
├── knowledge_file_plan_v2.md   # Knowledge 文件规划文档
├── eval/
│   └── test_suite.md           # 评测集（25 个用例）
└── dev_retrospective_v1.md     # 本文件
```
