# QS Top 30 官方 Resume 指导与 Template 数据获取项目说明（供 Cursor 实施）

## 1. 文档目的

这份文档不是产品 PRD，也不是功能设计文档，而是一份**面向数据获取工程的数据采集与落库实施说明**。

它服务于我们现有的 Resume Builder 总体架构，重点负责补齐其中的 `Exemplar Store / 顶校职业发展中心范例库` 这一层的数据基础设施。换言之，本项目的目标不是“生成简历”，而是**把后续可用于检索、对比、风格学习、模板调用的原始官方材料先系统性抓下来、整理好、打好标签并落库**。

本项目完成后，后续系统才有可能进行：

- resume guidance 检索
- resume template 检索
- exemplar bullet 提取
- 风格标签整理
- 针对岗位的表达优化
- 基于官方资料的约束式改写

---

## 2. 项目目标

### 2.1 核心目标

围绕 **QS Top 30 学校**，系统性收集其：

- 学校职业发展中心发布的 resume 写作指导
- 学院 / school / faculty / college / program 官方页面发布的 resume 写作指导
- 学校官方发布的 resume template
- 学校官方发布的 sample resume / resume examples
- 与 resume 直接相关的 checklist、action verbs、format guide、bullet writing guide

本阶段只做四件事：

1. **发现源**
2. **抓取原始数据**
3. **保存原始文件**
4. **建立结构化元数据索引**

### 2.2 非目标

本阶段**不做**以下事项：

- 不做内容总结
- 不做 bullet 抽取
- 不做风格归纳
- 不做模板美化
- 不做 LLM 改写
- 不做最终 RAG 接入
- 不做用户可见产品界面
- 不把不同学校资料混写成一份“最佳实践总结”

也就是说，当前任务是：**先把原始材料完整、可追溯、可过滤地收集下来。**

---

## 3. 项目范围

## 3.1 学校范围

学校范围由一个外部配置文件控制，不在代码里写死。

建议使用：

- `data/schools/schools_master.csv`

其中至少包含：

- `school_id`
- `school_name`
- `qs_rank`
- `qs_version`
- `official_main_domain`
- `country_or_region`
- `notes`

后续所有抓取流程都从这个主表出发。

### 3.2 来源范围

只收**官方来源**，优先级如下：

1. 学校中央职业发展中心 / career center / career services / career development office
2. 学校一级学院 / school / faculty / college 的职业发展页面
3. 学校下属项目办公室、就业办公室、学生事务办公室发布的 resume 资料
4. 学校官方资源库、官方 PDF、DOC、DOCX、模板下载页

### 3.3 不纳入的来源

以下来源默认不纳入主数据集：

- 第三方博客
- 学生个人博客
- Reddit / Quora / 论坛讨论
- 非学校官方的 consulting club / investment club / student club 页面
- 不可验证归属的 Google Drive / Dropbox / Box 文件
- 转载页
- 商业求职网站对学校建议的二次总结

如发现某些学生组织页面价值很高，可进入 `exceptions_log`，但默认**不进主库**。

---

## 4. 数据口径定义

## 4.1 主口径：Strict Resume Only

主数据集只纳入明确属于 `resume / résumé` 语义范围的内容。

纳入条件满足以下任一即可：

- 页面标题含 `resume` 或 `résumé`
- 文件标题含 `resume` 或 `résumé`
- 页面正文明确说明该资源用于 `resume writing`
- 模板文件明确标记为 `resume template`
- 样例明确标记为 `sample resume` / `resume example`

### 4.2 影子发现口径：Resume-Equivalent Review Queue

考虑到部分学校可能使用 `CV` 一词指代与美国 resume 接近的非学术求职文件，允许在发现阶段将此类资源放入**影子队列**，但不进入主数据集。

这类记录应打标：

- `term_used = cv`
- `functional_type = ambiguous_or_resume_equivalent`
- `in_primary_dataset = false`

这样做的原因是：

- 保持主库严格遵守“resume, not CV”
- 同时不完全错失国际学校中的潜在等价资源
- 后续可人工复核是否需要纳入二级库

### 4.3 只纳入与 resume 直接相关的材料

主库纳入以下类型：

- resume guide
- resume template
- sample resume
- resume checklist
- resume action verbs
- resume bullet writing guide
- resume formatting guide
- resume workbook（前提是其中有明确 resume 章节或模板）

以下内容只有在与 resume 直接绑定时才纳入：

- cover letter + resume 联合指南
- internship application guide 中的 resume 章节
- job search guide 中的 resume 模块

以下内容默认不纳入：

- cover letter only
- interview only
- LinkedIn only
- networking only
- salary / negotiation only
- general employability page 且没有 resume 实质内容

---

## 5. 输出物要求

本项目最终输出的不是一份报告，而是一套**可复用的数据资产**。

至少包括以下四层输出：

### 5.1 学校主表

文件示例：

- `data/schools/schools_master.csv`

作用：

- 作为抓取入口
- 记录学校基本信息与主域名
- 控制抓取范围

### 5.2 源清单（Source Inventory）

文件示例：

- `data/inventory/source_inventory.jsonl`

每条记录代表一个发现到的候选来源页，而不是最终文件。

作用：

- 记录“在哪个页面发现了 resume 相关资源”
- 支持后续追溯与补抓
- 区分候选源与最终资产

### 5.3 资产清单（Asset Manifest）

文件示例：

- `data/manifests/assets.jsonl`

每条记录代表一个最终保留的原始资产，例如：

- 一个 HTML 页面
- 一个 PDF
- 一个 DOCX 模板
- 一个 sample resume 文件

### 5.4 异常与缺口日志

文件示例：

- `data/logs/exceptions_log.jsonl`

记录以下情况：

- 页面需要登录
- 页面存在但无法下载
- 疑似官方但无法验证
- 仅发现 CV 语义资源
- 页面已失效
- 文件损坏
- 抽取文本失败
- 存在重复资源但无法自动判定主版本

---

## 6. 建议目录结构

```text
resume-data-acquisition/
├─ README.md
├─ config/
│  ├─ settings.yaml
│  ├─ query_templates.yaml
│  └─ source_rules.yaml
├─ data/
│  ├─ schools/
│  │  └─ schools_master.csv
│  ├─ inventory/
│  │  └─ source_inventory.jsonl
│  ├─ manifests/
│  │  ├─ assets.jsonl
│  │  └─ dedupe_index.jsonl
│  ├─ logs/
│  │  ├─ crawl_log.jsonl
│  │  ├─ exceptions_log.jsonl
│  │  └─ qa_log.jsonl
│  ├─ raw/
│  │  ├─ html/
│  │  ├─ pdf/
│  │  ├─ docx/
│  │  └─ other/
│  └─ text/
│     ├─ html_text/
│     ├─ pdf_text/
│     └─ docx_text/
├─ scripts/
│  ├─ init_project.py
│  ├─ discover_sources.py
│  ├─ crawl_school.py
│  ├─ normalize_assets.py
│  ├─ extract_text.py
│  ├─ dedupe_assets.py
│  ├─ qa_checks.py
│  └─ export_summary.py
├─ src/
│  ├─ discovery/
│  ├─ crawling/
│  ├─ extraction/
│  ├─ normalization/
│  ├─ storage/
│  ├─ qa/
│  └─ utils/
└─ tests/
```

---

## 7. 数据模型设计

## 7.1 `schools_master.csv`

建议字段：

| 字段 | 含义 |
|---|---|
| `school_id` | 学校唯一 ID |
| `school_name` | 学校标准名称 |
| `qs_rank` | QS 名次 |
| `qs_version` | QS 版本 |
| `official_main_domain` | 学校主域名 |
| `country_or_region` | 国家或地区 |
| `primary_language` | 主要语言 |
| `notes` | 备注 |

## 7.2 `source_inventory.jsonl`

每条记录表示一个“候选来源页”。

建议字段：

```json
{
  "source_id": "src_mit_0001",
  "school_id": "mit",
  "school_name": "Massachusetts Institute of Technology",
  "discovered_via": "search_engine|site_crawl|manual_seed",
  "seed_query": "site:example.edu resume template",
  "source_url": "https://...",
  "source_domain": "example.edu",
  "issuing_unit": "Career Advising and Professional Development",
  "source_level": "central_career|school|faculty|college|program|other",
  "page_title": "Resume Resources",
  "candidate_resource_types": ["resume_guide", "template", "sample_resume"],
  "officiality_score": 0.98,
  "public_access": "public|login_required|unclear",
  "status": "candidate|accepted|rejected|needs_review",
  "rejection_reason": null,
  "discovered_at": "2026-04-14T10:00:00Z"
}
```

## 7.3 `assets.jsonl`

每条记录表示一个最终保留的原始资产。

建议字段：

```json
{
  "asset_id": "asset_mit_0001",
  "source_id": "src_mit_0001",
  "school_id": "mit",
  "school_name": "Massachusetts Institute of Technology",
  "issuing_unit": "Career Advising and Professional Development",
  "source_level": "central_career",
  "document_title": "Sample Resumes",
  "document_type": "html_page|pdf|doc|docx|ppt|other",
  "resource_type": "resume_guide|resume_template|sample_resume|checklist|action_verbs|format_guide|mixed",
  "term_used": "resume|résumé|cv|mixed|unknown",
  "functional_type": "strict_resume|resume_equivalent_review|ambiguous",
  "target_audience": "all|undergraduate|masters|mba|phd|law|engineering|unknown",
  "language": "en",
  "public_access": "public|login_required|unclear",
  "canonical_url": "https://...",
  "download_url": "https://...",
  "file_ext": "html|pdf|docx",
  "mime_type": "application/pdf",
  "http_status": 200,
  "content_hash_sha256": "....",
  "raw_file_path": "data/raw/pdf/mit/....pdf",
  "extracted_text_path": "data/text/pdf_text/mit/....txt",
  "text_extraction_status": "success|failed|not_applicable",
  "in_primary_dataset": true,
  "needs_manual_review": false,
  "notes": null,
  "captured_at": "2026-04-14T10:00:00Z"
}
```

## 7.4 `exceptions_log.jsonl`

建议字段：

```json
{
  "exception_id": "exc_mit_0001",
  "school_id": "mit",
  "url": "https://...",
  "issue_type": "login_required|broken_link|ambiguous_cv|download_failed|parse_failed|officiality_unclear|duplicate_conflict",
  "severity": "low|medium|high",
  "description": "Resume tool page exists but downloadable template requires login.",
  "next_action": "manual_review|skip|retry|add_shadow_record",
  "created_at": "2026-04-14T10:00:00Z"
}
```

---

## 8. 发现与抓取策略

## 8.1 工作原则

采用“**先发现源，再抓资产**”的两阶段策略。

原因：

- 学校页面结构不统一
- 很多资源嵌套在 career page、school page、pdf link、download button 内
- 如果一开始直接粗暴爬附件，容易漏掉上下文与归属信息
- 后续需要追溯“这个文件是谁发的、在哪个页面发现的”

因此流程必须分为：

1. **发现候选来源页**
2. **从来源页中抽取最终资产链接**
3. **下载并记录元数据**
4. **抽取文本并去重**

## 8.2 来源发现策略

每所学校至少使用三类发现手段：

### A. 主域名定向搜索

示例逻辑：

- `site:{official_main_domain} resume`
- `site:{official_main_domain} "resume template"`
- `site:{official_main_domain} "sample resume"`
- `site:{official_main_domain} "resume guide"`
- `site:{official_main_domain} filetype:pdf resume`
- `site:{official_main_domain} careers resume`

### B. 职业中心域名搜索

如果学校职业中心在单独子域名，应追加：

- `site:{career_domain} resume`
- `site:{career_domain} "resume template"`
- `site:{career_domain} "sample resume"`

### C. 学院 / school / faculty 页面扩展发现

优先关注以下单位：

- Business School
- School of Engineering / Engineering Faculty
- Law School
- School of Public Policy / Public Affairs
- School of Medicine（仅在有通用求职资源时）
- Undergraduate career offices
- Graduate career offices
- MBA career offices

原因是这些单位更可能发布自己的 template 或 sample resume。

## 8.3 来源筛选逻辑

候选来源页满足以下条件之一即可进入 `source_inventory`：

- 页面标题出现 `resume`
- 页面正文高频出现 `resume`
- 页面含可下载的 `resume` 相关附件
- 页面是 official career resources page
- 页面为 resume workbook / resume toolkit / resume samples hub

被发现但不满足主条件的页面：

- 不直接丢弃
- 先做 `candidate` 或 `needs_review` 标记
- 由后续规则或人工二次筛选

---

## 9. 资产抽取规则

## 9.1 需要抓取的资产类型

从候选来源页中，抽取以下对象：

- HTML 正文页
- PDF 文件
- DOC / DOCX 文件
- 下载模板页
- 样例文件
- 内嵌的可公开访问模板链接

## 9.2 单页资源处理

如果一个页面本身就是完整的 resume guide：

- 保存 HTML 原文
- 保存清洗后的正文文本
- 生成一条 `asset` 记录

## 9.3 附件资源处理

如果页面链接到 PDF / DOCX：

- 下载原文件
- 记录来源页 URL 与附件 URL
- 保留文件名与 MIME 类型
- 生成一条独立 `asset` 记录
- 附上 `source_id`

同一来源页下可对应多条 `asset`。

## 9.4 多资源聚合页处理

如果某个页面是“Resume Resources Hub”，里面有：

- 1 个 guide 页面
- 3 个 sample resumes
- 1 个 template
- 1 个 action verbs PDF

则应：

- 该 hub 页面本身保留为一个 HTML 资产（若其正文有价值）
- 每个附件单独生成一条 `asset`
- 全部通过同一个 `source_id` 或多个子 source 关联

---

## 10. 命名规范

## 10.1 文件命名

建议格式：

```text
{school_id}__{issuing_unit_slug}__{resource_type}__{short_title}__{hash8}.{ext}
```

示例：

```text
mit__capd__sample_resume__undergraduate_resume__a1b2c3d4.pdf
```

### 10.2 路径规范

建议按文件类型 + 学校分目录：

```text
data/raw/pdf/mit/...
data/raw/html/mit/...
data/raw/docx/mit/...
data/text/pdf_text/mit/...
```

### 10.3 URL 标准化

对 URL 建议执行：

- 去除无关 tracking 参数
- 标准化大小写（在不破坏路径的前提下）
- 保留原始 URL 与 canonical URL 两个字段
- 如页面重定向，记录最终落地 URL

---

## 11. 去重策略

本项目必须做去重，否则会出现：

- 同一 PDF 被多个页面引用
- 同一资源换了不同 query parameter
- 页面内容完全重复但 URL 不同
- 下载页与直链文件双重入库

建议至少做三层去重：

### 11.1 URL 去重

同一个标准化后的 canonical URL 只保留一个主记录，其余作为引用关系记录。

### 11.2 文件内容去重

对所有下载文件计算 `sha256`。

若内容 hash 相同：

- 只保留一个主物理文件
- 在 manifest 中保留多个来源关系

### 11.3 文本近似去重

对 HTML 页可进一步做文本相似度检测。

用于处理：

- 学校不同学院复制同一份 resume guide
- 同一页面存在打印版与普通版

---

## 12. 文本抽取要求

本阶段虽然不做总结，但仍需把原始内容转成可后续处理的文本。

### 12.1 HTML

保留两份：

- 原始 HTML
- 清洗后的正文纯文本

### 12.2 PDF

保留两份：

- 原始 PDF
- 提取后的文本 `.txt`

如果 PDF 以图片为主、文本抽取失败：

- 记录 `text_extraction_status = failed`
- 写入 `exceptions_log`
- 暂不在本阶段强制 OCR

### 12.3 DOC / DOCX

保留两份：

- 原始文件
- 提取后的正文文本

### 12.4 不在本阶段做的事

- 不做 bullet 拆分
- 不做 section 识别
- 不做 action verb 归类
- 不做语言改写
- 不做模板版式还原

---

## 13. 质量控制与人工复核点

以下情况必须进入人工复核队列：

### 13.1 官方性不明确

例如：

- 页面在第三方平台
- 学校 logo 存在，但域名并非学校域名
- 文件下载到 Box / Drive，但页面归属不清

### 13.2 Resume / CV 语义不明确

例如：

- 页面标题只有 `CV`
- 页面正文出现 `resume` 与 `CV` 混用
- 无法判断是否为美式求职 resume 等价物

### 13.3 登录墙

例如：

- 页面公开，但文件下载需要登录
- 页面显示只有学生可见
- 学校工具页存在，但无法公开获取内容

### 13.4 资产损坏或文本失败

例如：

- PDF 下载失败
- 文件大小异常
- DOCX 损坏
- 文本抽取为空

---

## 14. 合规与边界

### 14.1 不绕过登录限制

对于登录墙资源：

- 只记录存在性
- 不尝试绕过认证
- 不模拟学生身份访问
- 不使用非公开 cookie、token 或缓存副本

### 14.2 尊重 robots 与站点负载

实现时应：

- 设置合理抓取间隔
- 限制并发
- 增加重试但不过度
- 对同一域名做速率限制
- 避免全站无差别爬取

### 14.3 保持可追溯

每个最终资产都必须能追溯到：

- 哪个学校
- 哪个官方单位
- 哪个来源页
- 哪个下载链接
- 何时抓取
- 何种方式发现

---

## 15. 在 Cursor 中的推荐实施方式

## 15.1 推荐语言

优先建议使用 **Python** 完成此数据获取项目。

原因：

- 更适合处理抓取、HTML 解析、PDF/DOCX 文本抽取
- 更适合后续做清洗与批处理
- 与后续数据工程、embedding、标签整理衔接自然

### 15.2 推荐模块划分

建议在 `src/` 下拆为：

- `discovery/`：来源发现
- `crawling/`：页面抓取与下载
- `extraction/`：文本抽取
- `normalization/`：字段标准化
- `storage/`：落盘与 manifest 写入
- `qa/`：去重、异常检测、人工复核导出
- `utils/`：通用工具函数

### 15.3 建议脚本职责

- `discover_sources.py`  
  根据学校主表和 query template 发现候选来源页，写入 `source_inventory.jsonl`

- `crawl_school.py`  
  针对单个学校抓取候选来源页与附件资源，写入 `assets.jsonl`

- `normalize_assets.py`  
  统一字段、修正类型、补全 canonical URL、打标签

- `extract_text.py`  
  对 HTML / PDF / DOCX 做文本提取

- `dedupe_assets.py`  
  基于 URL、hash、文本相似度进行去重

- `qa_checks.py`  
  生成异常列表与人工复核列表

---

## 16. 推荐执行流程

建议按如下顺序推进。

### 阶段 0：初始化

完成：

- 建 repo
- 建目录
- 建 schema
- 准备 `schools_master.csv`
- 准备 query templates

### 阶段 1：先跑 3 所学校做试点

目的：

- 验证 source discovery 是否有效
- 验证字段 schema 是否够用
- 验证命名和目录结构是否稳
- 验证学校页面结构的差异程度

这个阶段不要追求全量，只追求流程闭环。

### 阶段 2：扩到 10 所学校

目的：

- 检查职业中心与学院页的差异
- 观察 resume / CV 术语混用问题
- 观察登录墙出现频率
- 优化去重与异常日志结构

### 阶段 3：跑完整个 QS Top 30

要求：

- 每所学校都至少有 discovery 结果
- 每所学校都要输出是否存在公开 resume 资源的明确状态
- 所有公开可抓资源都要进入 manifest
- 所有无法抓取或歧义资源都要进入 exceptions log

### 阶段 4：做一次 QA 冻结版

输出：

- 稳定版 source inventory
- 稳定版 asset manifest
- 稳定版 exceptions log
- 去重后的 raw asset 目录
- 对后续解析工程友好的 text 目录

---

## 17. Definition of Done

只有当以下条件同时满足，才能认为本项目阶段性完成：

1. `schools_master.csv` 已建立且覆盖目标学校范围
2. 每所学校都已跑过来源发现流程
3. 所有候选来源页都已进入 `source_inventory`
4. 所有符合主口径的公开资产都已下载并写入 `assets.jsonl`
5. 所有登录墙 / 歧义 / 文件损坏 / 失败案例都已进入 `exceptions_log`
6. 原始文件与文本抽取文件均有稳定目录结构
7. 去重已完成，重复资源关系已被记录
8. 任一条 `asset` 记录都可追溯到学校、来源页、下载链接、抓取时间
9. 主库与影子队列严格分离
10. 项目可以按学校维度重跑，且不会破坏已有数据

---

## 18. 给 Cursor 的明确执行要求

下面这些是实现时必须坚持的工程约束。

### 18.1 不要一上来就做“全站爬虫”

先做：

- 学校主表
- 搜索式发现
- 候选来源页清单
- 来源页到资产的抽取

不要直接对整个学校域名做无差别深爬。

### 18.2 不要把“找页面”和“下文件”混成一步

必须先有 `source_inventory`，再做 `asset_manifest`。

### 18.3 不要只保存文本，不保存原文件

后续我们需要：

- 回看原版式
- 核实出处
- 提取模板
- 做精细解析

因此必须保留原始 HTML / PDF / DOCX。

### 18.4 不要把 CV 直接混进主库

发现可以记录，但默认进入影子队列。

### 18.5 不要在本阶段做总结或 LLM 生成

当前目标是 raw data acquisition，不是 knowledge distillation。

---

## 19. 后续与主产品的衔接方式

本项目完成后，数据将作为上游输入，供后续模块使用：

- `exemplar parser`：从官方资料中提取 bullet / sections / style blocks
- `style tagger`：为示例打岗位、语气、量化、句式标签
- `resume retriever`：按岗位类型和用户背景召回最相关示例
- `rewrite module`：在官方风格约束下改写用户 bullet
- `critique module`：引用官方 guidance 做合规检查和建议输出

因此，这个数据获取项目的成功标准不是“看起来抓了很多网页”，而是：

> 产出的原始数据足够干净、可追溯、可过滤、可扩展，能够被后续 Resume Builder 稳定调用。

---

## 20. 本文档一句话总结

这是一个**官方 resume 资料采集项目**，不是一个内容总结项目；  
目标是为 Resume Builder 的 exemplar layer 建立**严格、可追溯、结构化的原始数据底座**。
