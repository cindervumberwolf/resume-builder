import { useState, useEffect, useCallback, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import logoUrl from "../assets/logo.png";
import {
  fetchModules, deleteModuleApi, deleteBulletApi,
  patchModuleApi, patchBulletApi, addModuleApi, addBulletApi, reorderBulletsApi,
  fetchChildModules, deleteChildModuleApi, patchChildModuleApi, patchChildBulletApi,
  fetchJds, deleteJdApi,
  type ResumeModule, type ModuleBullet, type ChildModule, type ChildBullet, type JdSummary,
} from "../api";

// ============================================================
// Palette
// ============================================================
const C = {
  bg: "#FFFFFF",
  toolbar: "#F3F3F3",
  card: "#FFFFFF",
  text: "#000000",
  muted: "#909090",
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
// HoverReveal — 2-second linger
// ============================================================
function HoverReveal({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const [vis, setVis] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => { if (timer.current) clearTimeout(timer.current); setVis(true); };
  const scheduleHide = () => { timer.current = setTimeout(() => setVis(false), 2000); };

  return (
    <div onMouseEnter={show} onMouseLeave={scheduleHide}
      style={{ display: "flex", alignItems: "center", ...style }}>
      <div style={{
        opacity: vis ? 1 : 0,
        transition: "opacity 0.2s ease",
        pointerEvents: vis ? "all" : "none",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        {children}
      </div>
    </div>
  );
}

// ============================================================
// TagsEdit — comma-separated tag editing
// ============================================================
function TagsEdit({ tags, onSave }: { tags: string[]; onSave: (tags: string[]) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(tags.join(", "));
  useEffect(() => { setText(tags.join(", ")); }, [tags]);

  const commit = () => {
    setEditing(false);
    const newTags = text.split(",").map(t => t.trim()).filter(Boolean);
    if (JSON.stringify(newTags) !== JSON.stringify(tags)) onSave(newTags);
  };

  if (editing) {
    return (
      <input autoFocus value={text}
        onChange={e => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") { setText(tags.join(", ")); setEditing(false); }
        }}
        placeholder="tag1, tag2, tag3"
        style={{
          fontFamily: FONT, fontSize: 11, padding: "2px 6px", borderRadius: 4,
          border: `1px solid ${C.inputBorder}`, outline: "none", background: "#FFFFF0",
          width: "100%", color: C.text,
        }}
      />
    );
  }
  return (
    <div onClick={() => setEditing(true)} title="点击编辑标签（逗号分隔）"
      style={{ cursor: "pointer", display: "flex", flexWrap: "wrap", gap: 4, minHeight: 22 }}>
      {tags.length > 0
        ? tags.map((t, i) => <span key={i} style={tagStyle}>{t}</span>)
        : <span style={{ color: C.muted, fontSize: 11, fontStyle: "italic", fontFamily: FONT }}>点击添加标签</span>
      }
    </div>
  );
}

// ============================================================
// InlineConfirm — replaces window.confirm()
// ============================================================
function InlineConfirm({ label, onConfirm, danger }: {
  label: ReactNode; onConfirm: () => void; danger?: boolean;
}) {
  const [asking, setAsking] = useState(false);

  if (asking) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontFamily: FONT }}>
        <span style={{ color: danger ? C.danger : C.text, fontSize: 12 }}>确认？</span>
        <button onClick={() => { setAsking(false); onConfirm(); }} style={confirmBtnStyle(true)}>✓</button>
        <button onClick={() => setAsking(false)} style={confirmBtnStyle(false)}>取消</button>
      </span>
    );
  }
  return (
    <span onClick={() => setAsking(true)} style={{ cursor: "pointer", display: "inline-flex", alignItems: "center" }}>
      {label}
    </span>
  );
}

const confirmBtnStyle = (primary: boolean): CSSProperties => ({
  fontSize: 11, padding: "1px 5px", borderRadius: 3, cursor: "pointer", fontFamily: FONT,
  border: `1px solid ${primary ? C.danger : C.border}`,
  background: primary ? "#FFF0F0" : C.actionBg,
  color: primary ? C.danger : C.text,
});

// ============================================================
// SmallIconBtn — tiny icon button used in headers
// ============================================================
function SmallIconBtn({ children, onClick, title, style }: {
  children: ReactNode; onClick?: () => void; title?: string; style?: CSSProperties;
}) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        border: `1px solid ${C.actionBorder}`, borderRadius: 4, background: hov ? C.actionHover : C.actionBg,
        cursor: "pointer", fontFamily: FONT, fontSize: 13, color: C.text,
        padding: "2px 7px", lineHeight: 1.4, display: "inline-flex", alignItems: "center",
        transition: "background 0.15s", ...style,
      }}>
      {children}
    </button>
  );
}

// ============================================================
// DotMenuBtn — ⋯ popover for ModuleCard delete
// ============================================================
function DotMenuBtn({ onDelete }: { onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setConfirming(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <SmallIconBtn onClick={() => { setOpen(o => !o); setConfirming(false); }} title="更多操作"
        style={{ fontSize: 16, padding: "0 6px", letterSpacing: 1 }}>⋯</SmallIconBtn>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 200,
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 6,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)", padding: 4, minWidth: 140, fontFamily: FONT,
        }}>
          {confirming ? (
            <div style={{ padding: "6px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ color: C.danger }}>确认删除？</span>
              <button onClick={() => { setOpen(false); setConfirming(false); onDelete(); }} style={confirmBtnStyle(true)}>✓</button>
              <button onClick={() => setConfirming(false)} style={confirmBtnStyle(false)}>取消</button>
            </div>
          ) : (
            <div onClick={() => setConfirming(true)} style={menuItemStyle}>
              <span style={{ color: C.danger }}>删除此子模块</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const menuItemStyle: CSSProperties = {
  padding: "6px 12px", cursor: "pointer", fontSize: 13, borderRadius: 4,
  transition: "background 0.12s",
};

// ============================================================
// DragState — pointer-based, anchor to handle
// ============================================================
interface DragState {
  draggingIdx: number;
  insertIdx: number;
  ghostX: number;
  ghostY: number;
  anchorX: number;
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

  let translateY = 0;
  if (dragState && !isDragging) {
    const { draggingIdx, insertIdx, ghostH } = dragState;
    if (draggingIdx < insertIdx && index > draggingIdx && index <= insertIdx) translateY = -ghostH;
    else if (draggingIdx > insertIdx && index >= insertIdx && index < draggingIdx) translateY = ghostH;
  }

  return (
    <div ref={rowRef}
      style={{
        display: "flex", alignItems: "flex-start", position: "relative", padding: "2px 0",
        opacity: isDragging ? 0 : 1,
        transform: `translateY(${translateY}px)`,
        transition: "transform 0.18s ease, opacity 0.15s ease",
      }}
    >
      <span style={{ color: C.preproc, marginRight: 8, marginTop: 2, flexShrink: 0, fontSize: 14 }}>•</span>
      <div style={{ flex: 1, fontSize: 14, color: C.text, lineHeight: 1.6 }}>
        <InlineEdit value={bullet.raw_fact} onSave={onSave} placeholder="点击输入经历内容" multiline />
      </div>
      <span ref={handleRef}
        style={{ cursor: "grab", color: C.muted, fontSize: 16, userSelect: "none", padding: "2px 5px", lineHeight: 1, flexShrink: 0, alignSelf: "center" }}
        title="拖动排序"
        onPointerDown={e => {
          if (rowRef.current && handleRef.current) onHandlePointerDown(e, index, rowRef.current, handleRef.current);
        }}
      >≡</span>
      {/* Delete */}
      <div onMouseEnter={() => setDelVis(true)} onMouseLeave={() => setDelVis(false)}
        style={{ width: 28, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <InlineConfirm
          onConfirm={onDelete}
          danger
          label={
            <div style={{
              opacity: delVis ? 1 : 0, transition: "opacity 0.18s ease",
              width: 24, height: 24, borderRadius: 6,
              border: `1px solid ${C.actionBorder}`, background: C.actionBg,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: C.danger, pointerEvents: delVis ? "all" : "none",
            }}>−</div>
          }
        />
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
  const [headerHover, setHeaderHover] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const bulletsAreaRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent, idx: number, rowEl: HTMLElement, _handleEl: HTMLElement) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const rowRect = rowEl.getBoundingClientRect();
    setDragState({
      draggingIdx: idx, insertIdx: idx,
      ghostX: e.clientX, ghostY: e.clientY,
      anchorX: e.clientX - rowRect.left, anchorY: e.clientY - rowRect.top,
      ghostW: rowRect.width, ghostH: rowRect.height,
    });

    const onMove = (me: PointerEvent) => {
      setDragState(prev => {
        if (!prev) return null;
        let newInsertIdx = prev.draggingIdx;
        if (bulletsAreaRef.current) {
          const items = Array.from(bulletsAreaRef.current.querySelectorAll<HTMLElement>("[data-bullet-row]"));
          for (let i = 0; i < items.length; i++) {
            const r = items[i].getBoundingClientRect();
            if (me.clientY < r.top + r.height / 2) { newInsertIdx = i; break; }
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
    <div ref={containerRef} style={cardStyle}
      onMouseEnter={() => setHeaderHover(true)} onMouseLeave={() => setHeaderHover(false)}>
      {/* Floating drag ghost */}
      {dragState && ghostBullet && (
        <div style={{
          position: "fixed",
          left: dragState.ghostX - dragState.anchorX,
          top: dragState.ghostY - dragState.anchorY,
          width: dragState.ghostW,
          pointerEvents: "none", zIndex: 1000,
          background: C.card, border: `2px solid ${C.dragBorder}`,
          borderRadius: 8, padding: "3px 12px",
          boxShadow: "0 6px 20px rgba(0,0,0,0.22)", opacity: 0.92,
          display: "flex", alignItems: "flex-start", gap: 8, fontFamily: FONT,
        }}>
          <span style={{ color: C.preproc, fontSize: 14, marginTop: 2 }}>•</span>
          <span style={{ flex: 1, fontSize: 14, color: C.text, lineHeight: 1.6 }}>
            {ghostBullet.raw_fact || <span style={{ color: C.muted, fontStyle: "italic" }}>空经历条目</span>}
          </span>
          <span style={{ color: C.muted, fontSize: 16 }}>≡</span>
        </div>
      )}

      {/* Header row */}
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
        {/* ⋯ delete menu — always rendered, opacity transition */}
        <div style={{ opacity: headerHover ? 1 : 0, transition: "opacity 0.18s ease", pointerEvents: headerHover ? "all" : "none", marginLeft: 4 }}>
          <DotMenuBtn onDelete={onDelete} />
        </div>
      </div>

      {/* Tags — editable */}
      <div style={{ padding: "0 12px 6px" }}>
        <TagsEdit tags={mod.context_tags ?? []} onSave={tags => onUpdate({ context_tags: tags })} />
      </div>

      {/* Bullets */}
      <div ref={bulletsAreaRef} style={{ padding: "0 12px 2px" }}>
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
        {/* Always-visible add bullet row */}
        <AddBulletRow onClick={onAddBullet} />
      </div>
    </div>
  );
}

// ============================================================
// AddBulletRow — always visible, muted, no HoverReveal
// ============================================================
function AddBulletRow({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "4px 0 6px",
        cursor: "pointer",
        color: hov ? C.text : C.muted,
        fontSize: 13, fontFamily: FONT,
        transition: "color 0.15s",
        userSelect: "none",
      }}>
      <span style={{ fontSize: 16, lineHeight: 1 }}>＋</span>
      <span>添加经历条目</span>
    </div>
  );
}

// ============================================================
// SectionPicker dropdown
// ============================================================
function SectionPicker({ existingSections, onPick, onClose }: {
  existingSections: Set<string>; onPick: (s: string) => void; onClose: () => void;
}) {
  const available = SECTION_ORDER.filter(s => !existingSections.has(s));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: 4,
      boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontFamily: FONT, minWidth: 130,
    }}>
      {available.length === 0
        ? <div style={{ padding: "6px 12px", fontSize: 13, color: C.muted }}>所有分类均已使用</div>
        : available.map(s => (
          <div key={s} onClick={() => { onPick(s); onClose(); }}
            style={menuItemStyle}
            onMouseEnter={e => (e.currentTarget.style.background = C.hover)}
            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
          >{SECTION_LABELS[s]}</div>
        ))}
    </div>
  );
}

// ============================================================
// SectionGroup — header + cards
// ============================================================
function SectionGroup({ section, label, items, onAddModule, onDeleteSection, onUpdateModule,
  onDeleteModule, onAddBullet, onDeleteBullet, onSaveBullet, onReorderBullets }: {
  section: string; label: string; items: ResumeModule[];
  onAddModule: () => void; onDeleteSection: () => void;
  onUpdateModule: (mod: ResumeModule, fields: Partial<ResumeModule>) => void;
  onDeleteModule: (id: string) => void;
  onAddBullet: (moduleId: string) => void;
  onDeleteBullet: (moduleId: string, bulletId: string) => void;
  onSaveBullet: (moduleId: string, bulletId: string, v: string) => void;
  onReorderBullets: (moduleId: string, bullets: ModuleBullet[]) => void;
}) {
  return (
    <div style={sectionContainerStyle}>
      {/* Section header — SectionHeader manages its own hover state */}
      <div style={{ marginBottom: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
        <SectionHeader label={label} onAdd={onAddModule} onDelete={onDeleteSection} />
      </div>

      {items.map(mod => (
        <ModuleCard
          key={mod.module_id}
          mod={mod}
          onUpdate={fields => onUpdateModule(mod, fields)}
          onDelete={() => onDeleteModule(mod.module_id)}
          onAddBullet={() => onAddBullet(mod.module_id)}
          onDeleteBullet={bid => onDeleteBullet(mod.module_id, bid)}
          onSaveBullet={(bid, v) => onSaveBullet(mod.module_id, bid, v)}
          onReorderBullets={bullets => onReorderBullets(mod.module_id, bullets)}
        />
      ))}
    </div>
  );
}

// ============================================================
// SectionHeader — always-visible label + hover buttons
// ============================================================
function SectionHeader({ label, onAdd, onDelete }: {
  label: string; onAdd: () => void; onDelete: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <span style={{ fontSize: 13, fontWeight: 700, color: C.keyword, letterSpacing: "0.08em", fontFamily: FONT, flex: 1 }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: 6, opacity: hov ? 1 : 0, transition: "opacity 0.2s ease", pointerEvents: hov ? "all" : "none" }}>
        <SmallIconBtn onClick={onAdd} title="添加子模块" style={{ fontSize: 12, color: C.comment }}>
          ＋ 添加子模块
        </SmallIconBtn>
        <InlineConfirm danger onConfirm={onDelete} label={
          <SmallIconBtn title="删除此分类" style={{ color: C.danger, fontSize: 12 }}>
            × 删除分类
          </SmallIconBtn>
        } />
      </div>
    </div>
  );
}

// ============================================================
// ChildModuleCard — read-only-ish card for child assets
// ============================================================
function ChildModuleCard({ mod, parentLabel, onDelete, onPatchBullet }: {
  mod: ChildModule;
  parentLabel: string;
  onDelete: () => void;
  onPatchBullet: (childBulletId: string, raw_fact: string) => void;
}) {
  const [headerHover, setHeaderHover] = useState(false);
  return (
    <div style={cardStyle}
      onMouseEnter={() => setHeaderHover(true)} onMouseLeave={() => setHeaderHover(false)}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 4, padding: "8px 12px 4px", fontSize: 14 }}>
        <span style={{ fontWeight: 700, color: C.string, fontFamily: FONT }}>{mod.organization || "—"}</span>
        <span style={{ color: C.muted }}>|</span>
        <span style={{ color: C.comment, fontFamily: FONT }}>{mod.title || "—"}</span>
        <span style={{ color: C.muted }}>|</span>
        <span style={{ color: C.number, fontFamily: FONT }}>{mod.location || ""}</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: C.muted, fontSize: 12, fontFamily: FONT }}>{mod.date_range}</span>
        <div style={{ opacity: headerHover ? 1 : 0, transition: "opacity 0.18s ease", pointerEvents: headerHover ? "all" : "none", marginLeft: 4 }}>
          <DotMenuBtn onDelete={onDelete} />
        </div>
      </div>

      {/* Provenance */}
      <div style={{ padding: "0 12px 4px", fontSize: 11, color: C.muted, fontFamily: FONT }}>
        ← 母模块: {parentLabel}
      </div>

      {/* Tags */}
      <div style={{ padding: "0 12px 6px", display: "flex", flexWrap: "wrap", gap: 4 }}>
        {mod.context_tags.map((t, i) => <span key={i} style={tagStyle}>{t}</span>)}
      </div>

      {/* Bullets — editable text */}
      <div style={{ padding: "0 12px 8px" }}>
        {mod.bullets.map(b => (
          <div key={b.child_bullet_id} style={{ display: "flex", alignItems: "flex-start", padding: "2px 0" }}>
            <span style={{ color: C.preproc, marginRight: 8, marginTop: 2, flexShrink: 0, fontSize: 14 }}>•</span>
            <div style={{ flex: 1, fontSize: 14, color: C.text, lineHeight: 1.6 }}>
              <InlineEdit value={b.raw_fact} onSave={v => onPatchBullet(b.child_bullet_id, v)} placeholder="点击编辑" multiline />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// JdCard
// ============================================================
function JdCard({ jd, onDelete }: { jd: JdSummary; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [hover, setHover] = useState(false);

  return (
    <div style={{ ...cardStyle, marginBottom: 10 }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 6, padding: "8px 12px 4px", fontSize: 14 }}>
        <span style={{ fontWeight: 700, color: C.string, fontFamily: FONT }}>{jd.meta.company || "—"}</span>
        <span style={{ color: C.muted }}>—</span>
        <span style={{ color: C.comment, fontFamily: FONT }}>{jd.meta.role_title || "—"}</span>
        {jd.meta.location && <>
          <span style={{ color: C.muted }}>|</span>
          <span style={{ color: C.number, fontFamily: FONT }}>{jd.meta.location}</span>
        </>}
        {jd.meta.team && <>
          <span style={{ color: C.muted }}>|</span>
          <span style={{ color: C.muted, fontFamily: FONT, fontSize: 12 }}>{jd.meta.team}</span>
        </>}
        <div style={{ flex: 1 }} />
        {/* expand toggle */}
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            border: `1px solid ${C.actionBorder}`, borderRadius: 4,
            background: C.actionBg, cursor: "pointer", fontFamily: FONT,
            fontSize: 11, color: C.muted, padding: "1px 7px",
          }}
        >{expanded ? "收起" : "展开"}</button>
        {/* delete */}
        <div style={{ opacity: hover ? 1 : 0, transition: "opacity 0.18s ease", pointerEvents: hover ? "all" : "none", marginLeft: 4 }}>
          <DotMenuBtn onDelete={onDelete} />
        </div>
      </div>

      {/* Domain tags */}
      {jd.domain_tags.length > 0 && (
        <div style={{ padding: "2px 12px 6px", display: "flex", flexWrap: "wrap", gap: 4 }}>
          {jd.domain_tags.map((t, i) => <span key={i} style={tagStyle}>{t}</span>)}
        </div>
      )}

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: "0 12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          {jd.hard_requirements.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.keyword, fontFamily: FONT, marginBottom: 3 }}>硬性要求</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {jd.hard_requirements.map((r, i) => (
                  <span key={i} style={{ ...tagStyle, color: C.danger, borderColor: "#DDAAAA", background: "#FFF0F0" }}>{r}</span>
                ))}
              </div>
            </div>
          )}
          {jd.soft_requirements.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.keyword, fontFamily: FONT, marginBottom: 3 }}>软性要求</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {jd.soft_requirements.map((r, i) => (
                  <span key={i} style={tagStyle}>{r}</span>
                ))}
              </div>
            </div>
          )}
          {jd.preferred_signals.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.keyword, fontFamily: FONT, marginBottom: 3 }}>加分项</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {jd.preferred_signals.map((r, i) => (
                  <span key={i} style={{ ...tagStyle, color: C.comment }}>{r}</span>
                ))}
              </div>
            </div>
          )}
          {jd.raw_text && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.keyword, fontFamily: FONT, marginBottom: 3 }}>原文</div>
              <pre style={{
                fontSize: 11, color: C.muted, fontFamily: FONT, whiteSpace: "pre-wrap",
                wordBreak: "break-word", margin: 0, maxHeight: 160, overflowY: "auto",
                background: "#FAFAF8", border: `1px solid ${C.border}`, borderRadius: 4,
                padding: "6px 8px", lineHeight: 1.6,
              }}>{jd.raw_text}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// JdTab
// ============================================================
function JdTab() {
  const [jds, setJds] = useState<JdSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setJds(await fetchJds());
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const handleDelete = async (jobId: string) => {
    await deleteJdApi(jobId);
    setJds(prev => prev.filter(j => j.job_id !== jobId));
  };

  if (loading) return <p style={{ color: C.muted, padding: 24 }}>加载中...</p>;
  if (jds.length === 0) return (
    <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
      <p style={{ fontSize: 16, marginBottom: 8 }}>暂无已存储的 JD。</p>
      <p style={{ fontSize: 13 }}>在 GPT 中投递 JD 后将自动存储至此。</p>
    </div>
  );

  return (
    <>
      {jds.map(jd => (
        <JdCard key={jd.job_id} jd={jd} onDelete={() => handleDelete(jd.job_id)} />
      ))}
    </>
  );
}

// ============================================================
// ChildAssetTab — grouped by JD
// ============================================================
function ChildAssetTab({ masterModules }: { masterModules: ResumeModule[] }) {
  const [children, setChildren] = useState<ChildModule[]>([]);
  const [jds, setJds] = useState<JdSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const [cm, jd] = await Promise.all([fetchChildModules(), fetchJds()]);
    setChildren(cm);
    setJds(jd);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const jdMap = new Map(jds.map(j => [j.job_id, j]));
  const masterMap = new Map(masterModules.map(m => [m.module_id, m]));

  const parentLabel = (parentId: string) => {
    const m = masterMap.get(parentId);
    return m ? `${m.organization} | ${m.title}` : parentId.slice(0, 8);
  };

  // Group children by their first source JD; orphans go under "未关联 JD"
  const groupedByJd = new Map<string, ChildModule[]>();
  const ORPHAN_KEY = "__unlinked__";

  for (const cm of children) {
    const key = cm.source_jd_ids.length > 0 ? cm.source_jd_ids[0] : ORPHAN_KEY;
    if (!groupedByJd.has(key)) groupedByJd.set(key, []);
    groupedByJd.get(key)!.push(cm);
  }

  const handleDelete = async (id: string) => {
    await deleteChildModuleApi(id);
    setChildren(prev => prev.filter(c => c.child_module_id !== id));
  };

  const handlePatchBullet = async (cm: ChildModule, childBulletId: string, raw_fact: string) => {
    const updated = await patchChildBulletApi(cm.child_module_id, childBulletId, { raw_fact });
    setChildren(prev => prev.map(c =>
      c.child_module_id === cm.child_module_id
        ? { ...c, bullets: c.bullets.map(b => b.child_bullet_id === childBulletId ? { ...b, ...updated } : b) }
        : c
    ));
  };

  if (loading) return <p style={{ color: C.muted, padding: 24 }}>加载中...</p>;
  if (children.length === 0) return (
    <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
      <p style={{ fontSize: 16, marginBottom: 8 }}>暂无子资产。</p>
      <p style={{ fontSize: 13 }}>编译 PDF 后 GPT 将自动存储 JD 优化版本至此。</p>
    </div>
  );

  return (
    <>
      {Array.from(groupedByJd.entries()).map(([jdKey, mods]) => {
        const jd = jdMap.get(jdKey);
        const jdTitle = jdKey === ORPHAN_KEY
          ? "未关联 JD"
          : jd ? `${jd.meta.company} — ${jd.meta.role_title}` : jdKey.slice(0, 12);
        return (
          <div key={jdKey} style={sectionContainerStyle}>
            <div style={{ marginBottom: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.keyword, letterSpacing: "0.08em", fontFamily: FONT }}>
                {jdTitle}
              </span>
              {jd?.meta.location && (
                <span style={{ fontSize: 11, color: C.muted, marginLeft: 8, fontFamily: FONT }}>{jd.meta.location}</span>
              )}
            </div>
            {mods.map(cm => (
              <ChildModuleCard
                key={cm.child_module_id}
                mod={cm}
                parentLabel={parentLabel(cm.parent_module_id)}
                onDelete={() => handleDelete(cm.child_module_id)}
                onPatchBullet={(bid, v) => handlePatchBullet(cm, bid, v)}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}

// ============================================================
// ModuleLibrary
// ============================================================
export function ModuleLibrary({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<"master" | "child" | "jd">("master");
  const [modules, setModules] = useState<ResumeModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showSectionPicker, setShowSectionPicker] = useState(false);

  // Undo/redo history
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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA";
      if (inInput) return;
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
    await deleteModuleApi(id);
    setModulesWithHistory(modules.filter(m => m.module_id !== id));
  };

  const handleAddModuleInSection = async (section: string) => {
    const newMod = await addModuleApi(section);
    setModulesWithHistory([...modules, newMod]);
  };

  const handleDeleteSection = async (section: string) => {
    const items = modules.filter(m => m.section === section);
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
    reorderBulletsApi(moduleId, bullets.map(b => b.bullet_id)).catch(() => {});
  };

  const totalBullets = modules.reduce((s, m) => s + m.bullets.length, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg, fontFamily: FONT, color: C.text }}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <img src={logoUrl} alt="经历库" style={{ height: 36, objectFit: "contain" }} />
        {/* Tabs */}
        <div style={{ display: "flex", marginLeft: 8, gap: 0 }}>
          {(["master", "child", "jd"] as const).map((tab, i, arr) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              style={{
                padding: "5px 14px", fontSize: 12, fontFamily: FONT, cursor: "pointer",
                border: `1px solid ${C.border}`, borderBottom: activeTab === tab ? "none" : `1px solid ${C.border}`,
                borderRadius: i === 0 ? "4px 0 0 0" : i === arr.length - 1 ? "0 4px 0 0" : "0",
                background: activeTab === tab ? C.bg : C.toolbar,
                fontWeight: activeTab === tab ? 700 : 400,
                color: activeTab === tab ? C.keyword : C.muted,
                position: "relative", zIndex: activeTab === tab ? 2 : 1,
                marginBottom: activeTab === tab ? -1 : 0,
              }}>
              {tab === "master" ? "母资产库" : tab === "child" ? "子资产库" : "JD 库"}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>
          {activeTab === "master" ? `${modules.length} 个模块，${totalBullets} 条经历` : ""}
        </span>
        <div style={{ flex: 1 }} />
        {activeTab === "master" && (
          <>
            <button style={iconBtnStyle} onClick={handleUndo} title="撤销 (Ctrl+Z)">↺</button>
            <button style={iconBtnStyle} onClick={handleRedo} title="重做 (Ctrl+Shift+Z)">↻</button>
            <select value={filter} onChange={e => setFilter(e.target.value)} style={selectStyle}>
              <option value="all">全部分类</option>
              {SECTION_ORDER.map(s => <option key={s} value={s}>{SECTION_LABELS[s]}</option>)}
            </select>
          </>
        )}
        <button style={toolBtnStyle} onClick={onBack}>返回编辑器</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 60px" }}>
        {activeTab === "master" ? (
          <>
            {loading ? (
              <p style={{ color: C.muted, padding: 24 }}>加载中...</p>
            ) : modules.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
                <p style={{ fontSize: 16, marginBottom: 8 }}>暂无已存储的经历模块。</p>
                <p style={{ fontSize: 13 }}>在 GPT 中上传简历并存储模块后，即可在此管理。</p>
              </div>
            ) : (
              grouped.map(g => (
                <SectionGroup
                  key={g.section}
                  section={g.section} label={g.label} items={g.items}
                  onAddModule={() => handleAddModuleInSection(g.section)}
                  onDeleteSection={() => handleDeleteSection(g.section)}
                  onUpdateModule={handleUpdateModule}
                  onDeleteModule={handleDeleteModule}
                  onAddBullet={handleAddBullet}
                  onDeleteBullet={handleDeleteBullet}
                  onSaveBullet={handleSaveBullet}
                  onReorderBullets={handleReorderBullets}
                />
              ))
            )}

            {/* Page-bottom: add section */}
            {!loading && (
              <div style={{ marginTop: 16, display: "flex", justifyContent: "center", position: "relative" }}>
                <button onClick={() => setShowSectionPicker(v => !v)} style={{
                  border: `1px dashed ${C.border}`, borderRadius: 6, background: "transparent",
                  padding: "6px 20px", fontSize: 13, color: C.muted, cursor: "pointer",
                  fontFamily: FONT, transition: "color 0.15s, border-color 0.15s",
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.actionBorder; }}
                  onMouseLeave={e => { e.currentTarget.style.color = C.muted; e.currentTarget.style.borderColor = C.border; }}
                >＋ 添加分类</button>
                {showSectionPicker && (
                  <div style={{ position: "absolute", bottom: "calc(100% + 4px)", left: "50%", transform: "translateX(-50%)", zIndex: 50 }}>
                    <SectionPicker existingSections={existingSections} onPick={handleAddSection} onClose={() => setShowSectionPicker(false)} />
                  </div>
                )}
              </div>
            )}
          </>
        ) : activeTab === "child" ? (
          <ChildAssetTab masterModules={modules} />
        ) : (
          <JdTab />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Shared styles
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
  color: C.text, display: "inline-flex", alignItems: "center", justifyContent: "center",
};
const sectionContainerStyle: CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 8,
  padding: "8px 12px 8px", marginBottom: 16, background: "#FAFAF8",
};
const cardStyle: CSSProperties = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 6,
  fontFamily: FONT,
};
const tagStyle: CSSProperties = {
  fontSize: 11, padding: "1px 6px", borderRadius: 4, background: "#F0F0F0",
  color: C.preproc, border: `1px solid ${C.border}`, fontFamily: FONT,
};
