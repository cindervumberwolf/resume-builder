import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import logoUrl from "../assets/logo.png";
import {
  fetchModules, deleteModuleApi, deleteBulletApi,
  patchModuleApi, patchBulletApi, addModuleApi, addBulletApi,
  type ResumeModule, type ModuleBullet,
} from "../api";

// ============================================================
// Palette
// ============================================================
const C = {
  bg: "#FFFFFF",
  toolbar: "#F3F3F3",       // was ECE9D8
  card: "#FFFFFF",
  text: "#000000",
  muted: "#808080",
  keyword: "#091D26",
  string: "#091D26",
  comment: "#094044",
  number: "#715B65",
  preproc: "#D84F2A",
  border: "#ACA899",
  inputBorder: "#7F9DB9",
  hover: "#EBF0F8",
  actionBg: "#F4F3EE",
  actionHover: "#E2E0D8",
  actionBorder: "#ACA899",
  danger: "#CC0000",
  dragBorder: "#316AC5",
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
// InlineEdit
// ============================================================
function InlineEdit({ value, onSave, style, placeholder, multiline }: {
  value: string; onSave: (v: string) => void;
  style?: CSSProperties; placeholder?: string; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);

  const commit = () => {
    setEditing(false);
    const t = text.trim();
    if (t !== value) onSave(t);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !multiline) commit();
    if (e.key === "Escape") { setText(value); setEditing(false); }
  };
  const inputBase: CSSProperties = {
    fontFamily: FONT, fontSize: "inherit", color: "inherit",
    fontWeight: "inherit", fontStyle: "inherit",
    background: "#FFFFF0", border: `1px solid ${C.inputBorder}`,
    borderRadius: 4, padding: "1px 4px", outline: "none",
    width: "100%", boxSizing: "border-box", ...style,
  };

  if (editing) {
    return multiline
      ? <textarea autoFocus value={text} onChange={e => setText(e.target.value)}
          onBlur={commit} onKeyDown={onKey}
          style={{ ...inputBase, resize: "vertical", minHeight: 40, lineHeight: 1.6 }} rows={2} />
      : <input autoFocus value={text} onChange={e => setText(e.target.value)}
          onBlur={commit} onKeyDown={onKey} style={inputBase} />;
  }
  return (
    <span onClick={() => setEditing(true)}
      style={{ cursor: "text", minWidth: 24, display: "inline-block", borderBottom: "1px dashed transparent", ...style }}
      onMouseEnter={e => (e.currentTarget.style.borderBottomColor = C.inputBorder)}
      onMouseLeave={e => (e.currentTarget.style.borderBottomColor = "transparent")}
    >
      {value || <span style={{ color: C.muted, fontStyle: "italic" }}>{placeholder ?? "点击编辑"}</span>}
    </span>
  );
}

// ============================================================
// HoverReveal — 2-second linger before hiding
// ============================================================
function HoverReveal({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const [vis, setVis] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timer.current) clearTimeout(timer.current);
    setVis(true);
  };
  const scheduleHide = () => {
    timer.current = setTimeout(() => setVis(false), 2000);
  };

  return (
    <div onMouseEnter={show} onMouseLeave={scheduleHide} style={{ padding: "2px 0", ...style }}>
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
// PairButtons
// ============================================================
function PairButtons({ onAdd, onRemove }: { onAdd: () => void; onRemove: () => void }) {
  const base: CSSProperties = {
    flex: 1, height: 28, border: `1px solid ${C.actionBorder}`, borderRadius: 8,
    background: C.actionBg, cursor: "pointer", fontSize: 18, fontFamily: FONT,
    color: C.text, display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s",
  };
  return (
    <div style={{ display: "flex", gap: 6, width: "100%" }}>
      <button style={base} onClick={onAdd}
        onMouseEnter={e => (e.currentTarget.style.background = C.actionHover)}
        onMouseLeave={e => (e.currentTarget.style.background = C.actionBg)}>+</button>
      <button style={{ ...base, color: C.danger }} onClick={onRemove}
        onMouseEnter={e => (e.currentTarget.style.background = C.actionHover)}
        onMouseLeave={e => (e.currentTarget.style.background = C.actionBg)}>−</button>
    </div>
  );
}

function SingleButton({ label, onClick, style }: { label: string; onClick: () => void; style?: CSSProperties }) {
  const base: CSSProperties = {
    height: 28, border: `1px solid ${C.actionBorder}`, borderRadius: 8, background: C.actionBg,
    cursor: "pointer", fontSize: 18, fontFamily: FONT, color: C.text,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.15s", ...style,
  };
  return (
    <button style={base} onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.background = C.actionHover)}
      onMouseLeave={e => (e.currentTarget.style.background = C.actionBg)}>{label}</button>
  );
}

// ============================================================
// DragState — pointer-based, anchor to handle
// ============================================================
interface DragState {
  draggingIdx: number;
  insertIdx: number;
  ghostX: number;
  ghostY: number;
  anchorX: number;   // cursor offset from ghost row top-left
  anchorY: number;
  ghostW: number;
  ghostH: number;
}

// ============================================================
// BulletItem
// ============================================================
function BulletItem({ bullet, index, onSave, onDelete, onHandlePointerDown, dragState }: {
  bullet: ModuleBullet;
  index: number;
  onSave: (v: string) => void;
  onDelete: () => void;
  onHandlePointerDown: (e: React.PointerEvent, idx: number, rowEl: HTMLElement, handleEl: HTMLElement) => void;
  dragState: DragState | null;
}) {
  const [delVis, setDelVis] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLSpanElement>(null);

  const isDragging = dragState?.draggingIdx === index;

  // Compute translateY for slot animation
  let translateY = 0;
  if (dragState && !isDragging) {
    const { draggingIdx, insertIdx, ghostH } = dragState;
    if (draggingIdx < insertIdx) {
      // dragged item moving down: items in (draggingIdx, insertIdx] slide up
      if (index > draggingIdx && index <= insertIdx) translateY = -ghostH;
    } else if (draggingIdx > insertIdx) {
      // dragged item moving up: items in [insertIdx, draggingIdx) slide down
      if (index >= insertIdx && index < draggingIdx) translateY = ghostH;
    }
  }

  return (
    <div ref={rowRef}
      style={{
        display: "flex", alignItems: "flex-start", position: "relative", padding: "3px 0",
        opacity: isDragging ? 0 : 1,
        transform: `translateY(${translateY}px)`,
        transition: "transform 0.18s ease, opacity 0.15s ease",
      }}
    >
      <span style={{ color: C.preproc, marginRight: 8, marginTop: 2, flexShrink: 0, fontSize: 14 }}>•</span>
      <div style={{ flex: 1, fontSize: 14, color: C.text, lineHeight: 1.6 }}>
        <InlineEdit value={bullet.raw_fact} onSave={onSave} placeholder="点击输入经历内容" multiline />
      </div>

      {/* Drag handle */}
      <span ref={handleRef}
        style={{ cursor: "grab", color: C.muted, fontSize: 16, userSelect: "none", padding: "2px 6px", lineHeight: 1, flexShrink: 0, alignSelf: "center" }}
        title="拖动排序"
        onPointerDown={e => {
          if (rowRef.current && handleRef.current) {
            onHandlePointerDown(e, index, rowRef.current, handleRef.current);
          }
        }}
      >≡</span>

      {/* Delete zone */}
      <div
        onMouseEnter={() => setDelVis(true)} onMouseLeave={() => setDelVis(false)}
        style={{ width: 32, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <div onClick={onDelete} style={{
          opacity: delVis ? 1 : 0, transition: "opacity 0.2s ease",
          width: 26, height: 26, borderRadius: 8,
          border: `1px solid ${C.actionBorder}`, background: C.actionBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", fontSize: 16, color: C.danger,
          pointerEvents: delVis ? "all" : "none",
        }}>−</div>
      </div>
    </div>
  );
}

// ============================================================
// ModuleCard
// ============================================================
function ModuleCard({ mod, onUpdate, onDelete, onAddBullet, onDeleteBullet, onSaveBullet, onReorderBullets }: {
  mod: ResumeModule;
  onUpdate: (fields: Partial<ResumeModule>) => void;
  onDelete: () => void;
  onAddBullet: () => void;
  onDeleteBullet: (id: string) => void;
  onSaveBullet: (id: string, v: string) => void;
  onReorderBullets: (bullets: ModuleBullet[]) => void;
}) {
  const [dragState, setDragState] = useState<DragState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const bulletsAreaRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent, idx: number, rowEl: HTMLElement, handleEl: HTMLElement) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    const rowRect = rowEl.getBoundingClientRect();
    const handleRect = handleEl.getBoundingClientRect();
    // Anchor: pointer offset relative to row top-left, snapped to where the handle is
    const anchorX = e.clientX - rowRect.left + (handleRect.left - rowRect.left);
    const anchorY = e.clientY - rowRect.top;

    setDragState({
      draggingIdx: idx,
      insertIdx: idx,
      ghostX: e.clientX,
      ghostY: e.clientY,
      anchorX: e.clientX - rowRect.left,
      anchorY: e.clientY - rowRect.top,
      ghostW: rowRect.width,
      ghostH: rowRect.height,
    });

    const onMove = (me: PointerEvent) => {
      setDragState(prev => {
        if (!prev) return null;
        // Compute insertIdx from pointer position relative to bullets area
        let newInsertIdx = prev.draggingIdx;
        if (bulletsAreaRef.current) {
          const items = Array.from(bulletsAreaRef.current.querySelectorAll<HTMLElement>("[data-bullet-row]"));
          for (let i = 0; i < items.length; i++) {
            const r = items[i].getBoundingClientRect();
            const midY = r.top + r.height / 2;
            if (me.clientY < midY) { newInsertIdx = i; break; }
            if (i === items.length - 1) newInsertIdx = i;
          }
        }
        return { ...prev, ghostX: me.clientX, ghostY: me.clientY, insertIdx: newInsertIdx };
      });
    };

    const onUp = () => {
      setDragState(prev => {
        if (prev && prev.insertIdx !== prev.draggingIdx) {
          const reordered = [...mod.bullets];
          const [moved] = reordered.splice(prev.draggingIdx, 1);
          reordered.splice(prev.insertIdx, 0, moved);
          onReorderBullets(reordered);
        }
        return null;
      });
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const ghostBullet = dragState ? mod.bullets[dragState.draggingIdx] : null;

  return (
    <div ref={containerRef} style={cardStyle}>
      {/* Floating ghost */}
      {dragState && ghostBullet && (
        <div style={{
          position: "fixed",
          left: dragState.ghostX - dragState.anchorX,
          top: dragState.ghostY - dragState.anchorY,
          width: dragState.ghostW,
          pointerEvents: "none", zIndex: 1000,
          background: C.card, border: `2px solid ${C.dragBorder}`,
          borderRadius: 8, padding: "3px 12px",
          boxShadow: "0 6px 20px rgba(0,0,0,0.22)",
          opacity: 0.92,
          display: "flex", alignItems: "flex-start", gap: 8,
          fontFamily: FONT,
        }}>
          <span style={{ color: C.preproc, fontSize: 14, marginTop: 2 }}>•</span>
          <span style={{ flex: 1, fontSize: 14, color: C.text, lineHeight: 1.6 }}>
            {ghostBullet.raw_fact || <span style={{ color: C.muted, fontStyle: "italic" }}>空经历条目</span>}
          </span>
          <span style={{ color: C.muted, fontSize: 16 }}>≡</span>
        </div>
      )}

      {/* Header */}
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
          {mod.context_tags.map((t, i) => <span key={i} style={tagStyle}>{t}</span>)}
        </div>
      )}

      {/* Bullets area */}
      <div ref={bulletsAreaRef} style={{ padding: "0 12px 4px" }}>
        {mod.bullets.map((b, i) => (
          <div key={b.bullet_id} data-bullet-row="1">
            <BulletItem
              bullet={b} index={i}
              onSave={v => onSaveBullet(b.bullet_id, v)}
              onDelete={() => onDeleteBullet(b.bullet_id)}
              onHandlePointerDown={handlePointerDown}
              dragState={dragState}
            />
          </div>
        ))}
        <HoverReveal>
          <SingleButton label="+" onClick={onAddBullet} style={{ width: "100%", height: 26, fontSize: 16 }} />
        </HoverReveal>
      </div>

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
  existingSections: Set<string>; onPick: (s: string) => void; onClose: () => void;
}) {
  const available = SECTION_ORDER.filter(s => !existingSections.has(s));
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 4, boxShadow: "0 2px 8px rgba(0,0,0,0.15)", fontFamily: FONT }}>
      {available.length === 0
        ? <div style={{ padding: 8, fontSize: 13, color: C.muted }}>所有分类均已使用。<button onClick={onClose} style={{ marginLeft: 8, cursor: "pointer" }}>关闭</button></div>
        : available.map(s => (
          <div key={s} onClick={() => { onPick(s); onClose(); }}
            style={{ padding: "4px 12px", cursor: "pointer", fontSize: 13, borderRadius: 4 }}
            onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >{SECTION_LABELS[s]}</div>
        ))}
    </div>
  );
}

// ============================================================
// ModuleLibrary
// ============================================================
export function ModuleLibrary({ onBack }: { onBack: () => void }) {
  const [modules, setModules] = useState<ResumeModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showSectionPicker, setShowSectionPicker] = useState(false);

  // History for undo/redo (local state snapshots)
  const historyStack = useRef<ResumeModule[][]>([]);
  const historyIdx = useRef(-1);
  const skipHistory = useRef(false);

  const setModulesWithHistory = useCallback((mods: ResumeModule[]) => {
    if (!skipHistory.current) {
      historyStack.current = historyStack.current.slice(0, historyIdx.current + 1);
      historyStack.current.push(JSON.parse(JSON.stringify(mods)));
      historyIdx.current = historyStack.current.length - 1;
    }
    setModules(mods);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIdx.current <= 0) return;
    historyIdx.current--;
    skipHistory.current = true;
    setModules(JSON.parse(JSON.stringify(historyStack.current[historyIdx.current])));
    skipHistory.current = false;
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIdx.current >= historyStack.current.length - 1) return;
    historyIdx.current++;
    skipHistory.current = true;
    setModules(JSON.parse(JSON.stringify(historyStack.current[historyIdx.current])));
    skipHistory.current = false;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
      if (inInput) return; // let native undo/redo work in text fields
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo(); else handleUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  const reload = useCallback(async () => {
    setLoading(true);
    const mods = await fetchModules();
    historyStack.current = [JSON.parse(JSON.stringify(mods))];
    historyIdx.current = 0;
    setModules(mods);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const existingSections = new Set(modules.map(m => m.section));

  const grouped = SECTION_ORDER
    .map(sec => ({ section: sec, label: SECTION_LABELS[sec], items: modules.filter(m => m.section === sec) }))
    .filter(g => g.items.length > 0)
    .filter(g => filter === "all" || g.section === filter);

  const handleUpdateModule = async (mod: ResumeModule, fields: Partial<ResumeModule>) => {
    const updated = await patchModuleApi(mod.module_id, fields);
    setModulesWithHistory(modules.map(m => m.module_id === mod.module_id ? { ...updated, bullets: m.bullets } : m));
  };

  const handleDeleteModule = async (id: string) => {
    if (!confirm("确认删除此子模块及其所有经历条目？")) return;
    await deleteModuleApi(id);
    setModulesWithHistory(modules.filter(m => m.module_id !== id));
  };

  const handleAddModuleInSection = async (section: string) => {
    const newMod = await addModuleApi(section);
    setModulesWithHistory([...modules, newMod]);
  };

  const handleDeleteSection = async (section: string) => {
    const items = modules.filter(m => m.section === section);
    if (!confirm(`确认删除"${SECTION_LABELS[section]}"分类下全部 ${items.length} 个子模块？`)) return;
    for (const m of items) await deleteModuleApi(m.module_id);
    setModulesWithHistory(modules.filter(m => m.section !== section));
  };

  const handleAddSection = async (section: string) => {
    const newMod = await addModuleApi(section);
    setModulesWithHistory([...modules, newMod]);
  };

  const handleSaveBullet = async (moduleId: string, bulletId: string, raw_fact: string) => {
    const updated = await patchBulletApi(moduleId, bulletId, { raw_fact });
    setModulesWithHistory(modules.map(m =>
      m.module_id === moduleId ? { ...m, bullets: m.bullets.map(b => b.bullet_id === bulletId ? { ...b, ...updated } : b) } : m
    ));
  };

  const handleDeleteBullet = async (moduleId: string, bulletId: string) => {
    await deleteBulletApi(moduleId, bulletId);
    setModulesWithHistory(modules.map(m =>
      m.module_id === moduleId ? { ...m, bullets: m.bullets.filter(b => b.bullet_id !== bulletId) } : m
    ));
  };

  const handleAddBullet = async (moduleId: string) => {
    const newBullet = await addBulletApi(moduleId);
    setModulesWithHistory(modules.map(m =>
      m.module_id === moduleId ? { ...m, bullets: [...m.bullets, newBullet] } : m
    ));
  };

  const handleReorderBullets = (moduleId: string, bullets: ModuleBullet[]) => {
    setModulesWithHistory(modules.map(m => m.module_id === moduleId ? { ...m, bullets } : m));
  };

  const totalBullets = modules.reduce((s, m) => s + m.bullets.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, fontFamily: FONT, color: C.text }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <img src={logoUrl} alt="经历库" style={{ height: 36, objectFit: "contain" }} />
        <span style={{ fontSize: 12, color: C.muted, marginLeft: 4 }}>
          {modules.length} 个子模块，{totalBullets} 条经历
        </span>
        <div style={{ flex: 1 }} />

        {/* Undo / Redo */}
        <button style={iconBtnStyle} onClick={handleUndo} title="撤销 (Ctrl+Z)">↺</button>
        <button style={iconBtnStyle} onClick={handleRedo} title="重做 (Ctrl+Shift+Z)">↻</button>

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
            <div key={g.section} style={sectionContainerStyle}>
              <div style={sectionHeaderStyle}>{g.label}</div>
              {g.items.map((mod, modIdx) => (
                <div key={mod.module_id}>
                  <ModuleCard
                    mod={mod}
                    onUpdate={fields => handleUpdateModule(mod, fields)}
                    onDelete={() => handleDeleteModule(mod.module_id)}
                    onAddBullet={() => handleAddBullet(mod.module_id)}
                    onDeleteBullet={bid => handleDeleteBullet(mod.module_id, bid)}
                    onSaveBullet={(bid, v) => handleSaveBullet(mod.module_id, bid, v)}
                    onReorderBullets={bullets => handleReorderBullets(mod.module_id, bullets)}
                  />
                  {modIdx === g.items.length - 1 && (
                    <HoverReveal>
                      <PairButtons onAdd={() => handleAddModuleInSection(g.section)} onRemove={() => handleDeleteModule(mod.module_id)} />
                    </HoverReveal>
                  )}
                </div>
              ))}
              <HoverReveal>
                <div style={{ position: "relative" }}>
                  <PairButtons onAdd={() => setShowSectionPicker(true)} onRemove={() => handleDeleteSection(g.section)} />
                  {showSectionPicker && (
                    <div style={{ position: "absolute", bottom: 32, left: 0, zIndex: 50 }}>
                      <SectionPicker existingSections={existingSections} onPick={handleAddSection} onClose={() => setShowSectionPicker(false)} />
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
                <SectionPicker existingSections={existingSections} onPick={handleAddSection} onClose={() => setShowSectionPicker(false)} />
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
  display: "flex", alignItems: "center", gap: 8, padding: "8px 16px",
  background: C.toolbar, borderBottom: `1px solid ${C.border}`, fontFamily: FONT, flexShrink: 0,
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

const iconBtnStyle: CSSProperties = {
  width: 32, height: 32, border: `1px solid ${C.border}`, borderRadius: 4,
  background: C.toolbar, cursor: "pointer", fontFamily: FONT, fontSize: 18,
  color: C.text, display: "flex", alignItems: "center", justifyContent: "center",
};

const sectionContainerStyle: CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 8,
  padding: "8px 12px 4px", marginBottom: 16, background: "#FAFAF8",
};

const sectionHeaderStyle: CSSProperties = {
  fontSize: 13, fontWeight: 700, color: C.keyword, letterSpacing: "0.08em",
  padding: "4px 0 6px", borderBottom: `1px solid ${C.border}`, marginBottom: 8, fontFamily: FONT,
};

const cardStyle: CSSProperties = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 8,
  marginBottom: 6, fontFamily: FONT,
};

const tagStyle: CSSProperties = {
  fontSize: 11, padding: "1px 6px", borderRadius: 4, background: "#F0F0F0",
  color: C.preproc, border: `1px solid ${C.border}`, fontFamily: FONT,
};
