import { useState, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import {
  fetchModules, deleteModuleApi, deleteBulletApi,
  patchModuleApi, patchBulletApi,
  type ResumeModule, type ModuleBullet,
} from "../api";

const SECTION_ORDER = ["education", "experience", "projects", "leadership", "skills", "awards"] as const;
const SECTION_LABELS: Record<string, string> = {
  education: "Education / 教育背景",
  experience: "Experience / 实习经历",
  projects: "Projects / 项目经历",
  leadership: "Leadership / 竞赛与活动",
  skills: "Skills / 技能",
  awards: "Awards / 获奖",
};

export function ModuleLibrary({ onBack }: { onBack: () => void }) {
  const [modules, setModules] = useState<ResumeModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [editingModule, setEditingModule] = useState<ResumeModule | null>(null);
  const [editingBullet, setEditingBullet] = useState<{ bullet: ModuleBullet; moduleId: string } | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const list = await fetchModules();
    setModules(list);
    setLoading(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const grouped = SECTION_ORDER.map(sec => ({
    section: sec,
    label: SECTION_LABELS[sec] ?? sec,
    items: modules.filter(m => m.section === sec),
  })).filter(g => filter === "all" || g.section === filter);

  const handleDeleteModule = async (id: string) => {
    if (!confirm("Delete this module and all its bullets?")) return;
    await deleteModuleApi(id);
    setModules(prev => prev.filter(m => m.module_id !== id));
  };

  const handleDeleteBullet = async (moduleId: string, bulletId: string) => {
    if (!confirm("Delete this bullet?")) return;
    await deleteBulletApi(moduleId, bulletId);
    setModules(prev => prev.map(m =>
      m.module_id === moduleId
        ? { ...m, bullets: m.bullets.filter(b => b.bullet_id !== bulletId) }
        : m
    ));
  };

  const handleSaveModule = async (mod: ResumeModule, fields: Partial<ResumeModule>) => {
    const updated = await patchModuleApi(mod.module_id, fields);
    setModules(prev => prev.map(m => m.module_id === mod.module_id ? { ...updated, bullets: m.bullets } : m));
    setEditingModule(null);
  };

  const handleSaveBullet = async (moduleId: string, bulletId: string, raw_fact: string) => {
    const updated = await patchBulletApi(moduleId, bulletId, { raw_fact });
    setModules(prev => prev.map(m =>
      m.module_id === moduleId
        ? { ...m, bullets: m.bullets.map(b => b.bullet_id === bulletId ? { ...b, ...updated } : b) }
        : m
    ));
    setEditingBullet(null);
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#e5c07b" }}>Module Library</span>
          <span style={{ fontSize: 13, color: "#5c6370" }}>
            {modules.length} module{modules.length !== 1 ? "s" : ""},{" "}
            {modules.reduce((s, m) => s + m.bullets.length, 0)} bullets
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <select value={filter} onChange={e => setFilter(e.target.value)} style={selectStyle}>
            <option value="all">All Sections</option>
            {SECTION_ORDER.map(s => (
              <option key={s} value={s}>{SECTION_LABELS[s]}</option>
            ))}
          </select>
          <button style={backBtnStyle} onClick={onBack}>Back to Editor</button>
        </div>
      </div>

      {/* Content */}
      <div style={contentStyle}>
        {loading ? (
          <p style={{ color: "#5c6370", padding: 24 }}>Loading modules...</p>
        ) : modules.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "#5c6370" }}>
            <p style={{ fontSize: 16, marginBottom: 8 }}>No modules stored yet.</p>
            <p style={{ fontSize: 13 }}>Use the GPT to upload your resume and store modules.</p>
          </div>
        ) : (
          grouped.map(g => g.items.length > 0 && (
            <div key={g.section} style={{ marginBottom: 24 }}>
              <div style={sectionHeaderStyle}>{g.label}</div>
              {g.items.map(mod => (
                <ModuleCard
                  key={mod.module_id}
                  mod={mod}
                  onDelete={() => handleDeleteModule(mod.module_id)}
                  onEdit={() => setEditingModule(mod)}
                  onDeleteBullet={(bid) => handleDeleteBullet(mod.module_id, bid)}
                  onEditBullet={(b) => setEditingBullet({ bullet: b, moduleId: mod.module_id })}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Edit module modal */}
      {editingModule && (
        <EditModuleModal
          mod={editingModule}
          onSave={(fields) => handleSaveModule(editingModule, fields)}
          onClose={() => setEditingModule(null)}
        />
      )}

      {/* Edit bullet modal */}
      {editingBullet && (
        <EditBulletModal
          bullet={editingBullet.bullet}
          onSave={(text) => handleSaveBullet(editingBullet.moduleId, editingBullet.bullet.bullet_id, text)}
          onClose={() => setEditingBullet(null)}
        />
      )}
    </div>
  );
}

// ---- ModuleCard ----

function ModuleCard({ mod, onDelete, onEdit, onDeleteBullet, onEditBullet }: {
  mod: ResumeModule;
  onDelete: () => void;
  onEdit: () => void;
  onDeleteBullet: (id: string) => void;
  onEditBullet: (b: ModuleBullet) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle} onClick={() => setExpanded(!expanded)}>
        <div style={{ flex: 1 }}>
          <span style={{ fontWeight: 600, color: "#e06c75" }}>{mod.organization}</span>
          <span style={{ color: "#5c6370", margin: "0 8px" }}>|</span>
          <span style={{ color: "#98c379" }}>{mod.title}</span>
          {mod.location && (
            <>
              <span style={{ color: "#5c6370", margin: "0 8px" }}>|</span>
              <span style={{ color: "#d19a66" }}>{mod.location}</span>
            </>
          )}
        </div>
        <span style={{ color: "#5c6370", fontSize: 12, marginRight: 12, flexShrink: 0 }}>{mod.date_range}</span>
        <span style={{ color: "#5c6370", fontSize: 12, marginRight: 8 }}>
          {expanded ? "▼" : "▶"} {mod.bullets.length} bullet{mod.bullets.length !== 1 ? "s" : ""}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 12px" }}>
          {mod.context_tags.length > 0 && (
            <div style={{ marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {mod.context_tags.map((t, i) => (
                <span key={i} style={tagStyle}>{t}</span>
              ))}
            </div>
          )}

          {mod.bullets.map(b => (
            <div key={b.bullet_id} style={bulletRowStyle}>
              <span style={{ color: "#61afef", marginRight: 8, flexShrink: 0 }}>•</span>
              <span style={{ flex: 1, color: "#abb2bf", fontSize: 13, lineHeight: 1.5 }}>{b.raw_fact}</span>
              <div style={{ display: "flex", gap: 4, marginLeft: 8, flexShrink: 0 }}>
                <button style={smallBtnStyle} onClick={() => onEditBullet(b)} title="Edit bullet">✎</button>
                <button style={{ ...smallBtnStyle, color: "#e06c75" }} onClick={() => onDeleteBullet(b.bullet_id)} title="Delete bullet">✕</button>
              </div>
            </div>
          ))}

          <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
            <button style={actionBtnStyle} onClick={onEdit}>Edit Module</button>
            <button style={{ ...actionBtnStyle, color: "#e06c75", borderColor: "#e06c75" }} onClick={onDelete}>Delete Module</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- EditModuleModal ----

function EditModuleModal({ mod, onSave, onClose }: {
  mod: ResumeModule;
  onSave: (fields: Partial<ResumeModule>) => void;
  onClose: () => void;
}) {
  const [org, setOrg] = useState(mod.organization);
  const [title, setTitle] = useState(mod.title);
  const [dateRange, setDateRange] = useState(mod.date_range);
  const [location, setLocation] = useState(mod.location ?? "");

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: "#e5c07b", marginBottom: 16, fontSize: 16 }}>Edit Module</h3>
        <label style={labelStyle}>Organization</label>
        <input style={inputStyle} value={org} onChange={e => setOrg(e.target.value)} />
        <label style={labelStyle}>Title / Role</label>
        <input style={inputStyle} value={title} onChange={e => setTitle(e.target.value)} />
        <label style={labelStyle}>Date Range</label>
        <input style={inputStyle} value={dateRange} onChange={e => setDateRange(e.target.value)} />
        <label style={labelStyle}>Location</label>
        <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Beijing, China" />
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button style={actionBtnStyle} onClick={onClose}>Cancel</button>
          <button
            style={{ ...actionBtnStyle, background: "#98c379", color: "#282c34", borderColor: "#98c379", fontWeight: 600 }}
            onClick={() => onSave({ organization: org, title, date_range: dateRange, location: location || undefined })}
          >Save</button>
        </div>
      </div>
    </div>
  );
}

// ---- EditBulletModal ----

function EditBulletModal({ bullet, onSave, onClose }: {
  bullet: ModuleBullet;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(bullet.raw_fact);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ color: "#e5c07b", marginBottom: 16, fontSize: 16 }}>Edit Bullet</h3>
        <label style={labelStyle}>Bullet text (raw_fact)</label>
        <textarea
          style={{ ...inputStyle, minHeight: 100, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }}
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
          <button style={actionBtnStyle} onClick={onClose}>Cancel</button>
          <button
            style={{ ...actionBtnStyle, background: "#98c379", color: "#282c34", borderColor: "#98c379", fontWeight: 600 }}
            onClick={() => onSave(text)}
          >Save</button>
        </div>
      </div>
    </div>
  );
}

// ---- Styles (One Dark theme) ----

const containerStyle: CSSProperties = {
  display: "flex", flexDirection: "column", height: "100vh",
  background: "#282c34", color: "#abb2bf",
};

const headerStyle: CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "12px 20px", borderBottom: "1px solid #3e4451", flexShrink: 0,
};

const contentStyle: CSSProperties = {
  flex: 1, overflowY: "auto", padding: "16px 20px",
};

const sectionHeaderStyle: CSSProperties = {
  fontSize: 14, fontWeight: 700, color: "#c678dd", textTransform: "uppercase",
  padding: "8px 0 6px", borderBottom: "1px solid #3e4451", marginBottom: 8,
  letterSpacing: "0.05em",
};

const cardStyle: CSSProperties = {
  background: "#21252b", borderRadius: 6, border: "1px solid #3e4451",
  marginBottom: 8, overflow: "hidden",
};

const cardHeaderStyle: CSSProperties = {
  display: "flex", alignItems: "center", padding: "10px 16px",
  cursor: "pointer", userSelect: "none",
};

const bulletRowStyle: CSSProperties = {
  display: "flex", alignItems: "flex-start", padding: "4px 0",
  borderTop: "1px solid #2c313a",
};

const tagStyle: CSSProperties = {
  fontSize: 11, padding: "2px 6px", borderRadius: 3,
  background: "#2c313a", color: "#61afef", border: "1px solid #3e4451",
};

const smallBtnStyle: CSSProperties = {
  background: "none", border: "none", color: "#5c6370",
  cursor: "pointer", fontSize: 14, padding: "2px 4px", lineHeight: 1,
};

const actionBtnStyle: CSSProperties = {
  padding: "5px 12px", border: "1px solid #5c6370", borderRadius: 4,
  background: "transparent", color: "#abb2bf", cursor: "pointer", fontSize: 12,
};

const selectStyle: CSSProperties = {
  padding: "5px 8px", borderRadius: 4, border: "1px solid #3e4451",
  background: "#21252b", color: "#abb2bf", fontSize: 13,
};

const backBtnStyle: CSSProperties = {
  padding: "6px 14px", borderRadius: 4, border: "1px solid #61afef",
  background: "transparent", color: "#61afef", cursor: "pointer", fontSize: 13, fontWeight: 600,
};

const overlayStyle: CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
};

const modalStyle: CSSProperties = {
  background: "#282c34", borderRadius: 8, padding: 24, minWidth: 440,
  maxWidth: 560, border: "1px solid #3e4451",
  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
};

const labelStyle: CSSProperties = {
  display: "block", fontSize: 12, color: "#5c6370",
  marginBottom: 4, marginTop: 12,
};

const inputStyle: CSSProperties = {
  width: "100%", padding: "8px 10px", borderRadius: 4,
  border: "1px solid #3e4451", background: "#21252b", color: "#abb2bf",
  fontSize: 13, outline: "none",
};
