# Resume/CV 资源发现规则优化方案（面向 Cursor 实施）

## 1. 文档目的

这份文档用于指导对当前两层筛选逻辑进行优化：

1. **规则配置层**：YAML 中的 inclusion / exclusion / shadow queue / resource types
2. **代码分类层**：`classify_url`、`classify_page_content`、`guess_issuing_unit`

目标是提升实际爬取中的两类核心指标：

- **召回率**：不要漏掉真正高价值的 resume/CV 资源
- **精确率**：尽量减少目录页、新闻页、活动页、组织页、就业报告等“噪声页”

---

## 2. 当前问题总结

### 2.1 Oxford 的问题：召回不足

实际现象：

- primary 数据集中只有少量真正有价值的页面
- 大量结果是：
  - Narrative CV 指导
  - MFE/MBA Employment Report
  - alumni Q&A
  - 其他间接相关页面
- 真正高质量的核心资源主要只有：
  - `CVs | Oxford University Careers Service`
  - CV 模板 DOCX

根因：

- Oxford 在职业服务语境中主要使用 **CV**，而不是 **resume**
- 当前规则把 `cv` 系统性放入 shadow queue
- 导致真正有价值的 Oxford 资源被整体降级
- 同时缺少对 `narrative cv` / `employment report` / `alumni Q&A` 这类页面的精准拦截

### 2.2 Stanford 的问题：精度不足

实际现象：

- 混入大量 SearchWorks 图书馆目录页
- 混入各种间接相关页面，如：
  - SNP 项目页
  - Black Staff Alliance
  - El Centro
- 真正高质量的资产只有少数几个：
  - BEAM 的 resume 页面
  - BioSci Careers 的 VMock 页面
  - 少数职业服务页面

根因：

- 当前规则中 `career` 作为 URL 弱关键词，放行范围过宽
- 只要同域、正文里稍微出现 `resume` 或 `career`，就容易进入候选集
- 缺少对 library / catalog / searchworks 这类强负样本的识别
- 缺少“必须是可执行简历资源”的门槛判断

---

## 3. 总体优化思路

建议将当前的“全局关键词 + 二元分类”升级为：

> **站点画像（source profile） + 强弱信号打分 + 资源门槛 + 负样本拦截**

也就是说，不再只依赖：

- 是否命中 `resume`
- 是否命中 `cv`
- URL 中是否有 `career`

而是综合判断：

1. 站点属于什么语境（Oxford 的 `cv` 是否应视作主词）
2. 页面是否来自职业服务核心单位
3. 页面是否真的是“可用的简历资源”
4. 页面是否带有明显负样本信号（图书馆目录、校友故事、活动、报告等）

---

## 4. 规则层（YAML）优化建议

### 4.1 不再把 `cv` 全局视为 shadow

当前逻辑大致是：

```yaml
resume -> primary
cv -> shadow
```

这对 Oxford 这类英国高校站点会造成系统性误判。

建议改成：

```yaml
resume -> primary
cv -> profile-dependent
```

也就是：

- 在 Oxford / UK career-service 语境中，`cv` 应视为 **resume-equivalent primary**
- 在一般美国站点中，`cv` 可以仍然保持 review / secondary
- 对 `academic cv` / `narrative cv` / `research cv` 单独降级

---

### 4.2 将 inclusion 信号拆成强信号和弱信号

当前 `career` 作为 URL 关键词太宽，会引入大量 Stanford 噪声页。

建议配置结构改为：

```yaml
inclusion_signals:
  strong_title_keywords:
    - "resume"
    - "résumé"
    - "resume guide"
    - "resume template"
    - "sample resume"
    - "action verbs"
    - "resume checklist"
    - "how to write a resume"
    - "cv guide"
    - "cv template"
    - "sample cv"
    - "how to write a cv"

  strong_body_keywords:
    - "resume template"
    - "sample resume"
    - "resume guide"
    - "resume writing"
    - "action verbs"
    - "resume checklist"
    - "resume format"
    - "bullet writing"
    - "cv template"
    - "sample cv"
    - "cv guide"
    - "cv writing"

  weak_url_keywords:
    - "resume"
    - "résumé"
    - "cv"
    - "career"
    - "careers"

  strong_download_keywords:
    - "download template"
    - "sample resume"
    - "sample cv"
    - "resume examples"
    - "cv examples"
    - "action verbs"
```

核心变化：

- `career` 只能算弱信号，不能单独支撑放行
- `template` / `guide` / `sample` / `action verbs` 等才是强资源信号

---

### 4.3 增强负样本规则

建议将当前 exclusion 扩展为更明确的 negative signals：

```yaml
negative_signals:
  url_keywords:
    - "/blog/"
    - "/news/"
    - "/events/"
    - "/event/"
    - "/podcast/"
    - "/stories/"
    - "/alumni/"
    - "/search?"
    - "/catalog/"
    - "reddit.com"
    - "quora.com"

  title_keywords:
    - "employment report"
    - "annual report"
    - "alumni q&a"
    - "student story"
    - "webinar"
    - "workshop"
    - "career fair"
    - "interview prep"
    - "salary negotiation"
    - "cover letter only"
    - "narrative cv"
    - "academic cv"

  body_keywords:
    - "searchworks"
    - "catalog record"
    - "call number"
    - "isbn"
    - "available at library"
    - "request from offsite"
    - "student story"
    - "alumni q&a"
    - "employment report"
```

这会显著改善 Stanford 的 library/campus noise 问题。

---

### 4.4 引入 source profiles（站点画像）

这是最关键的一步。

建议在 YAML 中引入站点级规则：

```yaml
source_profiles:
  ox.ac.uk:
    cv_as_primary: true
    preferred_hosts:
      - "careers.ox.ac.uk"
    preferred_units:
      - "careers service"
    demote_title_keywords:
      - "narrative cv"
      - "academic cv"
    reject_title_keywords:
      - "employment report"
      - "alumni q&a"
      - "podcast"
      - "career fair"

  stanford.edu:
    cv_as_primary: false
    preferred_hosts:
      - "beam.stanford.edu"
      - "careered.stanford.edu"
    preferred_units:
      - "beam"
      - "career education"
      - "biosci careers"
      - "career center"
    reject_hosts:
      - "searchworks.stanford.edu"
    reject_title_keywords:
      - "searchworks"
      - "catalog"
      - "employment report"
      - "student story"
      - "alumni q&a"
```

### 为什么这一步重要

因为 Oxford 和 Stanford 的站点生态差异很大：

- Oxford：`cv` 是职业服务主词
- Stanford：`career` 相关页面非常多，但真正有价值的简历资源集中在少数职业服务单元

如果没有 source profile，只靠全局关键词，规则很难既高召回又高精度。

---

### 4.5 扩展 resource_types

当前资源类型对 Stanford 的 VMock 这类工具页不够友好，对 Oxford 的 CV 页面也不够细。

建议扩展为：

```yaml
resource_types:
  - resume_guide
  - resume_template
  - sample_resume
  - checklist
  - action_verbs
  - format_guide
  - bullet_writing_guide
  - resume_workbook
  - resume_tool
  - cv_guide
  - cv_template
  - sample_cv
  - mixed
```

新增建议：

- `resume_tool`：例如 VMock、resume review platform
- `cv_guide`
- `cv_template`
- `sample_cv`

这样 Oxford 的高价值 CV 页面不会被模糊归类为普通 mixed。

---

## 5. Python 规则层优化建议

### 5.1 从“硬编码分流”改为“打分 + 分层判断”

当前逻辑的问题是：很多分支都是“命中即放行”或“命中即 shadow”。

更稳妥的做法是：

```text
总分 = 标题强信号 + 正文强信号 + 下载资源加分 + career unit 加分
     - catalog/library 扣分 - event/news/alumni/report 扣分 - academic/narrative cv 扣分
```

建议分层：

- `score >= 6` -> `primary`
- `score in [3,5]` -> `review` / `primary_equivalent`
- `score < 3` -> `reject`

---

### 5.2 优化 `classify_url`

#### 当前问题

当前代码：

```python
if "career" in url_lower:
    return "needs_review"
```

这会把大量 Stanford 的间接相关页面都放入候选集。

#### 建议做法

1. 引入强拒绝 URL 模式
2. 引入 source profile
3. `career` 仅作为弱信号
4. 使用打分，而不是直接放行

#### 建议参考实现

```python
URL_REJECT_PATTERNS = [
    "searchworks",
    "/search?",
    "/catalog/",
    "/blog/",
    "/news/",
    "/events/",
    "/podcast/",
    "/stories/",
    "reddit.com",
    "quora.com",
]

STRONG_URL_PATTERNS = re.compile(
    r"\b(resume|résumé|cv|curriculum-vitae|resume-template|cv-template|sample-resume|sample-cv)\b",
    re.IGNORECASE,
)

WEAK_URL_PATTERNS = re.compile(r"\b(career|careers)\b", re.IGNORECASE)


def classify_url(url: str, domain: str, profile: dict | None = None) -> str | None:
    url_lower = url.lower()

    if not is_same_domain(url, domain):
        return None

    if any(p in url_lower for p in URL_REJECT_PATTERNS):
        return None

    score = 0

    if profile:
        if any(h in url_lower for h in profile.get("reject_hosts", [])):
            return None
        if any(h in url_lower for h in profile.get("preferred_hosts", [])):
            score += 3

    if STRONG_URL_PATTERNS.search(url_lower):
        score += 3
    elif WEAK_URL_PATTERNS.search(url_lower):
        score += 1

    if score >= 4:
        return "accept"
    if score >= 2:
        return "needs_review"
    return None
```

---

### 5.3 优化 `classify_page_content`

#### 当前问题

当前 `classify_page_content` 存在几个明显问题：

1. 只要正文里提到了 `resume` / `cv`，就比较容易通过
2. `template` / `formatting` / `how to write` 等关键词匹配过宽
3. 缺少“这页是否真的是可用资源”的门槛

#### 建议新增概念：`has_actionable_resource`

页面不应因为“提到简历”就 accepted，而应该满足以下之一：

- 明确是 guide / template / sample / checklist / action verbs
- 明确提供下载模板 / 样例 / workbook
- 是职业服务单位发布的简历工具页（如 VMock）

#### 建议新增负样本模式

```python
CATALOG_PATTERNS = re.compile(
    r"\b(searchworks|catalog record|call number|isbn|available at library|request from offsite)\b",
    re.IGNORECASE,
)

INDIRECT_PATTERNS = re.compile(
    r"\b(employment report|annual report|alumni q&a|student story|webinar|workshop|career fair|podcast)\b",
    re.IGNORECASE,
)

ACADEMIC_CV_PATTERNS = re.compile(
    r"\b(academic cv|narrative cv|research cv|publication list)\b",
    re.IGNORECASE,
)
```

#### 建议收紧资源类型匹配

当前的：

```python
"resume_template": r"resume\s+template|template",
"resume_guide": r"resume\s+guide|resume\s+writing|how\s+to\s+write",
"format_guide": r"format\s+guide|formatting",
```

过宽。

应改为“近邻匹配”，要求 `template` / `guide` / `format` 必须贴近 `resume/cv`：

```python
TYPE_PATTERNS = {
    "resume_template": re.compile(
        r"(resume|résumé|cv).{0,30}(template|sample)|"
        r"(template|sample).{0,30}(resume|résumé|cv)",
        re.I,
    ),
    "resume_guide": re.compile(
        r"(resume|résumé|cv).{0,30}(guide|writing|how to write)|"
        r"(guide|writing).{0,30}(resume|résumé|cv)",
        re.I,
    ),
    "checklist": re.compile(
        r"(resume|résumé|cv).{0,30}checklist|"
        r"checklist.{0,30}(resume|résumé|cv)",
        re.I,
    ),
    "action_verbs": re.compile(r"action verbs?", re.I),
    "format_guide": re.compile(
        r"(resume|résumé|cv).{0,30}(format|formatting)|"
        r"(format|formatting).{0,30}(resume|résumé|cv)",
        re.I,
    ),
    "resume_tool": re.compile(r"(vmock|resume review tool|resume optimizer)", re.I),
}
```

#### 建议重构分类逻辑

```python
def classify_page_content(
    title: str,
    body_text: str,
    url: str = "",
    profile: dict | None = None,
) -> dict:
    text = f"{title or ''}\n{body_text or ''}"
    text_lower = text.lower()

    if CATALOG_PATTERNS.search(text_lower):
        return reject_record("catalog_like")

    if INDIRECT_PATTERNS.search(text_lower):
        return reject_record("indirect_career_content")

    has_resume = bool(RESUME_KEYWORDS.search(text_lower[:5000]))
    has_cv = bool(CV_KEYWORDS.search(text_lower[:5000]))
    has_actionable_resource = any(
        p.search(text_lower[:5000]) for p in TYPE_PATTERNS.values()
    )

    cv_as_primary = bool(profile and profile.get("cv_as_primary"))

    if ACADEMIC_CV_PATTERNS.search(text_lower):
        return {
            "status": "needs_review",
            "term_used": "cv",
            "functional_type": "academic_or_narrative_cv",
            "in_primary_dataset": False,
            "resource_types": ["mixed"],
            "resume_keyword_count": 0,
        }

    if has_resume and has_actionable_resource:
        return accepted_record(
            term_used="resume",
            in_primary=True,
            functional_type="strict_resume",
        )

    if has_cv and has_actionable_resource:
        return accepted_record(
            term_used="cv",
            in_primary=cv_as_primary,
            functional_type=(
                "resume_equivalent_primary"
                if cv_as_primary
                else "resume_equivalent_review"
            ),
        )

    if (has_resume or has_cv) and not has_actionable_resource:
        return needs_review_record("mention_only")

    return needs_review_record("ambiguous")
```

---

### 5.4 优化 `guess_issuing_unit`

#### 当前问题

当前 `guess_issuing_unit` 虽然尝试识别 `central_career` / `school` / `other`，但粒度还不够，无法为 Stanford 这类复杂生态提供足够约束。

#### 建议增加更细粒度的单位类型

建议至少区分：

- `central_career`
- `school_career`
- `library`
- `student_group`
- `alumni_or_story`
- `news_or_events`
- `other`

#### 建议参考实现

```python
def guess_issuing_unit(url: str) -> tuple[str | None, str]:
    url_lower = url.lower()

    if "careers.ox.ac.uk" in url_lower:
        return "Oxford Careers Service", "central_career"

    if "beam.stanford.edu" in url_lower or "careered.stanford.edu" in url_lower:
        return "Stanford BEAM", "central_career"

    if "searchworks.stanford.edu" in url_lower:
        return "Stanford SearchWorks", "library"

    if any(k in url_lower for k in ["alumni", "podcast", "stories"]):
        return None, "alumni_or_story"

    if any(k in url_lower for k in ["news", "events", "event"]):
        return None, "news_or_events"

    return None, "other"
```

#### 如何使用这个字段

建议在最终总分中体现：

- `central_career` -> 强正分
- `school_career` -> 中正分
- `library` -> 强负分
- `alumni_or_story` -> 强负分
- `news_or_events` -> 强负分

---

### 5.5 重构 shadow queue

当前 shadow queue 会把很多不同性质的页面混在一起，后续分析不方便。

建议改成 4 层结果：

- `primary`
- `primary_equivalent`
- `secondary_review`
- `reject`

#### 建议语义

- `primary`：明确是核心 resume 资源
- `primary_equivalent`：像 Oxford 的 `CVs`，虽然用词是 CV，但实际上等价于 resume 主资源
- `secondary_review`：如 narrative CV、academic CV、含少量简历相关内容但非核心资源
- `reject`：目录页、新闻页、活动页、报告、校友故事等

---

## 6. Oxford / Stanford 的预期效果

### 6.1 Oxford

优化后预期：

- `CVs | Oxford University Careers Service` -> `accepted + primary_equivalent`
- CV 模板 DOCX -> `accepted + primary_equivalent`
- `Narrative CV` -> `secondary_review` 或 `needs_review`
- MFE/MBA Employment Report -> `reject`
- alumni Q&A / podcast / event -> `reject`

#### 预期收益

- 真正有价值的 Oxford CV 资源不再被埋进 shadow
- Narrative CV 和就业报告噪声显著下降

---

### 6.2 Stanford

优化后预期：

- BEAM resume 页面 -> `accepted + primary`
- BioSci Careers 的 VMock / resume tool -> `accepted + primary` 或 `resume_tool`
- SearchWorks 图书馆目录页 -> `reject`
- Black Staff Alliance / El Centro / student-group 页面 -> `reject` 或 `needs_review`
- 普通 career 页面只有在出现 `resume guide/template/sample/action verbs` 等强资源信号时才进入 primary

#### 预期收益

- 大幅减少 Stanford 的间接相关页面污染
- 核心职业服务页面排名明显提升

---

## 7. 优先级最高的 5 个改动

建议按下面顺序实施：

### 1. 将 `cv` 从 shadow 改为 profile-dependent primary-equivalent

这是修复 Oxford 召回问题的第一优先级。

### 2. 引入 `source_profiles`

至少先为：

- `ox.ac.uk`
- `stanford.edu`

建立站点画像。

### 3. 增强负样本拦截

优先加入：

- `searchworks`
- `catalog`
- `employment report`
- `alumni q&a`
- `student story`
- `webinar`
- `podcast`

### 4. 收紧资源类型正则

重点修复：

- `template`
- `formatting`
- `how to write`

这些过宽匹配必须改成与 `resume/cv` 的近邻关系匹配。

### 5. 加入 `has_actionable_resource` 门槛

这是修复 Stanford 精度问题最关键的一步之一。

---

## 8. 推荐的实施顺序

### Phase 1：最小修复版

目标：快速提升 Oxford / Stanford 两站质量

实施项：

- 加 `source_profiles`
- 改 `cv_as_primary`
- 加强 negative signals
- 添加 SearchWorks 拦截
- 添加 `has_actionable_resource`

### Phase 2：分类体系升级

目标：让数据资产更可分析

实施项：

- `shadow_queue` 重构为四层状态
- `resource_types` 扩展
- `guess_issuing_unit` 细化

### Phase 3：打分系统替代硬判断

目标：提高系统整体鲁棒性

实施项：

- 为 URL / title / body / source unit 建立统一分数体系
- 设置阈值决定 primary / review / reject
- 对 Oxford、Stanford 单独回测调参

---

## 9. 建议补充的评估指标

为了验证优化是否有效，建议在每站回测中至少统计：

### 9.1 Precision@TopN

例如 Top 20 / Top 50 中：

- 真正核心简历资源占比是多少

### 9.2 Primary 质量

统计 primary 中：

- 职业服务核心资源占比
- 图书馆目录占比
- 活动/新闻/报告占比

### 9.3 CV 资源命中情况

特别针对 Oxford：

- 高价值 CV 资源是否进入 primary 或 primary_equivalent
- Narrative CV 是否被合理降级

### 9.4 Source unit 分布

统计：

- central_career
- school_career
- library
- alumni/story
- news/events

这样可以快速看出是否仍被 Stanford 生态污染。

---

## 10. 给 Cursor 的明确执行任务

建议让 Cursor 分三步改：

### 任务 1：改 YAML 配置

目标：

- 引入 `source_profiles`
- 拆分强弱 inclusion signals
- 扩展 negative signals
- 扩展 resource types

### 任务 2：重构 Python 分类逻辑

目标：

- `classify_url` 增加 profile 支持与打分逻辑
- `classify_page_content` 增加 `has_actionable_resource`
- 加入 catalog / indirect / academic CV 的负样本识别
- 让 `cv` 是否进 primary 依赖 profile，而不是全局固定

### 任务 3：加回测脚本或测试用例

目标：

- 使用 Oxford / Stanford 的真实抓取样本做 regression test
- 输出 primary / review / reject 的数量和代表页
- 对比修改前后的 top results 质量

---

## 11. 最终结论

这次问题的本质不是“关键词不够多”，而是：

- **Oxford 需要更强的语境适配**
- **Stanford 需要更强的噪声抑制**
- 当前纯全局规则不足以兼顾二者

因此最优解不是简单加几个关键词，而是升级为：

1. **站点画像**
2. **强弱信号打分**
3. **资源门槛判断**
4. **负样本拦截**
5. **更细的分类层次**

对 Oxford 来说，重点是：

- 把 `CV` 视为可能的 primary-equivalent

对 Stanford 来说，重点是：

- 把图书馆目录、学生组织、新闻活动、报告内容拦在外面

---

## 12. 推荐下一步

建议直接在 Cursor 中落地两份改动：

1. 一版新的 YAML 配置草案
2. 一版 Python patch / refactor 版本

然后用 Oxford 和 Stanford 的历史抓取样本做 A/B 回测。

如果后续还要扩展到 Cambridge、LSE、MIT、Harvard、Yale 等高校，这套“source profile + score-based filtering”的框架也更容易扩展。
