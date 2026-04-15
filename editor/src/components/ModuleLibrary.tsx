import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  fetchModules, deleteModuleApi, deleteBulletApi,
  patchModuleApi, patchBulletApi, addModuleApi, addBulletApi,
  type ResumeModule, type ModuleBullet,
} from "../api";

// ============================================================
// Color palette — Bloodshed Dev-C++ classic (customised)
// ============================================================
const C = {
  bg: "#FFFFFF",
  toolbar: "#ECE9D8",
  card: "#FFFFFF",
  text: "#000000",
  muted: "#808080",
  keyword: "#091D26",   // was #000080
  string: "#091D26",    // was #CC0000
  comment: "#094044",   // was #008000
  number: "#715B65",    // was #800080
  preproc: "#D84F2A",   // was #0000CC
  border: "#ACA899",
  inputBorder: "#7F9DB9",
  inputFocus: "#316AC5",
  hover: "#EBF0F8",
  actionBg: "#F4F3EE",
  actionHover: "#E2E0D8",
  actionBorder: "#ACA899",
  danger: "#CC0000",
};

const FONT = '"Times New Roman", "FandolSong", "SimSun", "Songti SC", serif';

// ============================================================
// Section config
// ============================================================
const SECTION_ORDER = ["education", "experience", "projects", "leadership", "awards", "skills"] as const;
const SECTION_LABELS: Record<string, string> = {
  education: "教育背景",
  experience: "实习经历",
  projects: "项目经历",
  leadership: "校园经历",
  awards: "竞赛经历",
  skills: "技能",
};

// ============================================================
// InlineEdit — click to edit, blur to save; cursor goes where clicked
// ============================================================
function InlineEdit({ value, onSave, style, placeholder, multiline }: {
  value: string;
  onSave: (v: string) => void;
  style?: CSSProperties;
  placeholder?: string;
  multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  const commit = () => {
    setEditing(false);
    const trimmed = text.trim();
    if (trimmed !== value) onSave(trimmed);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) commit();
    if (e.key === "Escape") { setText(value); setEditing(false); }
  };

  const baseInputStyle: CSSProperties = {
    fontFamily: FONT, fontSize: "inherit", color: "inherit", fontWeight: "inherit", fontStyle: "inherit",
    background: "#FFFFF0", border: `1px solid ${C.inputBorder}`, borderRadius: 4,
    padding: "1px 4px", outline: "none", width: "100%", boxSizing: "border-box",
    ...style,
  };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          autoFocus
          value={text} onChange={e => setText(e.target.value)}
          onBlur={commit} onKeyDown={onKey}
          style={{ ...baseInputStyle, resize: "vertical", minHeight: 40, lineHeight: 1.6 }}
          rows={2}
        />
      );
    }
    return (
      <input
        autoFocus
        value={text} onChange={e => setText(e.target.value)}
        onBlur={commit} onKeyDown={onKey}
        style={baseInputStyle}
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      style={{ cursor: "text", minWidth: 24, display: "inline-block", borderBottom: `1px dashed transparent`, ...style }}
      onMouseEnter={e => (e.currentTarget.style.borderBottomColor = C.inputBorder)}
      onMouseLeave={e => (e.currentTarget.style.borderBottomColor = "transparent")}
    >
      {value || <span style={{ color: C.muted, fontStyle: "italic" }}>{placeholder ?? "点击编辑"}</span>}
    </span>
  );
}

// ============================================================
// HoverReveal — smooth fade-in container triggered by mouse
// ============================================================
function HoverReveal({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const [vis, setVis] = useState(false);
  return (
    <div
      onMouseEnter={() => setVis(true)} onMouseLeave={() => setVis(false)}
      style={{ padding: "2px 0", ...style }}
    >
      <div style={{
        opacity: vis ? 1 : 0, maxHeight: vis ? 40 : 0, overflow: "hidden",
        transition: "opacity 0.25s ease, max-height 0.25s ease",
        pointerEvents: vis ? "all" : "none",
      }}>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// PairButtons — the +/- rounded-rect pair
// ============================================================
function PairButtons({ onAdd, onRemove }: { onAdd: () => void; onRemove: () => void }) {
  const btnBase: CSSProperties = {
    flex: 1, height: 28, border: `1px solid ${C.actionBorder}`, borderRadius: 8,
    background: C.actionBg, cursor: "pointer", fontSize: 18, fontFamily: FONT,
    color: C.text, display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s",
  };
  return (
    <div style={{ display: "flex", gap: 6, width: "100%" }}>
      <button style={btnBase} onClick={onAdd}
        onMouseEnter={e => (e.currentTarget.style.background = C.actionHover)}
        onMouseLeave={e => (e.currentTarget.style.background = C.actionBg)}
      >+</button>
      <button style={{ ...btnBase, color: C.danger }} onClick={onRemove}
        onMouseEnter={e => (e.currentTarget.style.background = C.actionHover)}
        onMouseLeave={e => (e.currentTarget.style.background = C.actionBg)}
      >−</button>
    </div>
  );
}

// ============================================================
// SingleButton
// ============================================================
function SingleButton({ label, onClick, style }: {
  label: string; onClick: () => void; style?: CSSProperties;
}) {
  const base: CSSProperties = {
    height: 28, border: `1px solid ${C.actionBorder}`, borderRadius: 8,
    background: C.actionBg, cursor: "pointer", fontSize: 18, fontFamily: FONT,
    color: C.text, display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s", ...style,
  };
  return (
    <button style={base} onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.background = C.actionHover)}
      onMouseLeave={e => (e.currentTarget.style.background = C.actionBg)}
    >{label}</button>
  );
}

// ============================================================
// BulletItem — with full-row drag ghost
// ============================================================
function BulletItem({ bullet, index, onSave, onDelete, onDragStart, onDragOver, onDrop }: {
  bullet: ModuleBullet;
  index: number;
  onSave: (raw_fact: string) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent, idx: number, el: HTMLElement) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDrop: (e: React.DragEvent, idx: number) => void;
}) {
  const [deleteVisible, setDeleteVisible] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={rowRef}
      style={{ display: "flex", alignItems: "flex-start", position: "relative", padding: "3px 0" }}
      onDragOver={e => { e.preventDefault(); onDragOver(e, index); }}
      onDrop={e => onDrop(e, index)}
    >
      <span style={{ color: C.preproc, marginRight: 8, marginTop: 2, flexShrink: 0, fontSize: 14 }}>•</span>
      <div style={{ flex: 1, fontSize: 14, color: C.text, lineHeight: 1.6 }}>
        <InlineEdit
          value={bullet.raw_fact}
          onSave={onSave}
          placeholder="点击输入经历内容"
          multiline
        />
      </div>

      {/* Drag handle — ≡, triggers full-row ghost */}
      <span
        draggable
        onDragStart={e => {
          if (rowRef.current) onDragStart(e, index, rowRef.current);
        }}
        style={{
          cursor: "grab", color: C.muted, fontSize: 16, userSelect: "none",
          padding: "2px 6px", lineHeight: 1, flexShrink: 0, alignSelf: "center",
        }}
        title="拖动排序"
      >≡</span>

      {/* Delete zone */}
      <div
        onMouseEnter={() => setDeleteVisible(true)}
        onMouseLeave={() => setDeleteVisible(false)}
        style={{ width: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{
          opacity: deleteVisible ? 1 : 0, transition: "opacity 0.2s ease",
          width: 26, height: 26, borderRadius: 8,
          border: `1px solid ${C.actionBorder}`, background: C.actionBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 16, color: C.danger,
          pointerEvents: deleteVisible ? "all" : "none",
        }} onClick={onDelete}>−</div>
      </div>
    </div>
  );
}

// ============================================================
// ModuleCard — one sub-module
// ============================================================
function ModuleCard({ mod, onUpdate, onDelete, onAddBullet, onDeleteBullet, onSaveBullet, onReorderBullets }: {
  mod: ResumeModule;
  onUpdate: (fields: Partial<ResumeModule>) => void;
  onDelete: () => void;
  onAddBullet: () => void;
  onDeleteBullet: (bulletId: string) => void;
  onSaveBullet: (bulletId: string, raw_fact: string) => void;
  onReorderBullets: (bullets: ModuleBullet[]) => void;
}) {
  const dragIdx = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, idx: number, el: HTMLElement) => {
    dragIdx.current = idx;
    // Use the whole bullet row as the drag ghost
    e.dataTransfer.setDragImage(el, el.offsetWidth / 2, el.offsetHeight / 2);
    e.dataTransfer.effectAllowed = "move";
  };
  const handleDragOver = (e: React.DragEvent, _idx: number) => { e.preventDefault(); };
  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    const from = dragIdx.current;
    if (from === null || from === idx) return;
    const reordered = [...mod.bullets];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(idx, 0, moved);
    onReorderBullets(reordered);
    dragIdx.current = null;
  };

  return (
    <div style={cardStyle}>
      {/* Sub-module header */}
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 4, padding: "8px 12px 4px", fontSize: 14 }}>
        <InlineEdit value={mod.organization} onSave={v => onUpdate({ organization: v })}
          style={{ fontWeight: 700, color: C.string }} placeholder="机构名称" />
        <span style={{ color: C.muted }}>|</span>
        <InlineEdit value={mod.title} onSave={v => onUpdate({ title: v })}
          style={{ color: C.comment }} placeholder="职位 / 角色" />
        <span style={{ color: C.muted }}>|</span>
        <InlineEdit value={mod.location ?? ""} onSave={v => onUpdate({ location: v || undefined })}
          style={{ color: C.number }} placeholder="城市，国家" />
        <div style={{ flex: 1 }} />
        <InlineEdit value={mod.date_range} onSave={v => onUpdate({ date_range: v })}
          style={{ color: C.muted, fontSize: 12, textAlign: "right" }} placeholder="时间范围" />
      </div>

      {/* Tags */}
      {(mod.context_tags ?? []).length > 0 && (
        <div style={{ padding: "0 12px 6px", display: "flex", flexWrap: "wrap", gap: 4 }}>
          {mod.context_tags.map((t, i) => (
            <span key={i} style={tagStyle}>{t}</span>
          ))}
        </div>
      )}

      {/* Bullets */}
      <div style={{ padding: "0 12px 4px" }}>
        {mod.bullets.map((b, i) => (
          <BulletItem
            key={b.bullet_id} bullet={b} index={i}
            onSave={raw => onSaveBullet(b.bullet_id, raw)}
            onDelete={() => onDeleteBullet(b.bullet_id)}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          />
        ))}

        {/* Hover: + add bullet */}
        <HoverReveal>
          <SingleButton label="+" onClick={onAddBullet} style={{ width: "100%", height: 26, fontSize: 16 }} />
        </HoverReveal>
      </div>

      {/* Hover: +/- sub-module */}
      <HoverReveal style={{ padding: "0 12px 4px" }}>
        <PairButtons onAdd={() => {}} onRemove={onDelete} />
      </HoverReveal>
    </div>
  );
}

// ============================================================
// SectionPicker
// ============================================================
function SectionPicker({ existingSections, onPick, onClose }: {
  existingSections: Set<string>;
  onPick: (section: string) => void;
  onClose: () => void;
}) {
  const available = SECTION_ORDER.filter(s => !existingSections.has(s));
  if (available.length === 0) return (
    <div style={{ padding: 8, fontSize: 13, color: C.muted, fontFamily: FONT }}>
      所有分类均已使用。
      <button onClick={onClose} style={{ marginLeft: 8, cursor: "pointer" }}>关闭</button>
    </div>
  );
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
      padding: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", fontFamily: FONT,
    }}>
      {available.map(s => (
        <div key={s} onClick={() => { onPick(s); onClose(); }}
          style={{ padding: "4px 12px", cursor: "pointer", fontSize: 13, borderRadius: 4 }}
          onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
          onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
        >
          {SECTION_LABELS[s]}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// ModuleLibrary — main page
// ============================================================
export function ModuleLibrary({ onBack }: { onBack: () => void }) {
  const [modules, setModules] = useState<ResumeModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showSectionPicker, setShowSectionPicker] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setModules(await fetchModules());
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const existingSections = new Set(modules.map(m => m.section));

  const grouped = SECTION_ORDER
    .map(sec => ({ section: sec, label: SECTION_LABELS[sec], items: modules.filter(m => m.section === sec) }))
    .filter(g => g.items.length > 0)
    .filter(g => filter === "all" || g.section === filter);

  // ---- Module CRUD ----
  const handleUpdateModule = async (mod: ResumeModule, fields: Partial<ResumeModule>) => {
    const updated = await patchModuleApi(mod.module_id, fields);
    setModules(prev => prev.map(m => m.module_id === mod.module_id ? { ...updated, bullets: m.bullets } : m));
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm("确认删除此子模块及其所有经历条目？")) return;
    await deleteModuleApi(id);
    setModules(prev => prev.filter(m => m.module_id !== id));
  };

  const handleAddModuleInSection = async (section: string) => {
    const newMod = await addModuleApi(section);
    setModules(prev => [...prev, newMod]);
  };

  const handleDeleteSection = async (section: string) => {
    const items = modules.filter(m => m.section === section);
    if (!confirm(`确认删除"${SECTION_LABELS[section]}"分类下全部 ${items.length} 个子模块？`)) return;
    for (const m of items) await deleteModuleApi(m.module_id);
    setModules(prev => prev.filter(m => m.section !== section));
  };

  const handleAddSection = async (section: string) => {
    const newMod = await addModuleApi(section);
    setModules(prev => [...prev, newMod]);
  };

  // ---- Bullet CRUD ----
  const handleSaveBullet = async (moduleId: string, bulletId: string, raw_fact: string) => {
    const updated = await patchBulletApi(moduleId, bulletId, { raw_fact });
    setModules(prev => prev.map(m =>
      m.module_id === moduleId
        ? { ...m, bullets: m.bullets.map(b => b.bullet_id === bulletId ? { ...b, ...updated } : b) }
        : m
    ));
  };

  const handleDeleteBullet = async (moduleId: string, bulletId: string) => {
    await deleteBulletApi(moduleId, bulletId);
    setModules(prev => prev.map(m =>
      m.module_id === moduleId
        ? { ...m, bullets: m.bullets.filter(b => b.bullet_id !== bulletId) }
        : m
    ));
  };

  const handleAddBullet = async (moduleId: string) => {
    const newBullet = await addBulletApi(moduleId);
    setModules(prev => prev.map(m =>
      m.module_id === moduleId ? { ...m, bullets: [...m.bullets, newBullet] } : m
    ));
  };

  const handleReorderBullets = (moduleId: string, bullets: ModuleBullet[]) => {
    setModules(prev => prev.map(m =>
      m.module_id === moduleId ? { ...m, bullets } : m
    ));
  };

  const totalBullets = modules.reduce((s, m) => s + m.bullets.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, fontFamily: FONT, color: C.text }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        {/* Title: 15px × 2 = 30px */}
        <span style={{ fontWeight: 700, fontSize: 30, color: C.keyword, marginRight: 12 }}>我的经历库</span>
        <span style={{ fontSize: 12, color: C.muted }}>
          {modules.length} 个子模块，{totalBullets} 条经历
        </span>
        <div style={{ flex: 1 }} />
        <select value={filter} onChange={e => setFilter(e.target.value)} style={selectStyle}>
          <option value="all">全部分类</option>
          {SECTION_ORDER.map(s => <option key={s} value={s}>{SECTION_LABELS[s]}</option>)}
        </select>
        <button style={toolBtnStyle} onClick={onBack}>返回编辑器</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 60px" }}>
        {loading ? (
          <p style={{ color: C.muted, padding: 24 }}>加载中...</p>
        ) : modules.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>暂无已存储的经历模块。</p>
            <p style={{ fontSize: 13 }}>在 GPT 中上传简历并存储模块后，即可在此管理。</p>
          </div>
        ) : (
          grouped.map(g => (
            /* Section outer rounded-rect container */
            <div key={g.section} style={sectionContainerStyle}>
              {/* Section header */}
              <div style={sectionHeaderStyle}>{g.label}</div>

              {/* Sub-modules */}
              {g.items.map((mod, modIdx) => (
                <div key={mod.module_id}>
                  <ModuleCard
                    mod={mod}
                    onUpdate={fields => handleUpdateModule(mod, fields)}
                    onDelete={() => handleDeleteModule(mod.module_id)}
                    onAddBullet={() => handleAddBullet(mod.module_id)}
                    onDeleteBullet={bid => handleDeleteBullet(mod.module_id, bid)}
                    onSaveBullet={(bid, raw) => handleSaveBullet(mod.module_id, bid, raw)}
                    onReorderBullets={bullets => handleReorderBullets(mod.module_id, bullets)}
                  />
                  {modIdx === g.items.length - 1 && (
                    <HoverReveal>
                      <PairButtons
                        onAdd={() => handleAddModuleInSection(g.section)}
                        onRemove={() => handleDeleteModule(mod.module_id)}
                      />
                    </HoverReveal>
                  )}
                </div>
              ))}

              {/* +/- section at bottom */}
              <HoverReveal>
                <div style={{ position: "relative" }}>
                  <PairButtons
                    onAdd={() => setShowSectionPicker(true)}
                    onRemove={() => handleDeleteSection(g.section)}
                  />
                  {showSectionPicker && (
                    <div style={{ position: "absolute", bottom: 32, left: 0, zIndex: 50 }}>
                      <SectionPicker
                        existingSections={existingSections}
                        onPick={handleAddSection}
                        onClose={() => setShowSectionPicker(false)}
                      />
                    </div>
                  )}
                </div>
              </HoverReveal>
            </div>
          ))
        )}

        {!loading && modules.length === 0 && (
          <div style={{ marginTop: 20, position: "relative" }}>
            <SingleButton label="+ 添加分类" onClick={() => setShowSectionPicker(true)} style={{ width: "100%" }} />
            {showSectionPicker && (
              <div style={{ position: "absolute", top: 36, left: 0, zIndex: 50 }}>
                <SectionPicker
                  existingSections={existingSections}
                  onPick={handleAddSection}
                  onClose={() => setShowSectionPicker(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Styles
// ============================================================
const toolbarStyle: CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "8px 16px",
  background: C.toolbar, borderBottom: `1px solid ${C.border}`,
  fontFamily: FONT, flexShrink: 0,
};

const selectStyle: CSSProperties = {
  padding: "4px 8px", borderRadius: 4, border: `1px solid ${C.border}`,
  background: C.card, fontFamily: FONT, fontSize: 12, color: C.text,
};

const toolBtnStyle: CSSProperties = {
  padding: "4px 12px", border: `1px solid ${C.border}`, borderRadius: 4,
  background: C.toolbar, cursor: "pointer", fontFamily: FONT, fontSize: 12,
  color: C.keyword, fontWeight: 600,
};

const sectionContainerStyle: CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 8,
  padding: "8px 12px 4px", marginBottom: 16,
  background: "#FAFAF8",
};

const sectionHeaderStyle: CSSProperties = {
  fontSize: 13, fontWeight: 700, color: C.keyword, letterSpacing: "0.08em",
  padding: "4px 0 6px", borderBottom: `1px solid ${C.border}`, marginBottom: 8,
  fontFamily: FONT,
};

const cardStyle: CSSProperties = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
  marginBottom: 6, fontFamily: FONT,
};

const tagStyle: CSSProperties = {
  fontSize: 11, padding: "1px 6px", borderRadius: 4,
  background: "#F0F0F0", color: C.preproc, border: `1px solid ${C.border}`,
  fontFamily: FONT,
};
