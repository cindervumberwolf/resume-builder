import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import {
  fetchModules, deleteModuleApi, deleteBulletApi,
  patchModuleApi, patchBulletApi, addModuleApi, addBulletApi,
  type ResumeModule, type ModuleBullet,
} from "../api";

// ============================================================
// Color palette — Bloodshed Dev-C++ classic
// ============================================================
const C = {
  bg: "#FFFFFF",
  toolbar: "#ECE9D8",
  card: "#FFFFFF",
  text: "#000000",
  muted: "#808080",
  keyword: "#000080",
  string: "#CC0000",
  comment: "#008000",
  number: "#800080",
  preproc: "#0000CC",
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
  education: "EDUCATION / 教育背景",
  experience: "EXPERIENCE / 实习经历",
  projects: "PROJECTS / 项目经历",
  leadership: "LEADERSHIP / 校园经历",
  awards: "AWARDS / 竞赛经历",
  skills: "SKILLS / 技能",
};

// ============================================================
// InlineEdit — click to edit, blur to save
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
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => { setText(value); }, [value]);
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select(); } }, [editing]);

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
    background: "#FFFFF0", border: `1px solid ${C.inputBorder}`, borderRadius: 2,
    padding: "1px 4px", outline: "none", width: "100%", boxSizing: "border-box",
    ...style,
  };

  if (editing) {
    if (multiline) {
      return (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          value={text} onChange={e => setText(e.target.value)}
          onBlur={commit} onKeyDown={onKey}
          style={{ ...baseInputStyle, resize: "vertical", minHeight: 40, lineHeight: 1.6 }}
          rows={2}
        />
      );
    }
    return (
      <input
        ref={ref as React.RefObject<HTMLInputElement>}
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
      {value || <span style={{ color: C.muted, fontStyle: "italic" }}>{placeholder ?? "click to edit"}</span>}
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
// PairButtons — the +/- rounded-rect pair used for sections & modules
// ============================================================
function PairButtons({ onAdd, onRemove, width }: { onAdd: () => void; onRemove: () => void; width?: string | number }) {
  const btnBase: CSSProperties = {
    flex: 1, height: 28, border: `1px solid ${C.actionBorder}`, borderRadius: 4,
    background: C.actionBg, cursor: "pointer", fontSize: 18, fontFamily: FONT,
    color: C.text, display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s",
  };
  return (
    <div style={{ display: "flex", gap: 6, width: width ?? "100%" }}>
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
// SingleButton — a single +  or − action button
// ============================================================
function SingleButton({ label, onClick, danger, style }: {
  label: string; onClick: () => void; danger?: boolean; style?: CSSProperties;
}) {
  const base: CSSProperties = {
    height: 28, border: `1px solid ${C.actionBorder}`, borderRadius: 4,
    background: C.actionBg, cursor: "pointer", fontSize: 18, fontFamily: FONT,
    color: danger ? C.danger : C.text,
    display: "flex", alignItems: "center", justifyContent: "center",
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
// DragHandle — ≡ three-line handle for bullet reorder
// ============================================================
function DragHandle({ onDragStart }: { onDragStart: (e: React.DragEvent) => void }) {
  return (
    <span
      draggable
      onDragStart={onDragStart}
      style={{
        cursor: "grab", color: C.muted, fontSize: 16, userSelect: "none",
        padding: "0 4px", lineHeight: 1, flexShrink: 0,
      }}
      title="Drag to reorder"
    >≡</span>
  );
}

// ============================================================
// BulletItem
// ============================================================
function BulletItem({ bullet, moduleId, index, onSave, onDelete, onDragStart, onDragOver, onDrop }: {
  bullet: ModuleBullet;
  moduleId: string;
  index: number;
  onSave: (raw_fact: string) => void;
  onDelete: () => void;
  onDragStart: (e: React.DragEvent, idx: number) => void;
  onDragOver: (e: React.DragEvent, idx: number) => void;
  onDrop: (e: React.DragEvent, idx: number) => void;
}) {
  const [deleteVisible, setDeleteVisible] = useState(false);

  return (
    <div
      style={{ display: "flex", alignItems: "flex-start", position: "relative", padding: "3px 0" }}
      onDragOver={e => { e.preventDefault(); onDragOver(e, index); }}
      onDrop={e => onDrop(e, index)}
    >
      <span style={{ color: C.keyword, marginRight: 8, marginTop: 2, flexShrink: 0, fontSize: 14 }}>•</span>
      <div style={{ flex: 1, fontSize: 14, color: C.text, lineHeight: 1.6 }}>
        <InlineEdit
          value={bullet.raw_fact}
          onSave={onSave}
          placeholder="Click to type bullet text"
          multiline
        />
      </div>
      <DragHandle onDragStart={e => onDragStart(e, index)} />
      {/* Delete zone: invisible area to the right of the bullet */}
      <div
        onMouseEnter={() => setDeleteVisible(true)}
        onMouseLeave={() => setDeleteVisible(false)}
        style={{ width: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div style={{
          opacity: deleteVisible ? 1 : 0, transition: "opacity 0.2s ease",
          width: 24, height: 24, borderRadius: 4,
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
// ModuleCard — one sub-module with header, tags, bullets
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
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  const handleDragStart = (_e: React.DragEvent, idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (_e: React.DragEvent, idx: number) => { setDropTarget(idx); };
  const handleDrop = (_e: React.DragEvent, idx: number) => {
    const from = dragIdx.current;
    if (from === null || from === idx) { setDropTarget(null); return; }
    const reordered = [...mod.bullets];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(idx, 0, moved);
    onReorderBullets(reordered);
    dragIdx.current = null;
    setDropTarget(null);
  };

  return (
    <div style={cardStyle}>
      {/* Module header: org | title | location | date_range */}
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 4, padding: "8px 12px 4px", fontSize: 14 }}>
        <InlineEdit value={mod.organization} onSave={v => onUpdate({ organization: v })}
          style={{ fontWeight: 700, color: C.string }} placeholder="Organization" />
        <span style={{ color: C.muted }}>|</span>
        <InlineEdit value={mod.title} onSave={v => onUpdate({ title: v })}
          style={{ color: C.comment }} placeholder="Title / Role" />
        <span style={{ color: C.muted }}>|</span>
        <InlineEdit value={mod.location ?? ""} onSave={v => onUpdate({ location: v || undefined })}
          style={{ color: C.number }} placeholder="City, Country" />
        <div style={{ flex: 1 }} />
        <InlineEdit value={mod.date_range} onSave={v => onUpdate({ date_range: v })}
          style={{ color: C.muted, fontSize: 12, textAlign: "right" }} placeholder="Date range" />
      </div>

      {/* Tags */}
      <div style={{ padding: "0 12px 6px", display: "flex", flexWrap: "wrap", gap: 4 }}>
        {(mod.context_tags ?? []).map((t, i) => (
          <span key={i} style={tagStyle}>{t}</span>
        ))}
      </div>

      {/* Bullets */}
      <div style={{ padding: "0 12px 4px" }}>
        {mod.bullets.map((b, i) => (
          <BulletItem
            key={b.bullet_id} bullet={b} moduleId={mod.module_id} index={i}
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

      {/* Hover: +/- module at bottom */}
      <HoverReveal style={{ padding: "0 12px 4px" }}>
        <PairButtons onAdd={() => {}} onRemove={onDelete} />
      </HoverReveal>
    </div>
  );
}

// ============================================================
// SectionPicker — dropdown to pick a new section type
// ============================================================
function SectionPicker({ existingSections, onPick, onClose }: {
  existingSections: Set<string>;
  onPick: (section: string) => void;
  onClose: () => void;
}) {
  const available = SECTION_ORDER.filter(s => !existingSections.has(s));
  if (available.length === 0) return (
    <div style={{ padding: 8, fontSize: 13, color: C.muted, fontFamily: FONT }}>
      All section types are in use.
      <button onClick={onClose} style={{ marginLeft: 8, cursor: "pointer" }}>Close</button>
    </div>
  );
  return (
    <div style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 4,
      padding: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", fontFamily: FONT,
    }}>
      {available.map(s => (
        <div key={s} onClick={() => { onPick(s); onClose(); }}
          style={{ padding: "4px 12px", cursor: "pointer", fontSize: 13, borderRadius: 2 }}
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
    if (!confirm("Delete this module and all its bullets?")) return;
    await deleteModuleApi(id);
    setModules(prev => prev.filter(m => m.module_id !== id));
  };

  const handleAddModuleInSection = async (section: string) => {
    const newMod = await addModuleApi(section);
    setModules(prev => [...prev, newMod]);
  };

  const handleDeleteSection = async (section: string) => {
    const items = modules.filter(m => m.section === section);
    if (!confirm(`Delete all ${items.length} module(s) in "${SECTION_LABELS[section]}"?`)) return;
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
        <span style={{ fontWeight: 700, fontSize: 15, color: C.keyword, marginRight: 12 }}>Module Library</span>
        <span style={{ fontSize: 12, color: C.muted }}>
          {modules.length} modules, {totalBullets} bullets
        </span>
        <div style={{ flex: 1 }} />
        <select value={filter} onChange={e => setFilter(e.target.value)} style={selectStyle}>
          <option value="all">All Sections</option>
          {SECTION_ORDER.map(s => <option key={s} value={s}>{SECTION_LABELS[s]}</option>)}
        </select>
        <button style={toolBtnStyle} onClick={onBack}>Back to Editor</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 60px" }}>
        {loading ? (
          <p style={{ color: C.muted, padding: 24 }}>Loading modules...</p>
        ) : modules.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>No modules stored yet.</p>
            <p style={{ fontSize: 13 }}>Use the GPT to upload your resume and store modules.</p>
          </div>
        ) : (
          grouped.map(g => (
            <div key={g.section} style={{ marginBottom: 20 }}>
              {/* Section header */}
              <div style={sectionHeaderStyle}>{g.label}</div>

              {/* Modules */}
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
                  {/* +/- module: only on last module to avoid clutter */}
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

        {/* If no sections at all, show add section */}
        {!loading && modules.length === 0 && (
          <div style={{ marginTop: 20, position: "relative" }}>
            <SingleButton label="+ Add Section" onClick={() => setShowSectionPicker(true)} style={{ width: "100%" }} />
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
  padding: "4px 8px", borderRadius: 2, border: `1px solid ${C.border}`,
  background: C.card, fontFamily: FONT, fontSize: 12, color: C.text,
};

const toolBtnStyle: CSSProperties = {
  padding: "4px 12px", border: `1px solid ${C.border}`, borderRadius: 2,
  background: C.toolbar, cursor: "pointer", fontFamily: FONT, fontSize: 12,
  color: C.keyword, fontWeight: 600,
};

const sectionHeaderStyle: CSSProperties = {
  fontSize: 13, fontWeight: 700, color: C.keyword, letterSpacing: "0.08em",
  padding: "8px 0 4px", borderBottom: `1px solid ${C.border}`, marginBottom: 6,
  fontFamily: FONT,
};

const cardStyle: CSSProperties = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 2,
  marginBottom: 4, fontFamily: FONT,
};

const tagStyle: CSSProperties = {
  fontSize: 11, padding: "1px 6px", borderRadius: 2,
  background: "#F0F0F0", color: C.preproc, border: `1px solid ${C.border}`,
  fontFamily: FONT,
};
