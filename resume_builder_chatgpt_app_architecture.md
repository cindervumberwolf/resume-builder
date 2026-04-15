# 基于 ChatGPT App 的 Resume Builder 方案总结（学生实习 / 校招版）

## 1. 项目目标

目标不是先训练一个“万能写简历模型”，而是先做一个 **面向自用、服务在校生实习/应届校招申请** 的轻量型 Resume Builder。

这套系统的核心能力应当包括：

1. 将岗位 JD 解析为统一的标准 schema。
2. 将已有简历、项目、课程、社团、研究、获奖等材料拆解为可复用模块。
3. 基于目标 JD，从模块库中检索并组合最合适的内容。
4. 在生成时调用“顶校职业发展中心范例库”进行表达优化。
5. 对生成结果进行对岗性、自洽性、表达质量和格式一致性的检查。

这意味着你的第一版产品不应该是“黑箱式写简历”，而应该是一个：

> 会解析 JD、会调用模块、会参考范例、会自检输出的 ChatGPT App。

---

## 2. 为什么优先走 ChatGPT App 路线

你当前的目标是先做自用工具，而不是一个独立面向市场收费的 SaaS。基于这个前提，**ChatGPT App 路线比立刻做独立站 + API 更适合现阶段**。

原因如下：

### 2.1 优点

- 你已经有 ChatGPT Pro，可直接在 ChatGPT 生态内先验证 workflow。
- 你可以把交互界面直接渲染在 ChatGPT 中，不必立刻做完整前后端产品。
- ChatGPT 擅长做推理、重写、比较、风格迁移和结构化整理，非常适合做“简历装配器”。
- 第一版更容易迭代：schema 不合理、模块粒度不对、范例库不够好，都可以快速调整。

### 2.2 需要接受的边界

- 这条路适合做 **ChatGPT 内部工具**，不适合把 ChatGPT Pro 账户当成外部产品 API 来用。
- 真正的“参数训练”（如 LoRA、微调）不在 ChatGPT App 内原生发生。
- 如果未来要做独立站、自动化批量处理、后台任务流或对外服务，大概率还是要切 API 或自建模型基础设施。

因此，当前阶段的最优策略不是：

> 先训练一个模型来写简历

而是：

> 先做一个有清晰 schema、模块库、检索逻辑和风格层的 ChatGPT App。

---

## 3. 系统总架构

整体可以拆成四层：

1. **ChatGPT 对话层**：用户与系统交互的入口。
2. **ChatGPT App UI 层**：在 ChatGPT 中显示上传区、模块区、预览区和评估区。
3. **MCP Server 工具层**：承接解析、检索、组装、评分等能力。
4. **数据层**：存放 JD schema、简历模块库、范例库和统一 taxonomy。

一个直观的结构如下：

```text
[User in ChatGPT]
        |
        v
[ChatGPT App UI]
  - 上传 JD
  - 上传 master resume
  - 查看模块选择结果
  - 编辑最终简历
        |
        v
[MCP Server]
  ├─ parse_jd
  ├─ parse_master_resume
  ├─ retrieve_modules
  ├─ retrieve_exemplars
  ├─ rewrite_bullet
  ├─ compose_resume
  ├─ critique_resume
  └─ export_resume
        |
        +-------------------+
        |                   |
        v                   v
[User Data Store]      [Exemplar Store]
  - JD schemas           - 顶校范例 bullet
  - Resume modules       - 好/坏示例
  - Preferences          - 风格标签
  - Role taxonomy        - 行业模板
```

其中：

- **ChatGPT** 负责理解、推理、改写、排序建议和最终组装。
- **MCP Server** 负责把外部数据、检索逻辑和结构化工具暴露给 ChatGPT。
- **数据库** 负责保存你的个人材料、范例和中间结果。

---

## 4. 三类核心数据对象

这个产品本质上只有三类关键对象：

1. `JD schema`
2. `Resume module`
3. `Exemplar style block`

### 4.1 JD schema

JD schema 的目的不是“总结一段 JD”，而是把岗位要求转成可检索、可匹配、可约束生成的结构。

建议字段如下：

```json
{
  "job_id": "jd_2026_001",
  "raw_text": "...",
  "meta": {
    "company": "Bain",
    "team": "Consulting",
    "location": "Shanghai",
    "role_title": "PTA",
    "language": "en",
    "seniority": "student_intern"
  },
  "hard_requirements": [
    "problem solving",
    "excel",
    "powerpoint",
    "research"
  ],
  "soft_requirements": [
    "communication",
    "teamwork",
    "ownership"
  ],
  "preferred_signals": [
    "consulting exposure",
    "leadership",
    "analytical coursework"
  ],
  "domain_tags": [
    "consulting",
    "strategy",
    "generalist"
  ],
  "evidence_targets": [
    {
      "signal": "structured analysis",
      "examples": ["market sizing", "research synthesis", "framework thinking"],
      "priority": 0.95
    },
    {
      "signal": "client-readiness",
      "examples": ["slides", "stakeholder communication"],
      "priority": 0.80
    }
  ],
  "style_constraints": {
    "resume_language": "en",
    "bullet_style": "result_first",
    "quant_preference": "high",
    "tone": "professional_student"
  }
}
```

其中最关键的字段不是公司名，而是：

- `hard_requirements`
- `preferred_signals`
- `evidence_targets`
- `style_constraints`

因为真正决定简历怎么组装的，是岗位希望看到什么“证据”。

### 4.2 Resume module

不要把简历当作一页连续文档存储，而要拆成 **最小可复用证据单元**。

建议分两层：

#### A. experience-level module

```json
{
  "module_id": "exp_xhs_strategy_01",
  "type": "experience",
  "section": "experience",
  "organization": "Xiaohongshu",
  "title": "Research / Strategy Project",
  "date_range": "2026-03",
  "context_tags": ["consumer internet", "strategy", "content platform"],
  "base_priority": 0.85,
  "source_type": "master_resume"
}
```

#### B. bullet-level module

```json
{
  "bullet_id": "bullet_xhs_03",
  "parent_module_id": "exp_xhs_strategy_01",
  "raw_fact": "Built a daily AI/Agent industry tracking workflow using trusted sources and structured evaluation dimensions.",
  "normalized_fact": {
    "action": "built",
    "object": "industry tracking workflow",
    "method": ["source curation", "deduplication", "structured evaluation"],
    "output": "3-5 high-priority daily signals",
    "metric": null
  },
  "evidence_tags": [
    "research",
    "information synthesis",
    "structured thinking",
    "ai industry"
  ],
  "skill_tags": [
    "analysis",
    "prioritization",
    "market monitoring"
  ],
  "role_fit_tags": [
    "consulting",
    "strategy",
    "ib_generalist"
  ],
  "strength_score": {
    "clarity": 0.82,
    "quantification": 0.40,
    "brand_signal": 0.70,
    "transferability": 0.88
  },
  "rewrite_candidates": []
}
```

这样做的价值是：

- 同一段经历可以针对不同岗位选择不同 bullet。
- 不必整段照搬，而是可以精细化删改。
- 后续风格优化可以落到 bullet 级，而不是整页简历级。

### 4.3 Exemplar style block

这部分就是“学习顶校范例”的核心载体。

重点不是存一整份范例简历，而是把范例拆成 **风格块**。

```json
{
  "exemplar_id": "wharton_consulting_bullet_12",
  "source": "Wharton Career Services",
  "track": "consulting",
  "seniority": "student",
  "section": "experience",
  "bullet_text": "Synthesized market, competitor, and customer data to support go-to-market recommendations for a student venture.",
  "style_features": {
    "opens_with_action_verb": true,
    "result_first": false,
    "quantified": false,
    "length_band": "medium",
    "tone": "professional_compact"
  },
  "latent_tags": [
    "synthesis",
    "research",
    "recommendation",
    "student_safe"
  ],
  "anti_patterns": []
}
```

这样保存之后，你就能把“范例学习”转化为：

- 相似岗位风格检索
- 相似经历写法检索
- 对比式重写
- 风格评分

而不是先上 LoRA。

---

## 5. 统一 taxonomy：这套系统的关键中间层

如果没有统一词表，你的 JD 和旧简历之间会出现严重的“语义像但字段不统一”的问题。

例如 JD 里可能写：

- research
- market scanning
- synthesis
- analytical rigor

而你的旧简历里可能写：

- tracked industry trends
- summarized reports
- compared competitors
- built research framework

这些表达本质接近，但如果没有标准化层，检索和匹配会非常不稳定。

因此建议建立一个小型 taxonomy：

```json
{
  "signal_taxonomy": {
    "structured_analysis": [
      "market research",
      "competitive analysis",
      "information synthesis",
      "frameworking"
    ],
    "client_communication": [
      "slides",
      "presentation",
      "stakeholder communication"
    ],
    "ownership": [
      "built from scratch",
      "led independently",
      "drove execution"
    ]
  }
}
```

这个中间层将被同时用于：

- JD schema 标准化
- Resume modules 打标签
- Exemplar 检索
- 最终对岗匹配评分

这是决定系统效果上限的关键基础设施。

---

## 6. 建议暴露的 MCP tools

基于当前目标，第一版建议设计以下工具。

### 6.1 `parse_jd`
输入：JD 原文  
输出：标准化 `JD schema`

用途：把岗位要求转化为结构化对象。

### 6.2 `parse_master_resume`
输入：现有简历、项目描述、课程、奖项等  
输出：`resume_modules[]`

用途：完成材料 modularization。

### 6.3 `retrieve_modules`
输入：`JD schema`  
输出：最适合该岗位的经历模块和 bullet 排序结果。

用途：解决“选哪几段经历、每段保留几条 bullet”的问题。

### 6.4 `retrieve_exemplars`
输入：岗位类型 + bullet 语义标签  
输出：最相似的 3–5 条范例。

用途：实现对“顶校范例风格”的检索式调用。

### 6.5 `rewrite_bullet`
输入：原始 bullet + exemplar set + role constraints  
输出：多个版本的改写候选。

建议至少输出三档：

- conservative
- balanced
- aggressive

### 6.6 `compose_resume`
输入：已选 modules + exemplars + style constraints  
输出：一版完整 resume draft。

用途：生成最终一页简历。

### 6.7 `critique_resume`
输入：resume draft + JD schema  
输出：问题清单与评分。

建议评分维度包括：

- relevance
- evidence strength
- wording quality
- formatting consistency

### 6.8 `export_resume`
输入：最终结构化简历  
输出：markdown / JSON / LaTeX-ready 文本。

第一版建议先支持 markdown 或 JSON，不必一开始就做复杂排版导出。

---

## 7. 一次完整调用链应当如何运行

用户操作：

1. 上传 JD
2. 上传 master resume / 补充材料
3. 选择目标岗位类型（咨询、IB、战略、产品等）
4. 查看并微调系统推荐结果

系统内部流程：

1. `parse_jd`
2. `parse_master_resume`
3. `retrieve_modules`
4. `retrieve_exemplars`
5. `compose_resume`
6. `critique_resume`
7. `export_resume`

UI 建议采用三栏：

- 左栏：JD schema / 岗位信号
- 中栏：被选中的模块与可替换 bullet
- 右栏：最终简历预览

下方可附：

- 问题提示
- 可选替换文案
- 风格评分
- “为什么选这段经历”的解释

这会比纯黑箱生成更适合你，因为你要的不只是结果，还包括“系统为什么这么选”。

---

## 8. 不做 LoRA 时，如何实现“学习顶校范例”

答案是：通过 **检索式学习** 来实现，而不是先做参数训练。

建议分三层。

### 8.1 范例库层

整理顶级高校 career center / business school / consulting club / investment club 发布的 resume 资料，并拆成：

- 好 bullet 示例
- 差 bullet 示例
- 动词与句式库
- 常见问题范例
- 行业特化写法

### 8.2 风格标签层

给每条 exemplar 打标签：

- 岗位方向：咨询 / IB / 战略 / 产品 / 市场
- 人群层级：student / intern / experienced
- 句式风格：result-first / action-first
- 是否量化：quantified / non-quantified
- 篇幅特征：short / medium / long
- 风格特征：compact / polished / analytical / leadership-heavy

### 8.3 检索式改写层

每次重写 bullet 时，不再只是说“请优化这句话”，而是同时提供：

- 当前 JD schema
- 当前 bullet 的事实结构
- 最相关的 3–5 条 exemplars
- 明确改写约束

例如：

```json
{
  "rewrite_constraints": {
    "must_keep_facts": true,
    "no_fabrication": true,
    "max_words": 28,
    "tone": "student_professional",
    "quantify_when_supported": true
  }
}
```

这类做法通常已经足够接近“学会了顶校范例风格”的效果。

---

## 9. 什么时候才值得做 LoRA / 微调

现阶段，我仍然不建议先做 LoRA。

原因不是它没用，而是它现在并不是这套产品最稀缺的部分。

在 resume builder 场景里，真正决定质量的通常是：

- schema 是否合理
- modularization 是否细致
- taxonomy 是否统一
- exemplar 检索是否准确
- 改写约束是否清楚
- critique 机制是否可靠

只有当你后面反复观察到以下问题时，LoRA 才值得：

1. 已经给了足够好的 exemplars，模型仍然经常写偏。
2. 某一类岗位风格必须高度稳定、不能漂移。
3. 你需要做批量简历重写。
4. 你想把“你偏好的表达方式”固化为一个更窄的改写器。

即便那时，也不建议训练整个 resume builder，而应该只训练一个非常窄的子任务，例如：

> 给定原始事实 + 岗位类型 + 写作约束，输出一条 student-safe、不可捏造、符合特定行业风格的 bullet。

这会比训练一个“整页简历生成器”更加可控。

---

## 10. 第一版 MVP 的优先级

### 第 1 阶段：先打数据基础

完成：

- JD schema
- Resume module schema
- Exemplar schema
- taxonomy

### 第 2 阶段：先做 4 个核心工具

先实现：

- `parse_jd`
- `parse_master_resume`
- `retrieve_modules`
- `compose_resume`

### 第 3 阶段：补表达优化层

再加：

- `retrieve_exemplars`
- `rewrite_bullet`
- `critique_resume`

### 第 4 阶段：补 UI 与导出

最后做：

- ChatGPT App 三栏界面
- markdown / JSON 导出
- 可视化 diff

这条路线能保证你尽快看到价值，而不是把时间都花在后期基础设施上。

---

## 11. 你应该在什么环境下做这些工作

这是最实际的问题。结论如下：

### 11.1 你可以用 Cursor 开发

**可以，而且很适合。**

Cursor 适合作为你的开发 IDE，用来完成：

- MCP server 编码
- 数据结构定义
- 本地数据库与向量库接入
- 前端 UI 编写
- prompt / tool contract 管理
- 本地调试与版本控制

如果你已经习惯 Cursor，它完全可以承担“日常开发环境”的角色。

### 11.2 但你不能只待在 Cursor 里完成全部工作

因为你的目标不是做一个普通本地程序，而是做一个 **运行在 ChatGPT 中的 App**。

这意味着：

- 代码可以在 Cursor 写。
- MCP server 可以在本地或云端部署。
- 但最终的 GPT / App 配置、连接、测试和实际使用，仍然需要进入 **ChatGPT 网页端** 完成。

也就是说：

> Cursor 负责开发，ChatGPT 网页负责接入与测试。

### 11.3 你现阶段最合理的环境分工

#### A. 在 Cursor / 本地环境里完成

- 建立项目目录
- 写 MCP server
- 定义 tools
- 写 schema
- 组织范例库
- 搭建轻量数据库
- 开发 UI 组件
- 管理 git

#### B. 在 ChatGPT 网页端完成

- 创建 / 编辑 GPT
- 打开 GPT 配置页面
- 启用 Apps 能力
- 连接你的 App / MCP server
- 在预览环境里测试实际对话效果
- 反复微调 instructions
- 检查工具调用是否合理

因此，并不是“只能手动进入 ChatGPT 页面操作”，而是：

> **开发主要在 Cursor，接入和最终测试必须回到 ChatGPT 网页。**

这才是最自然的工作流。

---

## 12. 我建议的具体开发环境

### 12.1 最推荐的基础组合

- **IDE**：Cursor
- **语言**：Node.js 或 Python 二选一
- **MCP server**：本地先跑，后续再部署到云端
- **数据存储**：SQLite / Postgres 均可
- **向量检索**：第一版可以先简化，甚至先用普通标签检索 + LLM rerank
- **前端**：React 即可
- **版本管理**：Git + GitHub

### 12.2 Node 还是 Python

如果你更想快速跟 Apps SDK 官方示例对齐，**Node.js 会更顺手**。  
如果你更想处理文档解析、文本清洗、embedding、后续训练实验，**Python 会更顺手**。

对于你这个项目，我的建议是：

- **MCP server：Node.js**
- **后续数据处理 / 实验脚本：Python**

但如果你现在只想尽快启动，完全可以统一用一种语言先做。

---

## 13. 现阶段最适合你的工作流

最推荐的是下面这条：

1. 在 Cursor 中建立项目仓库。
2. 先写 schemas 和假数据。
3. 再写 MCP tools 的输入输出定义。
4. 用少量真实 JD 和你自己的 master resume 做测试。
5. 把顶校范例拆成 exemplar 数据。
6. 在 ChatGPT 网页端连接 App 并测试真实交互。
7. 观察生成质量，再决定是否要补评分器、检索器或 LoRA。

所以你现在并不需要二选一：

- 不是“只能用 Cursor”
- 也不是“只能手动进 ChatGPT 页面”

而是两者分工明确：

> **Cursor 是开发环境，ChatGPT 网页是运行与测试环境。**

---

## 14. 现阶段的最终判断

你这套 Resume Builder 的正确起点不是 LoRA，而是：

**schema first → modules second → retrieval third → style layer fourth → training last**

其中最核心的产品能力是：

- 把 JD 结构化
- 把你的经历模块化
- 用统一 taxonomy 做匹配
- 用 exemplar retrieval 做表达优化
- 用 critique 做最终把关

在开发环境上，最佳实践是：

- **用 Cursor 写代码、搭服务、管项目**
- **用 ChatGPT 网页接入 GPT / App 并进行真实测试**

这是当前阶段最省成本、最符合你目标、也最容易跑通的一条路线。

---

## 15. 官方边界与实现提示（整理版）

以下是与你当前方案直接相关的官方边界，便于后续实现时对照：

1. **ChatGPT Apps 的标准开发路径是 MCP server + 可选 UI 组件。**
2. **Apps SDK 官方 quickstart 支持使用 Node 或 Python 来构建 MCP server。**
3. **ChatGPT 中的 UI 可以通过 Apps SDK 渲染，且支持在组件中上传文件。**
4. **Knowledge 更适合放参考材料，不适合放规则和行为；规则应写入 instructions。**
5. **一个 GPT 不能同时使用 apps 和 actions。**
6. **创建和编辑 GPT 主要在 ChatGPT 网页端完成，而不是移动端。**
7. **Cursor 可连接 MCP servers，因此很适合作为你的开发 IDE，但它不是 ChatGPT App 的最终运行宿主。**

---

## 16. 下一步最值得做的事

如果继续推进，下一步最有价值的不是再讨论概念，而是直接产出三份东西：

1. `JD schema.json`
2. `resume_module schema.json`
3. `MCP tools contract.md`

有了这三份，你就可以正式开工了。
