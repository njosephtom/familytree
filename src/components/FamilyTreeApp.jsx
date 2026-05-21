import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { saveFamilyTreePersons, saveUserTreeLayout } from "../utils/firestoreService";

/* ─────────────────────────────────────────
   DESIGN TOKENS  (FamilyEcho-inspired light)
───────────────────────────────────────── */
const T = {
  bg: "#eef2f7",
  canvas: "#f4f7fb",
  white: "#ffffff",
  maleFill: "#d6e8f7",
  maleBorder: "#7aaed6",
  maleText: "#1a4a7a",
  femaleFill: "#f7d6e4",
  femaleBorder: "#d67aaa",
  femaleText: "#7a1a4a",
  otherFill: "#d6f7e0",
  otherBorder: "#7ad69a",
  otherText: "#1a5a30",
  line: "#8aafc0",
  dot: "#4a7090",
  dotRing: "#a8c8de",
  panel: "#ffffff",
  panelBorder: "#dde6f0",
  text: "#1c2d3e",
  textSub: "#5a7a96",
  textMuted: "#8aafc0",
  accent: "#3a78c9",
  accentHover: "#2a60aa",
  red: "#d94f4f",
  toolbar: "#ffffff",
  toolbarBorder: "#d8e4ef",
  selected: "#3a78c9",
};

const CW = 140, CH = 58;
const HG = 210, VG = 170;
const DOT_R = 5;
const DROP = 36;
const SF = "'Nunito', 'Segoe UI', sans-serif";

const uid = () => Math.random().toString(36).slice(2, 9);

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;

  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getYearFromDateValue = (value) => {
  if (!value) return null;
  if (typeof value === "string") {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) return Number(dateOnly[1]);
  }
  const parsed = parseDateValue(value);
  return parsed ? parsed.getFullYear() : null;
};

const getAge = (dob) => {
  if (!dob) return null;
  const b = parseDateValue(dob);
  if (!b) return null;
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a;
};
const fmtDate = (d) =>
  parseDateValue(d)
    ? parseDateValue(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";
const cardColors = (sex) =>
  sex === "female"
    ? { fill: T.femaleFill, border: T.femaleBorder, text: T.femaleText }
    : sex === "male"
    ? { fill: T.maleFill, border: T.maleBorder, text: T.maleText }
    : { fill: T.otherFill, border: T.otherBorder, text: T.otherText };

/* ─────────────────────────────────────────
   STORAGE — keyed by treeId so multiple trees don't clash
───────────────────────────────────────── */
function storageKey(treeId) {
  return treeId ? `familyTreeV2_${treeId}` : 'familyTreeV2';
}

function loadPersons(treeId, initialPersons) {
  // initialPersons from Firestore takes priority
  if (initialPersons && initialPersons.length > 0) return initialPersons;
  try {
    const raw = localStorage.getItem(storageKey(treeId));
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }

  // Try migrating from old Redux format (only for default tree)
  if (!treeId) {
    try {
      const old = localStorage.getItem('familyTree');
      if (old) {
        const state = JSON.parse(old);
        const { people = {}, relationships = [], rootPersonId } = state;
        if (!Object.keys(people).length) return [];

        const persons = Object.values(people).map((p) => {
          const id = p.id;
          const childRels = relationships.filter((r) => r.fromId === id && r.type === 'child').map((r) => r.toId);
          const parentRels = relationships.filter((r) => r.toId === id && r.type === 'parent').map((r) => r.fromId)
            .concat(relationships.filter((r) => r.fromId === id && r.type === 'parent').map((r) => r.toId));
          const spouseRel = relationships.find((r) => (r.fromId === id || r.toId === id) && (r.type === 'spouse' || r.type === 'ex_spouse'));
          const spouse = spouseRel ? (spouseRel.fromId === id ? spouseRel.toId : spouseRel.fromId) : null;
          const siblingRels = relationships.filter((r) => r.fromId === id && r.type === 'sibling').map((r) => r.toId);

          return {
            id,
            name: `${p.givenNames || ''} ${p.surname || ''}`.trim() || 'Unknown',
            sex: p.gender === 'Male' ? 'male' : p.gender === 'Female' ? 'female' : 'other',
            dob: p.birthDate || '',
            dod: p.deathDate || '',
            job: p.profession || '',
            location: p.birthPlace || p.address || '',
            phone: p.phone || '',
            email: p.email || '',
            bio: p.bio || '',
            photo: p.photo || null,
            familyName: p.surname || '',
            exSpouses: [],
            parents: [...new Set(parentRels)],
            spouse,
            siblings: siblingRels,
            children: childRels,
            isRoot: id === rootPersonId,
          };
        });
        return persons;
      }
    } catch { /* ignore */ }
  }

  return [];
}

function savePersons(persons, treeId) {
  localStorage.setItem(storageKey(treeId), JSON.stringify(persons));
}

const SETTINGS_KEY = "familyTreeSettings";
const DEFAULT_SETTINGS = {
  tooltipFields: {
    photo:      true,
    firstName:  true,
    familyName: true,
    birthYear:  false,
    job:        false,
    deceased:   true,
  },
};
function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...saved, tooltipFields: { ...DEFAULT_SETTINGS.tooltipFields, ...(saved.tooltipFields ?? {}) } };
    }
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}
function saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

/* ─────────────────────────────────────────
   LAYOUT ALGORITHM
   – Top-down pass: children centered under their parents
   – Collision resolved by right-shift
   – Final shift centers entire tree at x = 0
───────────────────────────────────────── */
function computeLayout(persons) {
  if (!persons.length) return {};
  const pm = new Map(persons.map((p) => [p.id, p]));

  const SG = CW + 20; // tighter spacing between spouses (20 px gap)
  const areCouple = (id1, id2) =>
    pm.get(id1)?.spouse === id2 ||
    (pm.get(id1)?.exSpouses || []).includes(id2);

  // Build bidirectional parent-child graph
  const childSet  = new Map(persons.map((p) => [p.id, new Set()]));
  const parentSet = new Map(persons.map((p) => [p.id, new Set()]));
  persons.forEach((p) => {
    (p.children || []).forEach((cid) => {
      if (!pm.has(cid)) return;
      childSet.get(p.id).add(cid);
      parentSet.get(cid).add(p.id);
    });
    (p.parents || []).forEach((pid) => {
      if (!pm.has(pid)) return;
      childSet.get(pid).add(p.id);
      parentSet.get(p.id).add(pid);
    });
  });

  // BFS / relaxation generation assignment (spouses same gen, children +1)
  // Safety cap: each node can be relaxed at most N times (handles cycles gracefully)
  const genMap   = new Map();
  const queue    = [];
  const inQ      = new Set();
  const relaxed  = new Map(); // relaxation count per node
  persons.forEach((p) => {
    if (parentSet.get(p.id).size === 0) {
      genMap.set(p.id, 0); queue.push(p.id); inQ.add(p.id);
    }
  });
  if (!queue.length) { genMap.set(persons[0].id, 0); queue.push(persons[0].id); inQ.add(persons[0].id); }
  const MAX_RELAX = persons.length; // Bellman-Ford bound — enough for any acyclic graph

  while (queue.length) {
    const id = queue.shift(); inQ.delete(id);
    const visits = (relaxed.get(id) ?? 0) + 1;
    relaxed.set(id, visits);
    if (visits > MAX_RELAX) continue; // cycle detected — stop relaxing this node
    const g  = genMap.get(id);
    const p  = pm.get(id);
    [p?.spouse, ...(p?.exSpouses || [])].forEach((sid) => {
      if (sid && pm.has(sid) && (genMap.get(sid) ?? -1) < g) {
        genMap.set(sid, g);
        if (!inQ.has(sid)) { queue.push(sid); inQ.add(sid); }
      }
    });
    childSet.get(id).forEach((cid) => {
      if ((genMap.get(cid) ?? -1) < g + 1) {
        genMap.set(cid, g + 1);
        if (!inQ.has(cid)) { queue.push(cid); inQ.add(cid); }
      }
    });
  }
  persons.forEach((p) => { if (!genMap.has(p.id)) genMap.set(p.id, 0); });

  // Group by generation; keep spouses/ex-spouses adjacent
  const byGen = new Map();
  persons.forEach((p) => {
    const g = genMap.get(p.id);
    if (!byGen.has(g)) byGen.set(g, []);
    if (!byGen.get(g).includes(p.id)) byGen.get(g).push(p.id);
  });
  byGen.forEach((ids) => {
    const out = [], done = new Set();
    ids.forEach((id) => {
      if (done.has(id)) return;
      out.push(id); done.add(id);
      // Attach spouse then ex-spouses immediately after
      const sp = pm.get(id)?.spouse;
      if (sp && ids.includes(sp) && !done.has(sp)) { out.push(sp); done.add(sp); }
      (pm.get(id)?.exSpouses || []).forEach((exId) => {
        if (ids.includes(exId) && !done.has(exId)) { out.push(exId); done.add(exId); }
      });
    });
    ids.splice(0, ids.length, ...out);
  });

  // Helper: compute span of a group respecting spouse gaps
  const groupSpan = (gids) =>
    gids.slice(1).reduce((acc, id, i) => acc + (areCouple(gids[i], id) ? SG : HG), 0);

  // TOP-DOWN x placement
  const xMap = new Map();
  [...byGen.keys()].sort((a, b) => a - b).forEach((g) => {
    const ids = byGen.get(g);

    if (g === 0) {
      // Root generation: sequential with spouse-aware spacing, centered at x=0
      let cursor = 0;
      ids.forEach((id, i) => {
        xMap.set(id, cursor);
        if (i < ids.length - 1) cursor += areCouple(id, ids[i + 1]) ? SG : HG;
      });
      const xs0 = ids.map((id) => xMap.get(id));
      const c0  = (Math.min(...xs0) + Math.max(...xs0) + CW) / 2;
      ids.forEach((id) => xMap.set(id, xMap.get(id) - c0));
      return;
    }

    // Group children by their parent-couple key (sorted parent ids)
    const groupMap = new Map();
    ids.forEach((id) => {
      const pids = [...parentSet.get(id)].filter((pid) => xMap.has(pid)).sort();
      const key  = pids.length ? pids.join("~") : `__orphan_${id}`;
      if (!groupMap.has(key)) {
        const parentXs = pids.map((pid) => xMap.get(pid));
        const cx = parentXs.length
          ? (Math.min(...parentXs) + Math.max(...parentXs) + CW) / 2
          : null;
        groupMap.set(key, { parentCenterX: cx, ids: [] });
      }
      groupMap.get(key).ids.push(id);
    });

    // Sort groups by parent center x (orphans last)
    const sortedGroups = [...groupMap.values()].sort((a, b) => {
      if (a.parentCenterX === null) return 1;
      if (b.parentCenterX === null) return -1;
      return a.parentCenterX - b.parentCenterX;
    });

    // Tentative placement: center each sibling group under its parents
    // Orphan groups snap next to their spouse if already placed
    const nodes = [];
    sortedGroups.forEach(({ parentCenterX, ids: gids }) => {
      const span = groupSpan(gids);
      let start;
      if (parentCenterX !== null) {
        start = parentCenterX - span / 2;
      } else {
        // Orphan: snap right next to a placed spouse
        let spouseX = null;
        for (const id of gids) {
          const spNode = nodes.find((n) => areCouple(id, n.id));
          if (spNode) { spouseX = spNode.x + SG; break; }
        }
        start = spouseX ?? 0;
      }
      let x = start;
      gids.forEach((id, i) => {
        if (i > 0) x += areCouple(gids[i - 1], id) ? SG : HG;
        nodes.push({ id, x });
      });
    });

    // Sort by tentative x, then resolve collisions with spouse-aware minimum gap
    nodes.sort((a, b) => a.x - b.x);
    for (let i = 1; i < nodes.length; i++) {
      const minGap = areCouple(nodes[i - 1].id, nodes[i].id) ? SG : HG;
      if (nodes[i].x < nodes[i - 1].x + minGap) nodes[i].x = nodes[i - 1].x + minGap;
    }
    nodes.forEach(({ id, x }) => xMap.set(id, x));
  });

  // Shift entire tree so its visual center is at x = 0
  const allX = [...xMap.values()];
  if (allX.length > 1) {
    const shift = -(Math.min(...allX) + Math.max(...allX) + CW) / 2;
    xMap.forEach((x, id) => xMap.set(id, x + shift));
  }

  const pos = {};
  persons.forEach((p) => {
    pos[p.id] = { x: xMap.get(p.id) ?? 0, y: (genMap.get(p.id) ?? 0) * VG };
  });
  return pos;
}

/* ─────────────────────────────────────────
   HELPERS — generation map + isolate set
───────────────────────────────────────── */
function computeGenMap(persons) {
  if (!persons.length) return new Map();
  const pm = new Map(persons.map((p) => [p.id, p]));
  const gen = new Map();
  persons.forEach((p) => {
    if (!(p.parents || []).some((pid) => pm.has(pid))) gen.set(p.id, 0);
  });
  if (!gen.size) gen.set(persons[0].id, 0);
  // Relaxation-count guard: each node updated at most N times (cycle-safe Bellman-Ford)
  const relaxCount = new Map();
  const MAX_R = persons.length;
  let dirty = true;
  while (dirty) {
    dirty = false;
    persons.forEach((p) => {
      if ((relaxCount.get(p.id) ?? 0) >= MAX_R) return;
      const pg = (p.parents || []).map((pid) => gen.get(pid)).filter((v) => v != null);
      if (!pg.length) return;
      const next = Math.max(...pg) + 1;
      if ((gen.get(p.id) ?? -1) < next) {
        gen.set(p.id, next);
        relaxCount.set(p.id, (relaxCount.get(p.id) ?? 0) + 1);
        dirty = true;
      }
    });
  }
  dirty = true;
  while (dirty) {
    dirty = false;
    persons.forEach((p) => {
      const g = gen.get(p.id);
      if (g == null) return;
      if (p.spouse && pm.has(p.spouse) && (gen.get(p.spouse) ?? -1) < g) {
        gen.set(p.spouse, g); dirty = true;
      }
    });
  }
  persons.forEach((p) => { if (!gen.has(p.id)) gen.set(p.id, 0); });
  return gen;
}

function getIsolateSet(personId, persons) {
  if (!personId) return null;
  const pm = new Map(persons.map((p) => [p.id, p]));
  const p = pm.get(personId);
  if (!p) return null;
  const vis = new Set([personId]);

  // Parents + grandparents
  (p.parents || []).forEach((id) => {
    if (!pm.has(id)) return;
    vis.add(id);
    // Grandparents (parent's parents)
    (pm.get(id).parents || []).forEach((gid) => pm.has(gid) && vis.add(gid));
  });

  // Spouse + in-laws (spouse's parents)
  if (p.spouse && pm.has(p.spouse)) {
    vis.add(p.spouse);
    const spouse = pm.get(p.spouse);
    (spouse.parents || []).forEach((id) => pm.has(id) && vis.add(id));
  }

  // Siblings
  (p.siblings || []).forEach((id) => pm.has(id) && vis.add(id));

  // All descendants recursively — children, grandchildren, etc. + each one's spouse
  const addDescendants = (id) => {
    const person = pm.get(id);
    if (!person) return;
    (person.children || []).forEach((cid) => {
      if (!pm.has(cid) || vis.has(cid)) return;
      vis.add(cid);
      const child = pm.get(cid);
      if (child.spouse && pm.has(child.spouse)) vis.add(child.spouse);
      addDescendants(cid);
    });
  };
  addDescendants(personId);
  // Also walk descendants via the spouse (shared children already guarded by vis.has check)
  if (p.spouse && pm.has(p.spouse)) addDescendants(p.spouse);

  return vis;
}

/* ─────────────────────────────────────────
   TREE LINES
   parent1 ──── ● ──── parent2
                |
        ────────────── (sibling bar)
        |       |      |
      child   child  child
───────────────────────────────────────── */
function TreeLines({ persons, pos }) {
  const pm = new Map(persons.map((p) => [p.id, p]));
  const els = [];
  const drawnCouples = new Set();

  // Build implicit-couple map: parents who share children but have no explicit spouse link.
  // Key: "idA~idB" (sorted); Value: Set of shared child IDs.
  const implicitCouples = new Map();
  persons.forEach((p) => {
    (p.children || []).forEach((cid) => {
      const child = pm.get(cid);
      if (!child) return;
      (child.parents || []).forEach((pid) => {
        if (pid === p.id || !pos[pid] || !pos[p.id]) return;
        const other = pm.get(pid);
        if (!other) return;
        // Skip if they are already an explicit couple
        if (p.spouse === pid || other.spouse === p.id) return;
        const pairKey = [p.id, pid].sort().join("~");
        if (!implicitCouples.has(pairKey)) implicitCouples.set(pairKey, new Set());
        implicitCouples.get(pairKey).add(cid);
      });
    });
  });

  // Helper: render a couple group (connector + dot + children) given two parent positions.
  function renderCoupleGroup(key, posA, posB, allChildren) {
    const [lx, lNodeY, rx, rNodeY] =
      posA.x < posB.x
        ? [posA.x + CW, posA.y + CH / 2, posB.x, posB.y + CH / 2]
        : [posB.x + CW, posB.y + CH / 2, posA.x, posA.y + CH / 2];
    const dotX = (lx + rx) / 2;
    const dotY = (lNodeY + rNodeY) / 2;
    const childPositions = allChildren.map((c) => pos[c]).filter(Boolean);
    return (
      <g key={key}>
        <line x1={lx} y1={lNodeY} x2={dotX - DOT_R - 1} y2={dotY} stroke={T.line} strokeWidth={1.5} />
        <line x1={dotX + DOT_R + 1} y1={dotY} x2={rx} y2={rNodeY} stroke={T.line} strokeWidth={1.5} />
        <circle cx={dotX} cy={dotY} r={DOT_R + 3} fill={T.dotRing} opacity={0.6} />
        <circle cx={dotX} cy={dotY} r={DOT_R} fill={T.dot} />
        {allChildren.length > 0 && childPositions.length > 0 && (() => {
          const junctionY = dotY + DROP;
          const cxArr = childPositions.map((cp) => cp.x + CW / 2);
          const barLeft  = Math.min(...cxArr, dotX);
          const barRight = Math.max(...cxArr, dotX);
          return (
            <g>
              <line x1={dotX} y1={dotY + DOT_R} x2={dotX} y2={junctionY} stroke={T.line} strokeWidth={1.5} />
              <line x1={barLeft} y1={junctionY} x2={barRight} y2={junctionY} stroke={T.line} strokeWidth={1.5} />
              {allChildren.map((cid) => {
                const cp = pos[cid];
                if (!cp) return null;
                const cx = cp.x + CW / 2;
                return <line key={`ch~${cid}`} x1={cx} y1={junctionY} x2={cx} y2={cp.y} stroke={T.line} strokeWidth={1.5} />;
              })}
            </g>
          );
        })()}
      </g>
    );
  }

  persons.forEach((p) => {
    const pp = pos[p.id];
    if (!pp) return;

    if (p.spouse) {
      const key = [p.id, p.spouse].sort().join("~");
      if (!drawnCouples.has(key)) {
        drawnCouples.add(key);
        const sp = pos[p.spouse];
        if (sp) {
          const spouseObj = pm.get(p.spouse);
          const allChildren = [...new Set([...(p.children || []), ...(spouseObj?.children || [])])];
          els.push(renderCoupleGroup(`couple~${key}`, pp, sp, allChildren));
        }
      }
    }

    // Single parent (no spouse) with children
    const soloChildren = (p.children || []).filter((cid) => {
      const child = pm.get(cid);
      if (!child) return false;
      const otherParents = (child.parents || []).filter((pid) => pid !== p.id && pos[pid]);
      return otherParents.length === 0;
    });

    if (soloChildren.length > 0 && !p.spouse) {
      const px = pp.x + CW / 2;
      const py = pp.y + CH;
      const junctionY = py + DROP;
      const cxArr = soloChildren.map((c) => pos[c]).filter(Boolean).map((cp) => cp.x + CW / 2);
      if (cxArr.length > 0) {
        const barLeft  = Math.min(...cxArr, px);
        const barRight = Math.max(...cxArr, px);
        els.push(
          <g key={`solo~${p.id}`}>
            <line x1={px} y1={py} x2={px} y2={junctionY} stroke={T.line} strokeWidth={1.5} />
            <line x1={barLeft} y1={junctionY} x2={barRight} y2={junctionY} stroke={T.line} strokeWidth={1.5} />
            {soloChildren.map((cid) => {
              const cp = pos[cid];
              if (!cp) return null;
              const cx = cp.x + CW / 2;
              return (
                <line key={`sc~${cid}`} x1={cx} y1={junctionY} x2={cx} y2={cp.y} stroke={T.line} strokeWidth={1.5} />
              );
            })}
          </g>
        );
      }
    }
  });

  // Draw implicit couples (parents sharing children but with no explicit spouse link).
  implicitCouples.forEach((childrenSet, pairKey) => {
    if (drawnCouples.has(pairKey)) return;
    drawnCouples.add(pairKey);
    const [idA, idB] = pairKey.split("~");
    const posA = pos[idA], posB = pos[idB];
    if (!posA || !posB) return;
    const allChildren = [...childrenSet];
    els.push(renderCoupleGroup(`implicit~${pairKey}`, posA, posB, allChildren));
  });

  return <g>{els}</g>;
}

/* ─────────────────────────────────────────
   PERSON CARD
───────────────────────────────────────── */
function PersonCard({ person, selected, onClick, onContextMenu, onHoverStart, onHoverEnd, onDragStart, draggable: isDraggable, generation, dimmed }) {
  const [hov, setHov] = useState(false);
  const c = cardColors(person.sex);
  const isActive = selected || hov;
  const isDead = !!person.dod;
  const initials = person.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div
      data-card="true"
      onMouseDown={(e) => { if (onDragStart) onDragStart(e); }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={(e) => { if (!dimmed) { setHov(true); onHoverStart?.(e); } }}
      onMouseLeave={() => { setHov(false); onHoverEnd?.(); }}
      style={{
        width: CW, height: CH,
        background: isDead ? "#e8eaed" : c.fill,
        border: `2px solid ${selected ? T.selected : isDead ? "#9aa0a6" : c.border}`,
        borderRadius: 10,
        display: "flex", alignItems: "center",
        padding: "0 10px", gap: 9,
        cursor: isDraggable ? "move" : "pointer", userSelect: "none",
        position: "relative",
        boxShadow: selected
          ? `0 0 0 3px ${T.selected}40, 0 4px 14px rgba(0,0,0,0.15)`
          : isActive ? "0 4px 12px rgba(0,0,0,0.14)" : "0 2px 6px rgba(0,0,0,0.08)",
        transform: hov && !selected && !dimmed ? "translateY(-2px)" : "none",
        transition: "all 0.15s ease",
        filter: !dimmed && isDead ? "saturate(0.3)" : "none",
        opacity: dimmed ? 0.15 : isDead ? 0.78 : 1,
        boxSizing: "border-box",
        fontFamily: SF,
      }}
    >
      {isDead && <div style={{ position: "absolute", top: 3, right: 5, fontSize: 8, color: "#777", fontWeight: 800 }}>†</div>}
      {generation != null && (
        <div style={{ position: "absolute", bottom: 2, left: 7, fontSize: 7, color: c.text, opacity: 0.45, fontWeight: 800, letterSpacing: 0.2, pointerEvents: "none" }}>
          Gen {generation + 1}
        </div>
      )}
      <div style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
        background: person.photo ? "transparent" : `${c.border}40`,
        border: `1.5px solid ${c.border}`,
        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {person.photo
          ? <img src={person.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
          : <span style={{ color: c.text, fontSize: 11, fontWeight: 800 }}>{initials}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: c.text, fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.3 }}>
          {person.name}
        </div>
        {person.dob && (
          <div style={{ color: c.text, fontSize: 10, opacity: 0.65, marginTop: 1 }}>
            b. {getYearFromDateValue(person.dob)}
          </div>
        )}
        {person.job && (
          <div style={{ color: c.text, fontSize: 9, opacity: 0.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {person.job}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   SETTINGS MODAL
───────────────────────────────────────── */
function SettingsModal({ settings, onChange, onClose, onDeleteTree, treeName }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const TOOLTIP_FIELDS = [
    { key: "photo",       label: "Photo / Avatar" },
    { key: "firstName",   label: "First Name" },
    { key: "familyName",  label: "Family Name" },
    { key: "birthYear",   label: "Birth Year" },
    { key: "job",         label: "Occupation" },
    { key: "deceased",    label: "Deceased Tag (†)" },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, fontFamily: SF }}>
      <div style={{ background: T.white, borderRadius: 16, padding: 28, width: 380, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 16px 48px rgba(0,0,0,0.22)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div style={{ color: T.text, fontSize: 17, fontWeight: 800 }}>⚙️ Settings</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: T.textMuted, lineHeight: 1, padding: "0 4px" }}>×</button>
        </div>
        <div style={{ color: T.textSub, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>Hover Card Fields</div>
        <div style={{ background: T.bg, borderRadius: 10, padding: "4px 14px", marginBottom: 22 }}>
          {TOOLTIP_FIELDS.map(({ key, label }, i) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", cursor: "pointer", borderBottom: i < TOOLTIP_FIELDS.length - 1 ? `1px solid ${T.panelBorder}` : "none" }}>
              <input
                type="checkbox"
                checked={!!settings.tooltipFields?.[key]}
                onChange={(e) => onChange({
                  ...settings,
                  tooltipFields: { ...settings.tooltipFields, [key]: e.target.checked },
                })}
                style={{ width: 16, height: 16, cursor: "pointer", accentColor: T.accent }}
              />
              <span style={{ color: T.text, fontSize: 13, fontWeight: 600 }}>{label}</span>
            </label>
          ))}
        </div>
        <button onClick={onClose} style={{ width: "100%", background: T.accent, color: "#fff", border: "none", borderRadius: 10, padding: "11px 0", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
          Done
        </button>
        {onDeleteTree && (
          <div style={{ marginTop: 18, borderTop: `1px solid ${T.panelBorder}`, paddingTop: 16 }}>
            <div style={{ color: T.red, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 }}>⚠️ Danger Zone</div>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                style={{ width: "100%", background: "none", border: `1.5px solid ${T.red}`, color: T.red, borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                🗑 Delete This Family Tree
              </button>
            ) : (
              <div style={{ background: "#fff1f1", border: `1px solid ${T.red}`, borderRadius: 8, padding: 14 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
                  Delete “{treeName || "this tree"}”? All members will be permanently removed and this cannot be undone.
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    style={{ flex: 1, background: "none", border: `1px solid ${T.panelBorder}`, color: T.textSub, borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onDeleteTree}
                    style={{ flex: 1, background: T.red, border: "none", color: "#fff", borderRadius: 8, padding: "8px 0", fontSize: 13, fontWeight: 800, cursor: "pointer" }}
                  >
                    Yes, Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   HOVER TOOLTIP
───────────────────────────────────────── */
function HoverTooltip({ person, x, y, fields }) {
  const f = fields ?? { photo: true, firstName: true, familyName: true, deceased: true };
  const c = cardColors(person.sex);
  const firstName = person.name.split(" ")[0];
  const initials = person.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{
      position: "fixed",
      left: Math.min(x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 230),
      top: y - 10,
      transform: "translateY(-100%)",
      background: T.white,
      border: `1.5px solid ${c.border}`,
      borderRadius: 12,
      padding: "10px 14px",
      boxShadow: "0 8px 28px rgba(0,0,0,0.18)",
      display: "flex", alignItems: "center", gap: f.photo ? 10 : 6,
      zIndex: 900,
      pointerEvents: "none",
      fontFamily: SF,
      minWidth: 110,
    }}>
      {f.photo && (
        <div style={{ width: 42, height: 42, borderRadius: "50%", flexShrink: 0, background: person.photo ? "transparent" : `${c.border}40`, border: `2px solid ${c.border}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {person.photo
            ? <img src={person.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
            : <span style={{ color: c.text, fontSize: 13, fontWeight: 800 }}>{initials}</span>}
        </div>
      )}
      <div>
        {f.firstName && <div style={{ color: c.text, fontSize: 14, fontWeight: 800, lineHeight: 1.2 }}>{firstName}</div>}
        {f.familyName && person.familyName && <div style={{ color: T.textMuted, fontSize: 11, fontWeight: 600 }}>{person.familyName}</div>}
        {f.birthYear && person.dob && <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 600 }}>b. {getYearFromDateValue(person.dob)}</div>}
        {f.job && person.job && <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 600 }}>{person.job}</div>}
        {f.deceased && person.dod && <div style={{ color: "#b91c1c", fontSize: 10, fontWeight: 700, marginTop: 3 }}>† Deceased</div>}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   PERSON POPUP (centered modal on card click)
───────────────────────────────────────── */
function PersonPopup({ person, persons, onClose, onEdit, onDelete, onAddMember }) {
  const pm = new Map(persons.map((p) => [p.id, p]));
  const c = cardColors(person.sex);
  const age = getAge(person.dob);
  const spouse = person.spouse ? pm.get(person.spouse) : null;
  const parentInLawIds = spouse?.parents || [];
  const siblingInLawIds = Array.from(new Set([
    ...(spouse?.siblings || []),
    ...(person.siblings || []).map((id) => pm.get(id)?.spouse).filter(Boolean),
  ])).filter((id) => id !== person.id);
  const siblingInLaws = siblingInLawIds.map((id) => pm.get(id)).filter(Boolean);
  const [confirmDel, setConfirmDel] = useState(false);

  const initials = person.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  const Mini = ({ p, role }) => {
    if (!p) return null;
    const mc = cardColors(p.sex);
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
        background: mc.fill, border: `1px solid ${mc.border}`, borderRadius: 8, marginBottom: 6,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
          background: p.photo ? "transparent" : `${mc.border}40`,
          border: `1.5px solid ${mc.border}`, overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {p.photo
            ? <img src={p.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
            : <span style={{ color: mc.text, fontSize: 9, fontWeight: 800 }}>
                {p.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
              </span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: mc.text, fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
          <div style={{ color: mc.text, fontSize: 10, opacity: 0.65, textTransform: "capitalize" }}>
            {role}{p.dob ? ` · b.${getYearFromDateValue(p.dob)}` : ""}
          </div>
        </div>
      </div>
    );
  };

  const FamilySection = ({ label, icon, ids, role }) => {
    const rels = (ids || []).map((id) => pm.get(id)).filter(Boolean);
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {icon} {label}
          </span>
          <button
            onClick={() => onAddMember(person.id, role.toLowerCase())}
            style={{ background: "none", border: `1px solid ${T.panelBorder}`, color: T.accent, borderRadius: 5, padding: "2px 9px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}
          >
            + Add
          </button>
        </div>
        {rels.length === 0
          ? <div style={{ color: T.textMuted, fontSize: 11, fontStyle: "italic", padding: "4px 0" }}>None recorded</div>
          : rels.map((r) => <Mini key={r.id} p={r} role={role} />)}
      </div>
    );
  };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(20,40,70,0.40)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 20, fontFamily: SF }}
    >
      <div style={{ background: T.white, borderRadius: 18, width: "100%", maxWidth: 500, maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", border: `1px solid ${T.panelBorder}`, boxShadow: "0 28px 72px rgba(0,0,0,0.20)" }}>

        {/* ── Header ── */}
        <div style={{ padding: "22px 24px 16px", background: `linear-gradient(135deg, ${c.fill} 0%, ${T.white} 65%)`, borderBottom: `1px solid ${T.panelBorder}` }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ width: 66, height: 66, borderRadius: "50%", flexShrink: 0, background: person.photo ? "transparent" : `${c.border}40`, border: `3px solid ${c.border}`, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {person.photo
                ? <img src={person.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                : <span style={{ color: c.text, fontSize: 20, fontWeight: 800 }}>{initials}</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ color: c.text, fontSize: 20, fontWeight: 800, lineHeight: 1.2, marginBottom: 6 }}>{person.name}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                <span style={{ background: c.border, color: "#fff", borderRadius: 5, padding: "2px 10px", fontSize: 11, fontWeight: 700, textTransform: "capitalize" }}>{person.sex || "—"}</span>
                {age !== null && <span style={{ background: T.bg, color: T.textSub, borderRadius: 5, padding: "2px 10px", fontSize: 11, fontWeight: 600, border: `1px solid ${T.panelBorder}` }}>{age} yrs</span>}
                {person.job && <span style={{ background: T.bg, color: T.textSub, borderRadius: 5, padding: "2px 10px", fontSize: 11, fontWeight: 600, border: `1px solid ${T.panelBorder}` }}>💼 {person.job}</span>}
                {person.dod && <span style={{ background: "#fee2e2", color: "#991b1b", borderRadius: 5, padding: "2px 10px", fontSize: 11, fontWeight: 600 }}>Deceased</span>}
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 26, cursor: "pointer", lineHeight: 1, padding: 0, marginTop: -4, flexShrink: 0 }}>×</button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>

          {/* Info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
            {[
              { icon: "🎂", label: "Born",     val: fmtDate(person.dob) },
              { icon: "✝️", label: "Died",     val: person.dod ? fmtDate(person.dod) : null },
              { icon: "📍", label: "Location", val: person.location },
              { icon: "📞", label: "Phone",    val: person.phone },
              { icon: "✉️", label: "Email",    val: person.email },
              { icon: "🏠", label: "Family",   val: person.familyName },
            ].map(({ icon, label, val }) =>
              val ? (
                <div key={label} style={{ background: T.bg, borderRadius: 8, padding: "9px 11px", border: `1px solid ${T.panelBorder}` }}>
                  <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 3 }}>{icon} {label}</div>
                  <div style={{ color: T.text, fontSize: 12, fontWeight: 600, wordBreak: "break-all" }}>{val}</div>
                </div>
              ) : null
            )}
          </div>

          {/* Bio */}
          {person.bio && (
            <div style={{ marginBottom: 20, background: T.bg, borderRadius: 8, padding: "10px 13px", border: `1px solid ${T.panelBorder}` }}>
              <div style={{ color: T.textMuted, fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>📝 Notes</div>
              <p style={{ margin: 0, color: T.text, fontSize: 12, lineHeight: 1.7 }}>{person.bio}</p>
            </div>
          )}

          {/* Family */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ color: T.text, fontSize: 13, fontWeight: 800, marginBottom: 12, paddingBottom: 6, borderBottom: `1.5px solid ${T.panelBorder}` }}>👨‍👩‍👧‍👦 Family</div>
            {/* Spouse */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>💑 Spouse</span>
                {!spouse && <button onClick={() => onAddMember(person.id, "spouse")} style={{ background: "none", border: `1px solid ${T.panelBorder}`, color: T.accent, borderRadius: 5, padding: "2px 9px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>+ Add</button>}
              </div>
              {spouse ? <Mini p={spouse} role="Spouse" /> : <div style={{ color: T.textMuted, fontSize: 11, fontStyle: "italic", padding: "4px 0" }}>None recorded</div>}
            </div>
            {/* Ex-Spouses */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em" }}>💔 Ex-Spouse(s)</span>
                <button onClick={() => onAddMember(person.id, "exSpouse")} style={{ background: "none", border: `1px solid ${T.panelBorder}`, color: T.accent, borderRadius: 5, padding: "2px 9px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>+ Add</button>
              </div>
              {(person.exSpouses || []).length === 0
                ? <div style={{ color: T.textMuted, fontSize: 11, fontStyle: "italic", padding: "4px 0" }}>None recorded</div>
                : (person.exSpouses || []).map((id) => { const ex = pm.get(id); return ex ? <Mini key={id} p={ex} role="Ex-Spouse" /> : null; })}
            </div>
            <FamilySection label="Parents"  icon="👶" ids={person.parents}  role="Parent"  />
            <FamilySection label="Siblings" icon="🤝" ids={person.siblings} role="Sibling" />
            <FamilySection label="Children" icon="⭐" ids={person.children} role="Child"   />
            {/* In-Laws (derived from spouse's family and siblings' spouses) */}
            {(parentInLawIds.some((id) => pm.has(id)) || siblingInLaws.length > 0) && (
              <div style={{ marginTop: 8 }}>
                <div style={{ color: T.text, fontSize: 13, fontWeight: 800, marginBottom: 12, paddingBottom: 6, borderBottom: `1.5px solid ${T.panelBorder}` }}>🤝 In-Laws</div>
                {parentInLawIds.some((id) => pm.has(id)) && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>👨‍👩‍👦 Parents-in-Law</div>
                    {parentInLawIds.map((id) => { const inlaw = pm.get(id); return inlaw ? <Mini key={id} p={inlaw} role="Parent-in-Law" /> : null; })}
                  </div>
                )}
                {siblingInLaws.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>🤝 Siblings-in-Law</div>
                    {siblingInLaws.map((inlaw) => <Mini key={inlaw.id} p={inlaw} role="Sibling-in-Law" />)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.panelBorder}`, display: "flex", gap: 8, background: `${T.bg}88` }}>
          <button onClick={() => onEdit(person)} style={{ flex: 1, background: T.accent, border: "none", color: "#fff", borderRadius: 8, padding: "9px 0", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
            ✏️ Edit
          </button>
          {!confirmDel
            ? <button onClick={() => setConfirmDel(true)} style={{ background: "none", border: `1px solid ${T.panelBorder}`, color: T.textMuted, borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>🗑️ Delete</button>
            : <button onClick={() => { onDelete(person.id); setConfirmDel(false); }} style={{ background: `${T.red}15`, border: `1.5px solid ${T.red}`, color: T.red, borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>Confirm Delete</button>}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   FORM MODAL
───────────────────────────────────────── */
function FormModal({ initial, persons, onSave, onClose }) {
  const isNew = !initial?.id;
  const pm = new Map(persons.map((p) => [p.id, p]));
  const blank = { name: "", familyName: "", dob: "", dod: "", sex: "male", job: "", location: "", phone: "", email: "", bio: "", photo: null, parents: [], spouse: null, exSpouses: [], siblings: [], children: [] };
  const [form, setForm] = useState({ ...blank, ...initial });
  const [preview, setPreview] = useState(initial?.photo || null);
  const [tab, setTab] = useState("details");
  const [relType, setRelType] = useState("parent");
  const [search, setSearch] = useState("");
  const fileRef = useRef();

  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = (ev) => { setPreview(ev.target.result); upd("photo", ev.target.result); };
    r.readAsDataURL(file);
  };

  const toggleRel = (type, id) => {
    if (type === "spouse") { upd("spouse", form.spouse === id ? null : id); return; }
    if (type === "exSpouse") {
      const arr = form.exSpouses || [];
      upd("exSpouses", arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
      return;
    }
    const k = type === "parent" ? "parents" : type === "sibling" ? "siblings" : "children";
    const arr = form[k] || [];
    upd(k, arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  };
  const isOn = (type, id) => {
    if (type === "spouse") return form.spouse === id;
    if (type === "exSpouse") return (form.exSpouses || []).includes(id);
    return (form[type === "parent" ? "parents" : type === "sibling" ? "siblings" : "children"] || []).includes(id);
  };

  const others = persons.filter((p) => p.id !== form.id && p.name.toLowerCase().includes(search.toLowerCase()));
  const curRels = [
    ...(form.parents   || []).map((id) => ({ id, type: "parent",   label: "Parent"    })),
    ...(form.spouse ? [{ id: form.spouse, type: "spouse",   label: "Spouse"    }] : []),
    ...(form.exSpouses || []).map((id) => ({ id, type: "exSpouse", label: "Ex-Spouse" })),
    ...(form.siblings  || []).map((id) => ({ id, type: "sibling",  label: "Sibling"   })),
    ...(form.children  || []).map((id) => ({ id, type: "child",    label: "Child"     })),
  ];

  const INP = { width: "100%", background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.text, borderRadius: 7, padding: "8px 11px", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: SF };
  const LBL = { display: "block", color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontFamily: SF };

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: "fixed", inset: 0, background: "rgba(20,40,70,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600, padding: 20, fontFamily: SF }}
    >
      <div style={{ background: T.white, borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", border: `1px solid ${T.panelBorder}`, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
        {/* Modal header */}
        <div style={{ padding: "20px 24px 14px", borderBottom: `1px solid ${T.panelBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: `linear-gradient(135deg,${T.bg} 0%,${T.white} 60%)` }}>
          <h3 style={{ margin: 0, color: T.text, fontSize: 20, fontWeight: 800 }}>
            {isNew ? "➕ Add Family Member" : `✏️ Edit · ${initial.name}`}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: `1px solid ${T.panelBorder}` }}>
          {[["details", "👤 Details"], ["photo", "📷 Photo"], ["rels", "🔗 Relationships"]].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "11px 0", background: "none", border: "none",
              borderBottom: `2.5px solid ${tab === t ? T.accent : "transparent"}`,
              color: tab === t ? T.accent : T.textMuted,
              cursor: "pointer", fontSize: 12, fontWeight: 700, transition: "all 0.13s",
            }}>{l}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>
          {tab === "details" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={LBL}>Full Name *</label>
                  <input style={INP} value={form.name} onChange={(e) => upd("name", e.target.value)} placeholder="e.g. Jane" />
                </div>
                <div>
                  <label style={LBL}>Family Name</label>
                  <input style={INP} value={form.familyName || ""} onChange={(e) => upd("familyName", e.target.value)} placeholder="e.g. Smith" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={LBL}>Date of Birth</label><input style={INP} type="date" value={form.dob} onChange={(e) => upd("dob", e.target.value)} /></div>
                <div><label style={LBL}>Date of Death</label><input style={INP} type="date" value={form.dod} onChange={(e) => upd("dod", e.target.value)} /></div>
              </div>
              <div>
                <label style={LBL}>Sex</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["male", "female", "other"].map((s) => {
                    const sc = cardColors(s);
                    return (
                      <button key={s} onClick={() => upd("sex", s)} style={{
                        flex: 1, padding: "8px 0", background: form.sex === s ? sc.fill : T.bg,
                        border: `2px solid ${form.sex === s ? sc.border : T.panelBorder}`,
                        color: form.sex === s ? sc.text : T.textMuted,
                        borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700,
                        textTransform: "capitalize", transition: "all 0.13s",
                      }}>{s}</button>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><label style={LBL}>Occupation</label><input style={INP} value={form.job} onChange={(e) => upd("job", e.target.value)} placeholder="e.g. Teacher" /></div>
                <div><label style={LBL}>Location</label><input style={INP} value={form.location} onChange={(e) => upd("location", e.target.value)} placeholder="City, Country" /></div>
              </div>
              <div><label style={LBL}>Phone</label><input style={INP} value={form.phone} onChange={(e) => upd("phone", e.target.value)} placeholder="+1 555 000 0000" /></div>
              <div><label style={LBL}>Email</label><input style={INP} type="email" value={form.email || ""} onChange={(e) => upd("email", e.target.value)} placeholder="email@example.com" /></div>
              <div><label style={LBL}>Bio / Notes</label><textarea style={{ ...INP, minHeight: 70, resize: "vertical" }} value={form.bio} onChange={(e) => upd("bio", e.target.value)} placeholder="Short biography..." /></div>
            </div>
          )}

          {tab === "photo" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, padding: "16px 0" }}>
              <div
                onClick={() => fileRef.current.click()}
                style={{ width: 140, height: 140, borderRadius: "50%", border: `3px dashed ${T.panelBorder}`, background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: "pointer" }}
              >
                {preview
                  ? <img src={preview} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                  : <><div style={{ fontSize: 36 }}>📷</div><div style={{ color: T.textMuted, fontSize: 12, marginTop: 6 }}>Click to upload</div></>}
              </div>
              <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: "none" }} />
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => fileRef.current.click()} style={{ background: T.accent, border: "none", color: "#fff", borderRadius: 7, padding: "8px 18px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                  {preview ? "Change" : "Upload Photo"}
                </button>
                {preview && (
                  <button onClick={() => { setPreview(null); upd("photo", null); }} style={{ background: "none", border: `1px solid ${T.red}`, color: T.red, borderRadius: 7, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

          {tab === "rels" && (
            <div>
              {curRels.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Current Relationships</div>
                  {curRels.map(({ id, type, label }) => {
                    const r = pm.get(id);
                    if (!r) return null;
                    const rc = cardColors(r.sex);
                    return (
                      <div key={`${type}~${id}`} style={{ display: "flex", alignItems: "center", gap: 10, background: rc.fill, border: `1px solid ${rc.border}`, borderRadius: 7, padding: "7px 10px", marginBottom: 6 }}>
                        <span style={{ color: rc.text, fontSize: 12, fontWeight: 700, flex: 1 }}>{r.name}</span>
                        <span style={{ color: rc.text, fontSize: 10, opacity: 0.7, textTransform: "capitalize" }}>{label}</span>
                        <button onClick={() => toggleRel(type, id)} style={{ background: "none", border: "none", color: T.red, fontSize: 20, cursor: "pointer", lineHeight: 1, padding: "0 2px" }}>×</button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Add Relationship</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                {["parent","spouse","exSpouse","sibling","child"].map((t) => (
                  <button key={t} onClick={() => setRelType(t)} style={{
                    padding: "5px 10px", background: relType === t ? T.accent : T.bg,
                    border: `1px solid ${relType === t ? T.accent : T.panelBorder}`,
                    color: relType === t ? "#fff" : T.textMuted,
                    borderRadius: 6, cursor: "pointer", fontSize: 10, fontWeight: 700,
                  }}>{{ parent:"Parent", spouse:"Spouse", exSpouse:"Ex-Spouse", sibling:"Sibling", child:"Child" }[t]}</button>
                ))}
              </div>
              <input style={{ ...INP, marginBottom: 10 }} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" />
              <div style={{ maxHeight: 220, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {others.length === 0
                  ? <div style={{ color: T.textMuted, fontSize: 12, textAlign: "center", padding: "18px 0", fontStyle: "italic" }}>
                      {persons.length <= 1 ? "Add more members first" : "No matches"}
                    </div>
                  : others.map((r) => {
                    const rc = cardColors(r.sex);
                    const on = isOn(relType, r.id);
                    return (
                      <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, background: on ? rc.fill : T.bg, border: `1px solid ${on ? rc.border : T.panelBorder}`, borderRadius: 7, padding: "7px 10px", transition: "all 0.12s" }}>
                        <span style={{ color: T.text, fontSize: 12, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                        {r.dob && <span style={{ color: T.textMuted, fontSize: 10 }}>{getYearFromDateValue(r.dob)}</span>}
                        <button onClick={() => toggleRel(relType, r.id)} style={{ background: on ? rc.border : T.accent, border: "none", color: "#fff", borderRadius: 5, padding: "3px 10px", fontSize: 10, cursor: "pointer", fontWeight: 700 }}>
                          {on ? "✓" : "+ Link"}
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.panelBorder}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${T.panelBorder}`, color: T.textMuted, borderRadius: 8, padding: "9px 20px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
            Cancel
          </button>
          <button
            onClick={() => form.name.trim() && onSave({ ...form, id: form.id || uid() })}
            disabled={!form.name.trim()}
            style={{ background: form.name.trim() ? T.accent : T.panelBorder, border: "none", color: form.name.trim() ? "#fff" : T.textMuted, borderRadius: 8, padding: "9px 22px", fontSize: 13, cursor: form.name.trim() ? "pointer" : "not-allowed", fontWeight: 700 }}
          >
            {isNew ? "Add to Tree" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   QUICK ADD MODAL (pre-selected relationship)
───────────────────────────────────────── */
function QuickAddModal({ targetPerson, defaultRelType, persons, onSave, onClose }) {
  const relLabel = { parent: "Parent of", child: "Child of", spouse: "Spouse of", sibling: "Sibling of", exSpouse: "Ex-Spouse of" };
  const blank = {
    name: "", familyName: "", dob: "", dod: "", sex: "male", job: "", location: "", phone: "", bio: "", photo: null,
    parents:   defaultRelType === "child"    ? [targetPerson.id] : [],
    spouse:    defaultRelType === "spouse"   ? targetPerson.id   : null,
    exSpouses: defaultRelType === "exSpouse" ? [targetPerson.id] : [],
    siblings:  defaultRelType === "sibling"  ? [targetPerson.id] : [],
    children:  defaultRelType === "parent"   ? [targetPerson.id] : [],
  };
  const [form, setForm] = useState(blank);
  const upd = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const INP = { width: "100%", background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.text, borderRadius: 7, padding: "8px 11px", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: SF };
  const LBL = { display: "block", color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, fontFamily: SF };

  return (
    <div onClick={(e) => e.target === e.currentTarget && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(20,40,70,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 600, padding: 20, fontFamily: SF }}>
      <div style={{ background: T.white, borderRadius: 16, width: "100%", maxWidth: 460, overflow: "hidden", display: "flex", flexDirection: "column", border: `1px solid ${T.panelBorder}`, boxShadow: "0 24px 64px rgba(0,0,0,0.18)" }}>
        <div style={{ padding: "20px 24px 14px", borderBottom: `1px solid ${T.panelBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: `linear-gradient(135deg,${T.bg} 0%,${T.white} 60%)` }}>
          <h3 style={{ margin: 0, color: T.text, fontSize: 18, fontWeight: 800 }}>
            ➕ Add {relLabel[defaultRelType] || "Member of"} <em style={{ color: T.accent }}>{targetPerson.name}</em>
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.textMuted, fontSize: 24, cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={LBL}>Full Name *</label>
              <input style={INP} value={form.name} onChange={(e) => upd("name", e.target.value)} placeholder="e.g. Jane" autoFocus />
            </div>
            <div>
              <label style={LBL}>Family Name</label>
              <input style={INP} value={form.familyName || ""} onChange={(e) => upd("familyName", e.target.value)} placeholder="e.g. Smith" />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={LBL}>Date of Birth</label><input style={INP} type="date" value={form.dob} onChange={(e) => upd("dob", e.target.value)} /></div>
            <div>
              <label style={LBL}>Sex</label>
              <div style={{ display: "flex", gap: 6 }}>
                {["male", "female", "other"].map((s) => {
                  const sc = cardColors(s);
                  return (
                    <button key={s} onClick={() => upd("sex", s)} style={{
                      flex: 1, padding: "7px 0", background: form.sex === s ? sc.fill : T.bg,
                      border: `2px solid ${form.sex === s ? sc.border : T.panelBorder}`,
                      color: form.sex === s ? sc.text : T.textMuted,
                      borderRadius: 6, cursor: "pointer", fontSize: 10, fontWeight: 700,
                      textTransform: "capitalize",
                    }}>{s[0].toUpperCase()}</button>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div><label style={LBL}>Occupation</label><input style={INP} value={form.job} onChange={(e) => upd("job", e.target.value)} placeholder="e.g. Teacher" /></div>
            <div><label style={LBL}>Location</label><input style={INP} value={form.location} onChange={(e) => upd("location", e.target.value)} placeholder="City, Country" /></div>
          </div>
        </div>
        <div style={{ padding: "14px 24px", borderTop: `1px solid ${T.panelBorder}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${T.panelBorder}`, color: T.textMuted, borderRadius: 8, padding: "9px 20px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>Cancel</button>
          <button
            onClick={() => form.name.trim() && onSave({ ...form, id: uid() })}
            disabled={!form.name.trim()}
            style={{ background: form.name.trim() ? T.accent : T.panelBorder, border: "none", color: form.name.trim() ? "#fff" : T.textMuted, borderRadius: 8, padding: "9px 22px", fontSize: 13, cursor: form.name.trim() ? "pointer" : "not-allowed", fontWeight: 700 }}
          >
            Add to Tree
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   MAIN APP
───────────────────────────────────────── */
export default function FamilyTreeApp({ username, onLogout, treeId, treeName, initialPersons, uid, initialLayout, toolbarPortal, onInvite, onDeleteTree }) {
  const [persons, setPersons] = useState(() => loadPersons(treeId, initialPersons));
  const [pos, setPos]         = useState(() => initialLayout?.pos ?? {});
  const [selected, setSelected] = useState(null);
  const [popup, setPopup]       = useState(null);       // person id whose popup is open
  const [tooltip, setTooltip]   = useState(null);       // { person, x, y } for hover card
  const [dragMode, setDragMode] = useState(false);      // free-drag mode for repositioning cards
  const [settings, setSettings] = useState(() => loadSettings());
  const [showSettings, setShowSettings] = useState(false);
  const [editing, setEditing]   = useState(null);  // person id to edit
  const [adding, setAdding]     = useState(false);  // show full add modal
  const [quickAdd, setQuickAdd] = useState(null);   // { targetId, relType }
  const [search, setSearch]     = useState("");
  const [isolateId, setIsolateId] = useState(null);
  const [pan, setPan]           = useState({ x: 0, y: 0 });
  const [zoom, setZoom]         = useState(() => initialLayout?.zoom ?? 0.85);
  const [dragging, setDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState(null);
  const [canvasMode, setCanvasMode] = useState('pan'); // 'pan' | 'select'
  const [selBox, setSelBox]     = useState(null);       // { x1,y1,x2,y2 } screen coords while dragging
  const [multiSelected, setMultiSelected] = useState(new Set()); // ids from box-select
  const [importData, setImportData] = useState(null);   // { persons, layout } — pending import confirmation
  const [contextMenu, setContextMenu] = useState(null); // { personId, x, y }
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'saved'
  const canvasRef        = useRef();
  const centered              = useRef(false);
  const personsInitialized    = useRef(false); // skip Firestore save on first mount
  const zoomRef               = useRef(zoom);  // always-current zoom for wheel handler
  const importFileRef    = useRef();
  const clickTimerRef    = useRef(null);
  const cardDragRef      = useRef(null);  // { id, origX, origY, startMouseX, startMouseY, dragged }
  const cardWasDraggedRef = useRef(false);

  // Recompute layout whenever persons change.
  // Preserves manually-dragged positions — only new persons receive a computed position.
  // Call setPos(computeLayout(persons)) directly (e.g. ⟲ Align button) to force a full reset.
  useEffect(() => {
    setPos((prev) => {
      const fresh = computeLayout(persons);
      const merged = {};
      persons.forEach((p) => {
        merged[p.id] = prev[p.id] ?? fresh[p.id] ?? { x: 0, y: 0 };
      });
      return merged;
    });
  }, [persons]);

  // Keep zoomRef in sync so the wheel handler never has a stale closure
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Auto-center once on first load
  useEffect(() => {
    if (!centered.current && Object.keys(pos).length > 0) {
      centered.current = true;
      const vals = Object.values(pos);
      const cx = (Math.min(...vals.map((p) => p.x)) + Math.max(...vals.map((p) => p.x)) + CW) / 2;
      const cy = (Math.min(...vals.map((p) => p.y)) + Math.max(...vals.map((p) => p.y)) + CH) / 2;
      setPan({ x: -cx * zoom, y: -cy * zoom });
    }
  }, [pos, zoom]);

  // Persist persons to localStorage and Firestore (shared tree data)
  // Skip saving on initial mount — data was just loaded from Firestore
  useEffect(() => {
    savePersons(persons, treeId);
    if (treeId) {
      if (!personsInitialized.current) {
        personsInitialized.current = true;
        return;
      }
      setSaveStatus('saving');
      saveFamilyTreePersons(treeId, persons)
        .then(() => {
          setSaveStatus('saved');
          setTimeout(() => setSaveStatus('idle'), 2500);
        })
        .catch((err) => {
          console.error('Firestore save failed:', err);
          setSaveStatus('error');
          setTimeout(() => setSaveStatus('idle'), 4000);
        });
    }
  }, [persons, treeId]);
  useEffect(() => { saveSettings(settings); }, [settings]);

  // Persist layout (card positions + viewport) under the user's own document
  const layoutSaveTimer = useRef(null);
  useEffect(() => {
    if (!uid || !treeId || Object.keys(pos).length === 0) return;
    if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current);
    layoutSaveTimer.current = setTimeout(() => {
      saveUserTreeLayout(uid, treeId, { pos, pan, zoom }).catch(() => {});
    }, 2000);
    return () => { if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current); };
  }, [pos, pan, zoom, uid, treeId]);

  // Canvas pan / box-select
  const onMouseDown = useCallback((e) => {
    cardWasDraggedRef.current = false;
    if (e.button !== 0 || e.target.closest("[data-card]")) return;
    setContextMenu(null);
    setPopup(null);
    setTooltip(null);
    if (canvasMode === 'select') {
      setMultiSelected(new Set());
      setSelBox({ x1: e.clientX, y1: e.clientY, x2: e.clientX, y2: e.clientY });
    } else {
      setDragging(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
    }
  }, [canvasMode]);
  const onMouseMove = useCallback((e) => {
    // Card dragging (free-move mode or multi-select drag)
    if (cardDragRef.current) {
      const { id, origX, origY, startMouseX, startMouseY, isMulti, origPositions } = cardDragRef.current;
      const delta = Math.hypot(e.clientX - startMouseX, e.clientY - startMouseY);
      if (delta >= 4) {
        cardDragRef.current.dragged = true;
        cardWasDraggedRef.current = true;
        const dx = (e.clientX - startMouseX) / zoom;
        const dy = (e.clientY - startMouseY) / zoom;
        if (isMulti && origPositions) {
          setPos((prev) => {
            const next = { ...prev };
            Object.entries(origPositions).forEach(([mid, { x, y }]) => { next[mid] = { x: x + dx, y: y + dy }; });
            return next;
          });
        } else {
          setPos((prev) => ({ ...prev, [id]: { x: origX + dx, y: origY + dy } }));
        }
      }
      return;
    }
    // Box-select stretch
    if (selBox) {
      setSelBox((prev) => prev ? { ...prev, x2: e.clientX, y2: e.clientY } : null);
      return;
    }
    // Canvas panning
    if (!dragging || !lastMouse) return;
    setPan((p) => ({ x: p.x + e.clientX - lastMouse.x, y: p.y + e.clientY - lastMouse.y }));
    setLastMouse({ x: e.clientX, y: e.clientY });
  }, [dragging, lastMouse, zoom, selBox]);
  const onMouseUp = useCallback(() => {
    cardDragRef.current = null;
    setDragging(false);
    setLastMouse(null);
    if (selBox) {
      const el = canvasRef.current;
      if (el && (Math.abs(selBox.x2 - selBox.x1) > 6 || Math.abs(selBox.y2 - selBox.y1) > 6)) {
        const rect = el.getBoundingClientRect();
        const ox = pan.x + window.innerWidth / 2;
        const oy = pan.y + (window.innerHeight - 56) / 2;
        const wx1 = (Math.min(selBox.x1, selBox.x2) - rect.left - ox) / zoom;
        const wy1 = (Math.min(selBox.y1, selBox.y2) - rect.top  - oy) / zoom;
        const wx2 = (Math.max(selBox.x1, selBox.x2) - rect.left - ox) / zoom;
        const wy2 = (Math.max(selBox.y1, selBox.y2) - rect.top  - oy) / zoom;
        setMultiSelected(new Set(
          persons
            .filter((p) => { const pp = pos[p.id]; return pp && pp.x < wx2 && pp.x + CW > wx1 && pp.y < wy2 && pp.y + CH > wy1; })
            .map((p) => p.id)
        ));
      }
      setSelBox(null);
    }
  }, [selBox, pan, zoom, persons, pos]);

  const genMap     = useMemo(() => computeGenMap(persons), [persons]);
  const isolateSet = useMemo(() => getIsolateSet(isolateId, persons), [isolateId, persons]);

  // Scroll to zoom
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.91;
      const currentZoom = zoomRef.current;
      const newZ = Math.min(2.5, Math.max(0.2, currentZoom * factor));
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const W = rect.width;
      const H = rect.height;
      // Zoom toward cursor: keep SVG point under cursor fixed
      setZoom(newZ);
      setPan((p) => ({
        x: mouseX - W / 2 - ((mouseX - W / 2 - p.x) / currentZoom) * newZ,
        y: mouseY - H / 2 - ((mouseY - H / 2 - p.y) / currentZoom) * newZ,
      }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Close context menu on Escape key
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setContextMenu(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close context menu when clicking outside it
  useEffect(() => {
    if (!contextMenu) return;
    const close = (e) => {
      if (!e.target.closest("[data-context-menu]")) setContextMenu(null);
    };
    document.addEventListener("mousedown", close, true);
    return () => document.removeEventListener("mousedown", close, true);
  }, [contextMenu]);

  const savePerson = (data) => {
    setPersons((prev) => {
      const old = prev.find((p) => p.id === data.id);
      // Insert or replace the saved person
      const next = old
        ? prev.map((p) => (p.id === data.id ? data : p))
        : [...prev, data];

      // Sync bidirectional relationships on every other person
      const synced = next.map((p) => {
        if (p.id === data.id) return p;
        let q = p;

        // PARENTS: data lists p as a parent  →  p.children should contain data.id
        const nowParent = (data.parents  || []).includes(p.id);
        const wasParent = (old?.parents  || []).includes(p.id);
        if (nowParent && !(q.children || []).includes(data.id))
          q = { ...q, children: [...(q.children || []), data.id] };
        if (!nowParent && wasParent)
          q = { ...q, children: (q.children || []).filter((x) => x !== data.id) };

        // CHILDREN: data lists p as a child  →  p.parents should contain data.id
        const nowChild = (data.children || []).includes(p.id);
        const wasChild = (old?.children || []).includes(p.id);
        if (nowChild && !(q.parents || []).includes(data.id))
          q = { ...q, parents: [...(q.parents || []), data.id] };
        if (!nowChild && wasChild)
          q = { ...q, parents: (q.parents || []).filter((x) => x !== data.id) };

        // SIBLINGS: data lists p as a sibling  →  p.siblings should contain data.id
        const nowSib = (data.siblings || []).includes(p.id);
        const wasSib = (old?.siblings  || []).includes(p.id);
        if (nowSib && !(q.siblings || []).includes(data.id))
          q = { ...q, siblings: [...(q.siblings || []), data.id] };
        if (!nowSib && wasSib)
          q = { ...q, siblings: (q.siblings || []).filter((x) => x !== data.id) };

        // SPOUSE: data.spouse = p  →  p.spouse should be data.id
        const nowSpouse = data.spouse === p.id;
        const wasSpouse = old?.spouse  === p.id;
        if (nowSpouse && q.spouse !== data.id) q = { ...q, spouse: data.id };
        if (!nowSpouse && wasSpouse)            q = { ...q, spouse: null };

        // EX-SPOUSES: data.exSpouses includes p  →  p.exSpouses should contain data.id
        const nowEx = (data.exSpouses || []).includes(p.id);
        const wasEx = (old?.exSpouses  || []).includes(p.id);
        if (nowEx && !(q.exSpouses || []).includes(data.id))
          q = { ...q, exSpouses: [...(q.exSpouses || []), data.id] };
        if (!nowEx && wasEx)
          q = { ...q, exSpouses: (q.exSpouses || []).filter((x) => x !== data.id) };

        return q;
      });

      // AUTO-SIBLINGS: anyone sharing a parent is automatically a sibling
      return synced.map((p) => {
        const pParents = new Set(p.parents || []);
        if (pParents.size === 0) return p;
        const autoSibIds = synced
          .filter((q) => q.id !== p.id && (q.parents || []).some((pid) => pParents.has(pid)))
          .map((q) => q.id);
        if (autoSibIds.length === 0) return p;
        const merged = [...new Set([...(p.siblings || []), ...autoSibIds])];
        if (merged.length === (p.siblings || []).length && merged.every((id) => (p.siblings || []).includes(id))) return p;
        return { ...p, siblings: merged };
      });
    });
    setEditing(null);
    setAdding(false);
    setQuickAdd(null);
  };

  // Save a quick-add person and wire bidirectional relationship
  const saveQuickAdd = (newPerson, targetId, relType) => {
    setPersons((prev) => {
      // Update the target person to include the new relation
      const updated = prev.map((p) => {
        if (p.id !== targetId) return p;
        const clone = { ...p };
        if (relType === "child")    clone.children  = [...new Set([...(clone.children  || []), newPerson.id])];
        if (relType === "parent")   clone.parents   = [...new Set([...(clone.parents   || []), newPerson.id])];
        if (relType === "sibling")  clone.siblings  = [...new Set([...(clone.siblings  || []), newPerson.id])];
        if (relType === "spouse")   clone.spouse    = newPerson.id;
        if (relType === "exSpouse") clone.exSpouses = [...new Set([...(clone.exSpouses || []), newPerson.id])];
        return clone;
      });
      return [...updated, newPerson];
    });
    setQuickAdd(null);
  };

  const deletePerson = (id) => {
    setPersons((prev) =>
      prev
        .filter((p) => p.id !== id)
        .map((p) => ({
          ...p,
          parents:   (p.parents   || []).filter((x) => x !== id),
          spouse:     p.spouse === id ? null : p.spouse,
          exSpouses: (p.exSpouses || []).filter((x) => x !== id),
          siblings:  (p.siblings  || []).filter((x) => x !== id),
          children:  (p.children  || []).filter((x) => x !== id),
        }))
    );
    setSelected(null);
    setPopup(null);
  };

  const resetView = () => {
    centered.current = false;
    setZoom(0.85);
    const vals = Object.values(pos);
    if (vals.length) {
      const cx = (Math.min(...vals.map((p) => p.x)) + Math.max(...vals.map((p) => p.x)) + CW) / 2;
      const cy = (Math.min(...vals.map((p) => p.y)) + Math.max(...vals.map((p) => p.y)) + CH) / 2;
      setPan({ x: -cx * 0.85, y: -cy * 0.85 });
    }
  };

  const exportData = (format = "json") => {
    let content, mime, ext;
    if (format === "xml") {
      const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const rows = persons.map((p) =>
        `  <person>\n${Object.entries(p).map(([k, v]) => {
          if (Array.isArray(v)) return `    <${k}>${v.map((id) => `<id>${esc(id)}</id>`).join("")}</${k}>`;
          if (v === null || v === undefined) return `    <${k}/>`;
          return `    <${k}>${esc(v)}</${k}>`;
        }).join("\n")}\n  </person>`
      ).join("\n");
      const posRows = Object.entries(pos)
        .map(([id, { x, y }]) => `  <pos id="${esc(id)}" x="${Math.round(x)}" y="${Math.round(y)}"/>`)
        .join("\n");
      content = `<?xml version="1.0" encoding="UTF-8"?>\n<familyTree>\n${rows}\n  <positions>\n${posRows}\n  </positions>\n</familyTree>`;
      mime = "text/xml"; ext = "xml";
    } else {
      content = JSON.stringify({ version: 2, persons, layout: pos }, null, 2);
      mime = "application/json"; ext = "json";
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = `family-tree-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };

  const normalizeImportedPerson = (person, index) => ({
    id: String(person?.id || `imported-${index}-${uid()}`),
    name: typeof person?.name === "string" && person.name.trim() ? person.name.trim() : "Unknown",
    familyName: typeof person?.familyName === "string" ? person.familyName : "",
    dob: typeof person?.dob === "string" ? person.dob : "",
    dod: typeof person?.dod === "string" ? person.dod : "",
    sex: ["male", "female", "other"].includes(person?.sex) ? person.sex : "other",
    job: typeof person?.job === "string" ? person.job : "",
    location: typeof person?.location === "string" ? person.location : "",
    phone: typeof person?.phone === "string" ? person.phone : "",
    email: typeof person?.email === "string" ? person.email : "",
    bio: typeof person?.bio === "string" ? person.bio : "",
    photo: typeof person?.photo === "string" && person.photo.trim() ? person.photo : null,
    parents: Array.isArray(person?.parents) ? person.parents.filter(Boolean).map(String) : [],
    spouse: person?.spouse ? String(person.spouse) : null,
    exSpouses: Array.isArray(person?.exSpouses) ? person.exSpouses.filter(Boolean).map(String) : [],
    siblings: Array.isArray(person?.siblings) ? person.siblings.filter(Boolean).map(String) : [],
    children: Array.isArray(person?.children) ? person.children.filter(Boolean).map(String) : [],
    isRoot: person?.isRoot === true || person?.isRoot === "true",
  });

  const normalizeImportedLayout = (layout, importedPersons) => {
    const fresh = computeLayout(importedPersons);
    const valid = Object.fromEntries(
      Object.entries(layout || {}).filter(([id, point]) =>
        importedPersons.some((person) => person.id === id)
        && Number.isFinite(point?.x)
        && Number.isFinite(point?.y)
      )
    );

    return importedPersons.reduce((acc, person) => {
      acc[person.id] = valid[person.id] ?? fresh[person.id] ?? { x: 0, y: 0 };
      return acc;
    }, {});
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        let imported, importedLayout = null;
        if (file.name.toLowerCase().endsWith(".xml")) {
          const doc = new DOMParser().parseFromString(ev.target.result, "text/xml");
          if (doc.querySelector("parsererror")) throw new Error("Invalid XML");
          imported = [...doc.querySelectorAll("person")].map((el) => {
            const obj = {};
            [...el.children].forEach((node) => {
              const k = node.tagName;
              const ids = [...node.querySelectorAll("id")];
              if (ids.length > 0) { obj[k] = ids.map((n) => n.textContent); }
              else if (!node.textContent.trim()) { obj[k] = null; }
              else { const v = node.textContent; obj[k] = v === "null" ? null : v === "true" ? true : v === "false" ? false : v; }
            });
            return obj;
          });
          // Restore saved layout positions if present
          const posEls = [...doc.querySelectorAll("pos")];
          if (posEls.length > 0) {
            importedLayout = {};
            posEls.forEach((el) => {
              importedLayout[el.getAttribute("id")] = {
                x: parseFloat(el.getAttribute("x")),
                y: parseFloat(el.getAttribute("y")),
              };
            });
          }
        } else {
          const parsed = JSON.parse(ev.target.result);
          if (Array.isArray(parsed)) {
            imported = parsed; // legacy format
          } else if (parsed?.persons) {
            imported = parsed.persons;
            importedLayout = parsed.layout ?? null;
          }
        }
        if (Array.isArray(imported) && imported.length > 0) {
          const normalizedImported = imported.map((person, index) => normalizeImportedPerson(person, index));
          const normalizedLayout = normalizeImportedLayout(importedLayout, normalizedImported);
          setImportData({ persons: normalizedImported, layout: normalizedLayout });
        } else {
          alert("No valid data found in file.");
        }
      } catch {
        alert("Failed to import: invalid or corrupt file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const applyImport = useCallback((data) => {
    setPersons(data.persons);
    setPos(data.layout);
    centered.current = false;
    setImportData(null);
  }, []);

  const pm         = new Map(persons.map((p) => [p.id, p]));
  const selPerson  = popup ? pm.get(popup) : null;
  const editPerson = editing  ? pm.get(editing)  : null;
  const popupOpen  = !!selPerson && !editing && !adding && !quickAdd;

  const filtered = search
    ? persons.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.location || "").toLowerCase().includes(search.toLowerCase()) ||
        (p.job || "").toLowerCase().includes(search.toLowerCase())
      )
    : [];

  return (
    <div style={{ width: "100%", height: "100%", background: T.bg, display: "flex", flexDirection: "column", fontFamily: SF, overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.panelBorder}; border-radius: 3px; }
      `}</style>

      {/* ── Canvas + Panel ── */}
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <div
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          style={{
            position: "absolute", inset: 0,
            cursor: canvasMode === 'select' ? 'crosshair' : (dragging ? "grabbing" : "grab"),
            background: T.canvas,
            backgroundImage: `radial-gradient(circle, ${T.line}44 1px, transparent 1px)`,
            backgroundSize: "30px 30px",
          }}
        >
          <svg width="100%" height="100%">
            <g transform={`translate(${pan.x + (typeof window !== "undefined" ? window.innerWidth / 2 : 400)}, ${pan.y + (typeof window !== "undefined" ? (window.innerHeight - 56) / 2 : 300)}) scale(${zoom})`}>
              <TreeLines persons={isolateSet ? persons.filter((p) => isolateSet.has(p.id)) : persons} pos={pos} />
              {persons.map((p) => {
                const pp = pos[p.id];
                if (!pp) return null;
                return (
                  <foreignObject key={p.id} x={pp.x} y={pp.y} width={CW} height={CH} style={{ overflow: "visible" }}>
                    <div data-card="true">
                      <PersonCard
                        person={p}
                        selected={selected === p.id || multiSelected.has(p.id)}
                        draggable={dragMode || multiSelected.has(p.id)}
                        generation={genMap.get(p.id)}
                        dimmed={isolateSet ? !isolateSet.has(p.id) : false}
                        onDragStart={(dragMode || multiSelected.has(p.id)) ? (e) => {
                          cardWasDraggedRef.current = false;
                          const pp2 = pos[p.id];
                          if (!pp2) return;
                          const inSelection = multiSelected.has(p.id) && multiSelected.size > 1;
                          cardDragRef.current = {
                            id: p.id, origX: pp2.x, origY: pp2.y,
                            startMouseX: e.clientX, startMouseY: e.clientY, dragged: false,
                            isMulti: inSelection,
                            origPositions: inSelection
                              ? Object.fromEntries([...multiSelected].map((mid) => [mid, pos[mid]]).filter(([, v]) => v))
                              : null,
                          };
                        } : undefined}
                        onClick={(e) => {
                          if (cardWasDraggedRef.current) { cardWasDraggedRef.current = false; return; }
                          e.stopPropagation();
                          if (clickTimerRef.current?.pId === p.id) {
                            // Second click on same card within ~230ms → open popup
                            clearTimeout(clickTimerRef.current.timer);
                            clickTimerRef.current = null;
                            setTooltip(null);
                            setPopup(p.id); setSelected(p.id);
                          } else {
                            if (clickTimerRef.current) clearTimeout(clickTimerRef.current.timer);
                            clickTimerRef.current = {
                              pId: p.id,
                              timer: setTimeout(() => {
                                clickTimerRef.current = null;
                                setSelected((prev) => prev === p.id ? null : p.id);
                              }, 230),
                            };
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setContextMenu({ personId: p.id, x: e.clientX, y: e.clientY });
                          setTooltip(null);
                        }}
                        onHoverStart={(e) => {
                          if (!popup && !editing && !adding && !quickAdd)
                            setTooltip({ person: p, x: e.clientX, y: e.clientY });
                        }}
                        onHoverEnd={() => setTooltip(null)}
                      />
                    </div>
                  </foreignObject>
                );
              })}
            </g>
          </svg>

          {persons.length === 0 && (
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
              <div style={{ fontSize: 52, marginBottom: 12 }}>🌳</div>
              <div style={{ color: T.textSub, fontSize: 18, fontWeight: 800, marginBottom: 6 }}>Start Your Family Tree</div>
              <div style={{ color: T.textMuted, fontSize: 13 }}>Click "Add Member" to begin</div>
            </div>
          )}

          {/* Box-select rectangle overlay */}
          {selBox && (
            <div
              style={{
                position: "fixed",
                left: Math.min(selBox.x1, selBox.x2),
                top:  Math.min(selBox.y1, selBox.y2),
                width:  Math.abs(selBox.x2 - selBox.x1),
                height: Math.abs(selBox.y2 - selBox.y1),
                border: `1.5px dashed ${T.accent}`,
                background: `${T.accent}1a`,
                borderRadius: 3,
                pointerEvents: "none",
                zIndex: 500,
              }}
            />
          )}
        </div>

        {popupOpen && selPerson && (
          <PersonPopup
            person={selPerson}
            persons={persons}
            onClose={() => setPopup(null)}
            onEdit={(p) => { setEditing(p.id); setPopup(null); }}
            onDelete={(id) => deletePerson(id)}
            onAddMember={(targetId, relType) => { setPopup(null); setQuickAdd({ targetId, relType }); }}
          />
        )}
      </div>

      {/* ── Legend ── */}
      <div style={{ position: "absolute", bottom: 16, left: 16, background: `${T.white}ee`, backdropFilter: "blur(10px)", border: `1px solid ${T.panelBorder}`, borderRadius: 10, padding: "7px 14px", display: "flex", gap: 14, alignItems: "center", zIndex: 100, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", fontSize: 10, fontWeight: 700 }}>
        {[["Male", T.maleBorder], ["Female", T.femaleBorder], ["Other", T.otherBorder]].map(([l, col]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 11, height: 11, borderRadius: 3, background: col }} />
            <span style={{ color: T.textSub }}>{l}</span>
          </div>
        ))}
        <div style={{ width: 1, height: 14, background: T.panelBorder }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <svg width={52} height={14} style={{ overflow: "visible" }}>
            <line x1={0}  y1={7} x2={19} y2={7} stroke={T.line} strokeWidth={1.5} />
            <circle cx={23} cy={7} r={5.5} fill={T.dotRing} opacity={0.6} />
            <circle cx={23} cy={7} r={4}   fill={T.dot} />
            <line x1={27} y1={7} x2={52} y2={7} stroke={T.line} strokeWidth={1.5} />
          </svg>
          <span style={{ color: T.textSub }}>Couple node</span>
        </div>
        <div style={{ color: T.textMuted }}>Scroll to zoom · Drag to pan</div>
      </div>

      {/* Modals */}
      {editing && editPerson && (
        <FormModal initial={editPerson} persons={persons} onSave={savePerson} onClose={() => setEditing(null)} />
      )}
      {adding && (
        <FormModal initial={null} persons={persons} onSave={savePerson} onClose={() => setAdding(false)} />
      )}
      {quickAdd && pm.get(quickAdd.targetId) && (
        <QuickAddModal
          targetPerson={pm.get(quickAdd.targetId)}
          defaultRelType={quickAdd.relType}
          persons={persons}
          onSave={(newPerson) => saveQuickAdd(newPerson, quickAdd.targetId, quickAdd.relType)}
          onClose={() => setQuickAdd(null)}
        />
      )}
      {tooltip && <HoverTooltip person={tooltip.person} x={tooltip.x} y={tooltip.y} fields={settings.tooltipFields} />}
      {showSettings && <SettingsModal
        settings={settings}
        onChange={setSettings}
        onClose={() => setShowSettings(false)}
        treeName={treeName}
        onDeleteTree={onDeleteTree ? () => { setShowSettings(false); onDeleteTree(); } : undefined}
      />}

      {/* ── Right-click context menu ── */}
      {contextMenu && (() => {
        const ctxPerson = pm.get(contextMenu.personId);
        if (!ctxPerson) return null;
        const isIsolated = isolateId === contextMenu.personId;
        const ctxId = contextMenu.personId;
        return (
          <div
            data-context-menu="true"
            style={{
              position: "fixed",
              left: Math.min(contextMenu.x, window.innerWidth - 200),
              top: Math.min(contextMenu.y, window.innerHeight - 260),
              background: T.white,
              border: `1px solid ${T.panelBorder}`,
              borderRadius: 10,
              boxShadow: "0 8px 28px rgba(0,0,0,0.16)",
              zIndex: 1200,
              minWidth: 188,
              fontFamily: SF,
              overflow: "hidden",
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "8px 14px 7px", borderBottom: `1px solid ${T.panelBorder}`, color: T.textMuted, fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {ctxPerson.name}
            </div>
            <button
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: isIsolated ? T.accent : T.text, fontFamily: SF }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.bg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              onClick={() => { setContextMenu(null); setIsolateId(isIsolated ? null : ctxId); }}
            >
              👁 {isIsolated ? "Exit Isolate View" : "Isolate View"}
            </button>
            <button
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: dragMode ? T.accent : T.text, fontFamily: SF }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.bg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              onClick={() => { setContextMenu(null); setDragMode((d) => !d); }}
            >
              ⬡ {dragMode ? 'Drag On' : 'Drag Off'}
            </button>
            <div style={{ height: 1, background: T.panelBorder }} />
            {[
              ["parent",  "👤 Add Parent"],
              ["spouse",  "💑 Add Spouse"],
              ["child",   "👶 Add Child"],
              ["sibling", "👥 Add Sibling"],
            ].map(([relType, label]) => (
              <button
                key={relType}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: T.text, fontFamily: SF }}
                onMouseEnter={(e) => { e.currentTarget.style.background = T.bg; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
                onClick={() => { setContextMenu(null); setPopup(null); setQuickAdd({ targetId: ctxId, relType }); }}
              >
                {label}
              </button>
            ))}
            <div style={{ height: 1, background: T.panelBorder }} />
            <button
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: T.text, fontFamily: SF }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.bg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              onClick={() => {
                setContextMenu(null);
                if (treeId) {
                  setSaveStatus('saving');
                  saveFamilyTreePersons(treeId, persons)
                    .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2500); })
                    .catch(() => setSaveStatus('idle'));
                }
              }}
            >
              💾 Save to Database
            </button>
            <div style={{ height: 1, background: T.panelBorder }} />
            <button
              style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px", background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: T.text, fontFamily: SF }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.bg; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "none"; }}
              onClick={() => { setContextMenu(null); setEditing(ctxId); setPopup(null); }}
            >
              ✏️ Edit
            </button>
          </div>
        );
      })()}

      {/* ── Import confirmation modal ── */}
      {importData && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(20,40,70,0.45)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, fontFamily: SF }}>
          <div style={{ background: T.white, borderRadius: 16, padding: 28, width: 380, maxWidth: "calc(100vw - 32px)", boxShadow: "0 24px 64px rgba(0,0,0,0.18)", border: `1px solid ${T.panelBorder}` }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>⬇️</div>
            <h3 style={{ margin: "0 0 10px", color: T.text, fontSize: 18, fontWeight: 800, fontFamily: SF }}>Import Family Tree?</h3>
            <p style={{ margin: "0 0 22px", color: T.textSub, fontSize: 14, lineHeight: 1.55 }}>
              This will replace the current tree with{" "}
              <strong style={{ color: T.text }}>{importData.persons.length} people</strong>. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setImportData(null)}
                style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.textSub, borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: SF }}
              >
                Cancel
              </button>
              <button
                onClick={() => applyImport(importData)}
                style={{ background: T.accent, border: "none", color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: SF }}
              >
                Import {importData.persons.length} people
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toolbar portal into Dashboard's nav bar ── */}
      {toolbarPortal && createPortal(
        <>
          {/* Member count badge */}
          <span style={{ color: T.textMuted, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', paddingRight: 10, borderRight: `1px solid ${T.panelBorder}`, marginRight: 4, flexShrink: 0 }}>
            {persons.length} members
          </span>

          {/* Search */}
          <div style={{ position: 'relative', flex: 1, maxWidth: 220, minWidth: 80 }}>
            <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: T.textMuted, pointerEvents: 'none' }}>🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search members…"
              style={{ width: '100%', background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.text, borderRadius: 8, padding: '5px 10px 5px 28px', fontSize: 12, outline: 'none', fontFamily: SF }}
            />
            {search && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, background: T.white, border: `1px solid ${T.panelBorder}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 9999, maxHeight: 260, overflowY: 'auto' }}>
                {filtered.length === 0
                  ? <div style={{ color: T.textMuted, fontSize: 12, padding: '12px 14px' }}>No results</div>
                  : filtered.map((p) => {
                    const pc = cardColors(p.sex);
                    return (
                      <div key={p.id} onClick={() => { setSelected(p.id); setPopup(p.id); setSearch(''); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer', borderBottom: `1px solid ${T.bg}` }}
                        onMouseEnter={(e) => e.currentTarget.style.background = T.bg}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                        <div style={{ width: 26, height: 26, borderRadius: '50%', background: pc.fill, border: `1.5px solid ${pc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: pc.text, fontSize: 9, fontWeight: 800 }}>{p.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</span>
                        </div>
                        <div>
                          <div style={{ color: T.text, fontSize: 12, fontWeight: 700 }}>{p.name}</div>
                          {p.location && <div style={{ color: T.textMuted, fontSize: 10 }}>📍 {p.location}</div>}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            {onInvite && (
              <button onClick={onInvite} style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.textSub, borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                👥 Invite
              </button>
            )}
            <div style={{ width: 1, height: 20, background: T.panelBorder }} />
            {/* Drag mode */}
            <button
              onClick={() => setDragMode((d) => !d)}
              style={{ background: dragMode ? T.accent : T.bg, border: `1px solid ${dragMode ? T.accent : T.panelBorder}`, color: dragMode ? '#fff' : T.textSub, borderRadius: 7, padding: '0 10px', height: 28, fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
            >
              {dragMode ? '⬡ Dragging' : '⬡ Drag'}
            </button>
            {/* Isolate */}
            <button
              onClick={() => { if (isolateId) setIsolateId(null); else if (selected) setIsolateId(selected); }}
              disabled={!selected && !isolateId}
              title={isolateId ? 'Exit isolate view' : selected ? `Isolate: ${pm.get(selected)?.name}` : 'Select a person first'}
              style={{ background: isolateId ? T.accent : T.bg, border: `1px solid ${isolateId ? T.accent : T.panelBorder}`, color: isolateId ? '#fff' : (!selected ? T.textMuted : T.textSub), borderRadius: 7, padding: '0 10px', height: 28, fontSize: 11, cursor: (selected || isolateId) ? 'pointer' : 'not-allowed', fontWeight: 700, opacity: (!selected && !isolateId) ? 0.45 : 1 }}
            >
              {isolateId ? '👁 Isolated' : '👁 Isolate'}
            </button>
            <div style={{ width: 1, height: 20, background: T.panelBorder }} />
            {/* Save */}
            {saveStatus !== 'idle' && (
              <span style={{ fontSize: 11, fontWeight: 700, color: saveStatus === 'saved' ? '#22c55e' : saveStatus === 'error' ? '#ef4444' : T.textMuted, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', transition: 'color 0.3s' }}>
                {saveStatus === 'saving' ? '⏳ Saving…' : saveStatus === 'error' ? '✗ Save failed' : '✓ Saved'}
              </span>
            )}
            <button
              onClick={() => {
                if (treeId) {
                  setSaveStatus('saving');
                  saveFamilyTreePersons(treeId, persons)
                    .then(() => { setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 2500); })
                    .catch((err) => { console.error('Manual save failed:', err); setSaveStatus('error'); setTimeout(() => setSaveStatus('idle'), 4000); });
                }
              }}
              title="Save to database"
              style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.textSub, borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
            >
              💾 Save
            </button>
            <div style={{ width: 1, height: 20, background: T.panelBorder }} />
            {/* Export / Import XML */}
            <button
              onClick={() => exportData('xml')}
              title="Export tree as XML file"
              style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.textSub, borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
            >
              ⬆ Export XML
            </button>
            <button
              onClick={() => importFileRef.current.click()}
              title="Import tree from XML file"
              style={{ background: T.bg, border: `1px solid ${T.panelBorder}`, color: T.textSub, borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}
            >
              ⬇ Import XML
            </button>
            <input ref={importFileRef} type="file" accept=".xml" style={{ display: 'none' }} onChange={handleImport} />
            <button onClick={() => setAdding(true)} style={{ background: T.accent, border: 'none', color: '#fff', borderRadius: 8, padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 800 }}>＋ Add Member</button>
          </div>
        </>,
        toolbarPortal
      )}
    </div>
  );
}
