// English resume template (XeLaTeX, A4)
export const LATEX_TEMPLATE = `\\documentclass[10pt,a4paper]{article}

% ---------- Packages ----------
\\usepackage[margin=0.62in]{geometry}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{setspace}
\\usepackage{verbatim}
\\usepackage{xeCJK}
\\setCJKmainfont{Noto Sans CJK SC}  % DELETE this line when compiling locally (server-only font)
\\setCJKsansfont{Noto Sans CJK SC}  % DELETE this line when compiling locally (server-only font)
\\setCJKmonofont{Noto Sans CJK SC}  % DELETE this line when compiling locally (server-only font)

\\pagenumbering{gobble}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}
\\setstretch{1.2}

% ---------- Section formatting ----------
\\titleformat{\\section}{\\large}{}{0pt}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{6pt}{4pt}

% ---------- List formatting ----------
\\setlist[itemize]{leftmargin=*, noitemsep, topsep=0pt, partopsep=0pt}

% ---------- Custom commands ----------
\\newcommand{\\subheading}[4]{
    \\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r}
        \\textbf{#1} | \\textit{#3} #2 & \\textit{#4} \\\\
    \\end{tabular*}
}

\\begin{document}

\t% ---------- Header ----------
\t\\begin{center}
\t    {\\huge [Your Name]}\\\\
\t    \\vspace{0.26em}
\t    \\href{mailto:[your\\_email@example.com]}{[your\\_email@example.com]}
\t    \\hspace{6pt}|\\hspace{6pt}
\t    [Your Phone Number]
\t    \\hspace{6pt}|\\hspace{6pt}
\t    \\href{[Your Link]}{[Your Link]}
\t\\end{center}

\t% ---------- Education ----------
\t\\section*{Education}
\t\\textbf{[University Name]}
\t\\vspace{0.3em}

\t\\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r@{}}
\t\t[Major] \\;|\\; \\textit{GPA: XX/4.00} & \\textit{Expected Graduation: Month Year} \\\\
\t\t\\multicolumn{2}{@{}l@{}}{\\textit{Relevant Coursework: Course 1, Course 2}}
\t\\end{tabular*}
\t\\vspace{0.2em}

\t% ---------- Professional Experience ----------
\t\\section*{Professional Experience}
\t\\subheading{[Company Name]}{[City, Country]}{[Role, Department]}{[Month Year -- Month Year]}
\t\t\\begin{itemize}[leftmargin=2em]
\t\t    \\item %bullet
\t\t    \\item %bullet
\t\t\\end{itemize}
\t\\vspace{1em}

\t% ---------- Project Experience ----------
\t\\section*{Project Experience}
\t\\subheading{[Project Name]}{}{[Your Role]}{[Month Year -- Month Year]}
\t\t\\begin{itemize}[leftmargin=2em]
\t\t    \\item %bullet
\t\t    \\item %bullet
\t\t\\end{itemize}
\t\\vspace{0.5em}

\t% ---------- Activities ----------
\t\\section*{Activities}
\t\\subheading{[Activity / Organization Name]}{}{[Your Role]}{[Month Year -- Month Year]}
\t\t\\begin{itemize}[leftmargin=2em]
\t\t    \\item %bullet
\t\t\\end{itemize}
\t\\vspace{0.5em}

\t% ---------- Skills ----------
\t\\section*{Skills}
\t\\textbf{Research \\& Analysis:} [Skill 1], [Skill 2], [Skill 3]\\\\[0.3em]
\t\\textbf{Tools \\& Programming:} [Tool 1]; [Tool 2]; [Tool 3]\\\\[0.3em]
\t\\textbf{Languages:} [Language 1]; [Language 2]
\t\\vspace{0.5em}

\\end{document}`;

// Chinese resume template (XeLaTeX, A4)
export const LATEX_TEMPLATE_ZH = `\\documentclass[10pt,a4paper]{article}

% ---------- Packages ----------
\\usepackage[margin=0.62in]{geometry}
\\usepackage[hidelinks]{hyperref}
\\usepackage{enumitem}
\\usepackage{titlesec}
\\usepackage{setspace}
\\usepackage{verbatim}
\\usepackage{xeCJK}
\\setCJKmainfont{FandolSong}
\\setCJKsansfont{FandolHei}
\\setCJKmonofont{FandolFang}

\\pagenumbering{gobble}
\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0pt}
\\setstretch{1.2}

% ---------- Section formatting ----------
\\titleformat{\\section}{\\large}{}{0pt}{}[\\titlerule]
\\titlespacing*{\\section}{0pt}{6pt}{4pt}

% ---------- List formatting ----------
\\setlist[itemize]{leftmargin=*, noitemsep, topsep=0pt, partopsep=0pt}

% ---------- Custom commands ----------
\\newcommand{\\subheading}[4]{
    \\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r}
        \\textbf{#1} | \\textit{#3} #2 & \\textit{#4} \\\\
    \\end{tabular*}
}

\\begin{document}

\t% ---------- Header ----------
\t\\begin{center}
\t    {\\huge [姓名]}\\\\
\t    \\vspace{0.26em}
\t    \\href{mailto:[邮箱]}{[邮箱]}
\t    \\hspace{6pt}|\\hspace{6pt}
\t    [电话]
\t    \\hspace{6pt}|\\hspace{6pt}
\t    \\href{[个人主页/LinkedIn]}{[个人主页/LinkedIn]}
\t\\end{center}

\t% ---------- 教育背景 ----------
\t\\section*{教育背景}
\t\\textbf{[学校名称]}
\t\\vspace{0.3em}

\t\\begin{tabular*}{\\textwidth}{@{}l@{\\extracolsep{\\fill}}r@{}}
\t\t[专业] \\;|\\; \\textit{均分：XX/100} & \\textit{预计 XXXX 年 X 月毕业} \\\\
\t\t\\multicolumn{2}{@{}l@{}}{\\textit{相关课程：课程一、课程二、课程三}}
\t\\end{tabular*}
\t\\vspace{0.2em}

\t% ---------- 实习经历 ----------
\t\\section*{实习经历}
\t\\subheading{[公司名称]}{[城市，国家]}{[职位，部门]}{[XXXX 年 X 月 -- XXXX 年 X 月]}
\t\t\\begin{itemize}[leftmargin=2em]
\t\t    \\item %工作内容 / 成果 / 影响
\t\t    \\item %工作内容 / 成果 / 影响
\t\t\\end{itemize}
\t\\vspace{1em}

\t% ---------- 项目经历 ----------
\t\\section*{项目经历}
\t\\subheading{[项目名称]}{}{[个人角色]}{[XXXX 年 X 月 -- XXXX 年 X 月]}
\t\t\\begin{itemize}[leftmargin=2em]
\t\t    \\item %项目内容 / 方法 / 结果
\t\t    \\item %项目内容 / 方法 / 结果
\t\t\\end{itemize}
\t\\vspace{0.5em}

\t% ---------- 竞赛经历 ----------
\t\\section*{竞赛经历}
\t\\subheading{[竞赛 / 活动名称]}{}{[个人角色]}{[XXXX 年 X 月]}
\t\t\\begin{itemize}[leftmargin=2em]
\t\t    \\item %参赛内容 / 成果 / 获奖
\t\t\\end{itemize}
\t\\vspace{0.5em}

\t% ---------- 技能 ----------
\t\\section*{技能}
\t\\textbf{研究与分析：}[技能一]、[技能二]、[技能三]\\\\[0.3em]
\t\\textbf{工具与编程：}[工具一]；[工具二]；[工具三]\\\\[0.3em]
\t\\textbf{语言：}[语言一]；[语言二]
\t\\vspace{0.5em}

\\end{document}`;
