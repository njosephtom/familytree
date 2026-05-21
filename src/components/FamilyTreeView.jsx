import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  selectPerson,
  addRelationship,
  removeRelationship,
  updateRelationship,
} from '../store/slices/familyTreeSlice';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MiniMap,
  Handle,
  Position,
  ConnectionMode,
} from 'reactflow';
import 'reactflow/dist/style.css';

// --- Config -------------------------------------------------------------------
export const EDGE_TYPE_CONFIG = {
  parent:    { label: 'Parent-Child', defaultColor: '#3b82f6' },
  child:     { label: 'Parent-Child', defaultColor: '#3b82f6' },
  spouse:    { label: 'Spouse',       defaultColor: '#ec4899' },
  ex_spouse: { label: 'Ex-Spouse',    defaultColor: '#ef4444' },
  sibling:   { label: 'Sibling',      defaultColor: '#f59e0b' },
};

export const DEFAULT_EDGE_PREFERENCES = {
  parent:    { color: '#3b82f6', lineStyle: 'solid' },
  child:     { color: '#3b82f6', lineStyle: 'solid' },
  spouse:    { color: '#ec4899', lineStyle: 'solid' },
  ex_spouse: { color: '#ef4444', lineStyle: 'dotted' },
  sibling:   { color: '#f59e0b', lineStyle: 'solid' },
};

const CONNECTION_OPTIONS = [
  { value: 'child',     label: 'Parent-Child', icon: '\u{1F468}\u200D\u{1F467}', hint: 'Source is parent of target' },
  { value: 'sibling',   label: 'Siblings',     icon: '\u{1F46B}',               hint: 'Bidirectional' },
  { value: 'spouse',    label: 'Spouse',        icon: '\u{1F491}',               hint: 'Bidirectional' },
  { value: 'ex_spouse', label: 'Ex-Spouse',    icon: '\u{1F494}',               hint: 'Bidirectional' },
];

// --- Helpers ------------------------------------------------------------------
function computeAutoHandles(fromPos, toPos) {
  if (!fromPos || !toPos) return { sourceHandle: 'b', targetHandle: 't' };
  const dx = toPos.x - fromPos.x;
  const dy = toPos.y - fromPos.y;
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy >= 0
      ? { sourceHandle: 'b', targetHandle: 't' }
      : { sourceHandle: 't', targetHandle: 'b' };
  }
  return dx >= 0
    ? { sourceHandle: 'r', targetHandle: 'l' }
    : { sourceHandle: 'l', targetHandle: 'r' };
}

function normalizeRelationshipType(type) {
  if (type === 'ex-spouse' || type === 'ex spouse' || type === 'exSpouse') return 'ex_spouse';
  return type;
}

const BIDI_TYPES = ['spouse', 'ex_spouse', 'sibling'];

// --- Custom Node --------------------------------------------------------------
function FamilyPersonNode({ data, selected }) {
  const isDeceased = !!data.deathDate;
  const label    = data.label || '';
  const initials = label.trim().split(' ').map(p => p[0] || '').join('').slice(0, 2).toUpperCase();

  return (
    <div style={{
      background:   selected ? '#dbeafe' : 'white',
      border:       `2px solid ${selected ? '#2563eb' : '#3b82f6'}`,
      borderRadius: '8px',
      padding:      '10px 12px 8px',
      minWidth:     '150px',
      textAlign:    'center',
      boxShadow:    selected ? '0 4px 12px rgba(37,99,235,0.3)' : '0 2px 4px rgba(0,0,0,0.1)',
      cursor:       'pointer',
      position:     'relative',
      userSelect:   'none',
    }}>
      <Handle type="source" position={Position.Top}    id="t" style={{ background: '#3b82f6', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Bottom} id="b" style={{ background: '#3b82f6', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Left}   id="l" style={{ background: '#3b82f6', width: 8, height: 8 }} />
      <Handle type="source" position={Position.Right}  id="r" style={{ background: '#3b82f6', width: 8, height: 8 }} />

      <div title={isDeceased ? 'Deceased' : 'Living'} style={{
        position: 'absolute', top: 6, right: 6,
        width: 10, height: 10, borderRadius: '50%',
        background: isDeceased ? '#9ca3af' : '#22c55e',
        border: '1.5px solid white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        zIndex: 1,
      }} />

      {data.photo ? (
        <img src={data.photo} alt={label}
          style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', display: 'block', margin: '0 auto 6px', border: '2px solid #e5e7eb' }}
          onError={e => { e.target.style.display = 'none'; }}
        />
      ) : (
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: data.colorLabel || '#dbeafe',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', fontWeight: 700, color: '#1d4ed8',
          margin: '0 auto 6px', border: '2px solid #e5e7eb',
        }}>
          {initials}
        </div>
      )}

      <div style={{ fontSize: '13px', fontWeight: 600, color: '#111827', lineHeight: 1.3 }}>{label}</div>
      {data.birthDate && <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>{data.birthDate}</div>}
    </div>
  );
}

const nodeTypes = { familyPerson: FamilyPersonNode };

// --- Custom edge: orthogonal H-connector for parent→child ------------------
// Draws: parent-bottom → vertical to midY → horizontal to child-X → vertical to child-top.
// When siblings share the same parent, their midY values are identical so the
// horizontal segments merge into one continuous bar, matching the reference layout.
function FamilyChildEdge({ id, sourceX, sourceY, targetX, targetY, style = {}, markerEnd }) {
  const midY = sourceY + (targetY - sourceY) * 0.5;
  const d = `M ${sourceX},${sourceY} L ${sourceX},${midY} L ${targetX},${midY} L ${targetX},${targetY}`;
  return (
    <>
      <path id={id} d={d} fill="none" style={style} markerEnd={markerEnd} className="react-flow__edge-path" />
      {/* wider invisible stroke so the edge stays easy to right-click */}
      <path d={d} fill="none" stroke="transparent" strokeWidth={20} className="react-flow__edge-interaction" />
    </>
  );
}

const edgeTypes = { familyChild: FamilyChildEdge };

// --- Main Component -----------------------------------------------------------
export default function FamilyTreeView({ onSelectPerson, onEditPerson, onQuickAddRelation, edgePreferences }) {
  const people           = useSelector(s => s.familyTree.people);
  const relationships    = useSelector(s => s.familyTree.relationships);
  const rootPersonId     = useSelector(s => s.familyTree.rootPersonId);
  const selectedPersonId = useSelector(s => s.familyTree.selectedPersonId);
  const dispatch = useDispatch();

  const treeContainerRef = useRef(null);
  const rfInstance       = useRef(null);

  const [contextMenu,            setContextMenu]            = useState(null);
  const [edgeContextMenu,        setEdgeContextMenu]        = useState(null);
  const [connectingFrom,         setConnectingFrom]         = useState(null);
  const [connectionDialog,       setConnectionDialog]       = useState(null);
  const [editConnectionDialog,   setEditConnectionDialog]   = useState(null);
  const [connectionPointsDialog, setConnectionPointsDialog] = useState(null);
  const [nodePopup,              setNodePopup]              = useState(null); // { personId, x, y }
  const [selectedConnType,       setSelectedConnType]       = useState('child');

  const prefs = edgePreferences || DEFAULT_EDGE_PREFERENCES;

  // -- BFS layout � traverses ALL relationship types -------------------------
  const nodes = useMemo(() => {
    const levelMap = new Map(); // id -> level
    const visited  = new Set();
    const queue    = [{ id: rootPersonId, level: 0 }];

    while (queue.length > 0) {
      const { id, level } = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      levelMap.set(id, level);

      if (!people[id]) continue;

      // Children (down)
      relationships
        .filter(r => r.fromId === id && r.type === 'child')
        .forEach(r => queue.push({ id: r.toId, level: level + 1 }));

      // Parents (up)
      relationships
        .filter(r => r.toId === id && r.type === 'parent')
        .forEach(r => queue.push({ id: r.fromId, level: level - 1 }));

      // Siblings (same level) � only follow fromId?toId direction to avoid double-adding
      relationships
        .filter(r => r.fromId === id && r.type === 'sibling')
        .forEach(r => queue.push({ id: r.toId, level }));

      // Spouses / ex-spouses (same level)
      relationships
        .filter(r => r.fromId === id && (r.type === 'spouse' || r.type === 'ex_spouse'))
        .forEach(r => queue.push({ id: r.toId, level }));
    }

    // Isolated people (no path from root) ? place below everyone else
    const maxLevel = levelMap.size > 0 ? Math.max(...levelMap.values()) + 2 : 0;
    Object.keys(people).forEach(id => {
      if (!visited.has(id)) levelMap.set(id, maxLevel);
    });

    // Group IDs by level, then assign (x, y)
    const levelGroups = new Map();
    levelMap.forEach((level, id) => {
      if (!levelGroups.has(level)) levelGroups.set(level, []);
      levelGroups.get(level).push(id);
    });

    const nodeArray = [];
    levelGroups.forEach((ids, level) => {
      ids.forEach((id, idx) => {
        const person = people[id];
        if (!person) return;
        nodeArray.push({
          id,
          type: 'familyPerson',
          data: {
            label:      `${person.givenNames} ${person.surname}`,
            birthDate:  person.birthDate,
            deathDate:  person.deathDate,
            photo:      person.photo,
            colorLabel: person.colorLabel,
            id:         person.id,
          },
          position: {
            x: (idx - ids.length / 2 + 0.5) * 250,
            y: level * 160,
          },
          selected: selectedPersonId === id,
        });
      });
    });

    return nodeArray;
  }, [people, relationships, rootPersonId, selectedPersonId]);

  const [reactFlowNodes, setNodes, onNodesChange] = useNodesState(nodes);

  useEffect(() => { setNodes(nodes); }, [nodes, setNodes]);

  // -- Edges (smart handle routing) ------------------------------------------
  const edges = useMemo(() => {
    const seen    = new Set();
    const edgeList = [];
    const posMap  = {};
    const liveNodes = reactFlowNodes.length > 0 ? reactFlowNodes : nodes;
    liveNodes.forEach(n => { posMap[n.id] = n.position; });

    relationships.forEach(rel => {
      const relType = normalizeRelationshipType(rel.type);
      const key = [...[rel.fromId, rel.toId]].sort().join('~') + '~' + relType;
      if (seen.has(key)) return;
      seen.add(key);

      const config = EDGE_TYPE_CONFIG[relType] || { label: relType, defaultColor: '#94a3b8' };
      const pref   = prefs[relType] || { color: config.defaultColor, lineStyle: 'solid' };

      // Parent-child edges: always use orthogonal H-connector routing (bottom → mid → top)
      const isParentChild = relType === 'child' || relType === 'parent';

      const auto         = isParentChild
        ? { sourceHandle: 'b', targetHandle: 't' }
        : computeAutoHandles(posMap[rel.fromId], posMap[rel.toId]);
      const sourceHandle = isParentChild ? 'b' : (rel.sourceHandle || auto.sourceHandle);
      const targetHandle = isParentChild ? 't' : (rel.targetHandle || auto.targetHandle);

      edgeList.push({
        id:           `${rel.fromId}-${rel.toId}`,
        source:       rel.fromId,
        target:       rel.toId,
        type:         isParentChild ? 'familyChild' : undefined,
        sourceHandle,
        targetHandle,
        label:        isParentChild ? undefined : config.label,
        animated:     pref.lineStyle === 'dotted',
        style:        { strokeWidth: 2, stroke: pref.color, strokeDasharray: pref.lineStyle === 'dotted' ? '6 4' : 'none' },
        labelStyle:   { fontSize: '11px', fill: pref.color, fontWeight: 600 },
        markerEnd:    isParentChild ? undefined : { type: 'arrowclosed', color: pref.color },
        data:         { fromId: rel.fromId, toId: rel.toId, type: relType, sourceHandle, targetHandle },
      });
    });

    return edgeList;
  }, [relationships, prefs, nodes, reactFlowNodes]);

  const [reactFlowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => { setEdges(edges); }, [edges, setEdges]);

  // -- Escape closes everything -----------------------------------------------
  useEffect(() => {
    const onKeyDown = e => {
      if (e.key === 'Escape') {
        setConnectingFrom(null);
        setConnectionDialog(null);
        setEditConnectionDialog(null);
        setConnectionPointsDialog(null);
        setContextMenu(null);
        setEdgeContextMenu(null);
        setNodePopup(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // -- Handlers --------------------------------------------------------------
  const onNodeClick = useCallback((event, node) => {
    if (connectingFrom && connectingFrom !== node.id) {
      setConnectionDialog({ fromId: connectingFrom, toId: node.id, sourceHandle: null, targetHandle: null });
      setSelectedConnType('child');
      setConnectingFrom(null);
      setContextMenu(null);
      return;
    }

    // Popup position relative to container
    let popupX = 200, popupY = 80;
    if (treeContainerRef.current) {
      const rect = treeContainerRef.current.getBoundingClientRect();
      popupX = event.clientX - rect.left;
      popupY = event.clientY - rect.top;
    }

    setNodePopup({ personId: node.id, x: popupX, y: popupY });
    dispatch(selectPerson(node.id));
    setContextMenu(null);
    setEdgeContextMenu(null);
    if (onSelectPerson) onSelectPerson(node.id);
  }, [connectingFrom, dispatch, onSelectPerson]);

  const onNodeDoubleClick = useCallback((event, node) => {
    setNodePopup(null);
    dispatch(selectPerson(node.id));
    setContextMenu(null);
    if (onEditPerson) onEditPerson(node.id);
  }, [dispatch, onEditPerson]);

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    setNodePopup(null);
    dispatch(selectPerson(node.id));
    setEdgeContextMenu(null);
    if (treeContainerRef.current) {
      const rect = treeContainerRef.current.getBoundingClientRect();
      setContextMenu({ nodeId: node.id, x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
  }, [dispatch]);

  const onEdgeContextMenu = useCallback((event, edge) => {
    event.preventDefault();
    setContextMenu(null);
    setNodePopup(null);
    if (treeContainerRef.current) {
      const rect = treeContainerRef.current.getBoundingClientRect();
      setEdgeContextMenu({
        fromId:       edge.data?.fromId       || edge.source,
        toId:         edge.data?.toId         || edge.target,
        type:         edge.data?.type         || 'child',
        sourceHandle: edge.data?.sourceHandle || edge.sourceHandle,
        targetHandle: edge.data?.targetHandle || edge.targetHandle,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  }, []);

  const onConnect = useCallback((connection) => {
    if (!connection.source || !connection.target) return;
    setConnectionDialog({
      fromId:       connection.source,
      toId:         connection.target,
      sourceHandle: connection.sourceHandle || null,
      targetHandle: connection.targetHandle || null,
    });
    setSelectedConnType('child');
  }, []);

  const confirmConnection = useCallback((fromId, toId, type, sourceHandle, targetHandle) => {
    dispatch(addRelationship({ fromId, toId, type, sourceHandle, targetHandle }));
    if (BIDI_TYPES.includes(type)) {
      dispatch(addRelationship({ fromId: toId, toId: fromId, type, sourceHandle: targetHandle, targetHandle: sourceHandle }));
    }
    setConnectionDialog(null);
  }, [dispatch]);

  const confirmEditConnection = useCallback((fromId, toId, oldType, newType) => {
    dispatch(updateRelationship({ fromId, toId, type: newType }));
    const oldBidi = BIDI_TYPES.includes(oldType);
    const newBidi = BIDI_TYPES.includes(newType);
    if (oldBidi && newBidi)       dispatch(updateRelationship({ fromId: toId, toId: fromId, type: newType }));
    else if (oldBidi && !newBidi) dispatch(removeRelationship({ fromId: toId, toId: fromId }));
    else if (!oldBidi && newBidi) dispatch(addRelationship({ fromId: toId, toId: fromId, type: newType }));
    setEditConnectionDialog(null);
    setEdgeContextMenu(null);
    setContextMenu(null);
  }, [dispatch]);

  const handleUpdateConnectionPoints = useCallback((fromId, toId, sourceHandle, targetHandle) => {
    dispatch(updateRelationship({ fromId, toId, sourceHandle, targetHandle }));
    setConnectionPointsDialog(null);
    setEdgeContextMenu(null);
  }, [dispatch]);

  const handleDisconnect = useCallback((fromId, toId, type) => {
    dispatch(removeRelationship({ fromId, toId }));
    if (BIDI_TYPES.includes(type)) dispatch(removeRelationship({ fromId: toId, toId: fromId }));
    setContextMenu(null);
    setEdgeContextMenu(null);
  }, [dispatch]);

  const handleMenuAction = useCallback(relationType => {
    if (!contextMenu?.nodeId) return;
    if (onQuickAddRelation) onQuickAddRelation(contextMenu.nodeId, relationType);
    setContextMenu(null);
  }, [contextMenu, onQuickAddRelation]);

  const handleMenuEdit = useCallback(() => {
    if (!contextMenu?.nodeId) return;
    if (onEditPerson) onEditPerson(contextMenu.nodeId);
    setContextMenu(null);
  }, [contextMenu, onEditPerson]);

  const handlePaneClick = useCallback(() => {
    setContextMenu(null);
    setEdgeContextMenu(null);
    setNodePopup(null);
    if (connectingFrom) setConnectingFrom(null);
  }, [connectingFrom]);

  const getNodeConnections = useCallback(nodeId => {
    const seen = new Set();
    return relationships
      .filter(r => r.fromId === nodeId || r.toId === nodeId)
      .map(r => ({
        fromId:  r.fromId,
        toId:    r.toId,
        type:    normalizeRelationshipType(r.type),
        otherId: r.fromId === nodeId ? r.toId : r.fromId,
      }))
      .filter(r => {
        const key = [...[r.fromId, r.toId]].sort().join('~') + '~' + r.type;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [relationships]);

  if (!rootPersonId || !people[rootPersonId]) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: '#6b7280', marginBottom: '6px' }}>No family tree created yet.</p>
          <p style={{ color: '#9ca3af', fontSize: '13px' }}>Create a root person to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={treeContainerRef} style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
      {connectingFrom && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
          background: '#1d4ed8', color: 'white', padding: '8px 16px',
          fontSize: '13px', fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span>
            {'\u{1F517}'} Click another person to connect to{' '}
            <strong>{people[connectingFrom]?.givenNames} {people[connectingFrom]?.surname}</strong>.
            Press Esc to cancel.
          </span>
          <button onClick={() => setConnectingFrom(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: '4px', padding: '2px 10px', cursor: 'pointer', fontSize: '12px' }}>
            Cancel
          </button>
        </div>
      )}

      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onConnect={onConnect}
        onPaneClick={handlePaneClick}
        onInit={inst => { rfInstance.current = inst; }}
        connectionMode={ConnectionMode.Loose}
        fitView
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={n => n.selected ? '#dbeafe' : '#ffffff'}
          nodeStrokeColor={n => n.selected ? '#2563eb' : '#3b82f6'}
          nodeBorderRadius={8}
          style={{ backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb' }}
        />
      </ReactFlow>

      {nodePopup && (
        <PersonPopup
          personId={nodePopup.personId}
          x={nodePopup.x}
          y={nodePopup.y}
          people={people}
          relationships={relationships}
          containerRef={treeContainerRef}
          onClose={() => setNodePopup(null)}
          onEdit={() => { setNodePopup(null); if (onEditPerson) onEditPerson(nodePopup.personId); }}
          onAddMember={() => { setNodePopup(null); if (onQuickAddRelation) onQuickAddRelation(nodePopup.personId, null); }}
        />
      )}

      {contextMenu && (
        <NodeContextMenu
          nodeId={contextMenu.nodeId}
          x={contextMenu.x}
          y={contextMenu.y}
          people={people}
          connections={getNodeConnections(contextMenu.nodeId)}
          onAddRelation={handleMenuAction}
          onEdit={handleMenuEdit}
          onStartConnect={() => { setConnectingFrom(contextMenu.nodeId); setContextMenu(null); }}
          onDisconnect={handleDisconnect}
          onEditConnection={(fromId, toId, type) => { setEditConnectionDialog({ fromId, toId, type }); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {edgeContextMenu && (
        <EdgeContextMenu
          fromId={edgeContextMenu.fromId}
          toId={edgeContextMenu.toId}
          type={edgeContextMenu.type}
          sourceHandle={edgeContextMenu.sourceHandle}
          targetHandle={edgeContextMenu.targetHandle}
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          people={people}
          onEditConnection={(fromId, toId, type) => { setEditConnectionDialog({ fromId, toId, type }); setEdgeContextMenu(null); }}
          onEditConnectionPoints={(fromId, toId, sh, th) => {
            setConnectionPointsDialog({ fromId, toId, sourceHandle: sh, targetHandle: th });
            setEdgeContextMenu(null);
          }}
          onDisconnect={handleDisconnect}
          onClose={() => setEdgeContextMenu(null)}
        />
      )}

      {connectionDialog && (
        <ConnectionDialog
          fromId={connectionDialog.fromId}
          toId={connectionDialog.toId}
          people={people}
          selectedType={selectedConnType}
          onTypeChange={setSelectedConnType}
          onConfirm={() => confirmConnection(
            connectionDialog.fromId,
            connectionDialog.toId,
            selectedConnType,
            connectionDialog.sourceHandle,
            connectionDialog.targetHandle,
          )}
          onCancel={() => setConnectionDialog(null)}
        />
      )}

      {editConnectionDialog && (
        <EditConnectionDialog
          fromId={editConnectionDialog.fromId}
          toId={editConnectionDialog.toId}
          currentType={editConnectionDialog.type}
          people={people}
          onConfirm={newType => confirmEditConnection(editConnectionDialog.fromId, editConnectionDialog.toId, editConnectionDialog.type, newType)}
          onCancel={() => setEditConnectionDialog(null)}
        />
      )}

      {connectionPointsDialog && (
        <ConnectionPointsDialog
          fromId={connectionPointsDialog.fromId}
          toId={connectionPointsDialog.toId}
          sourceHandle={connectionPointsDialog.sourceHandle}
          targetHandle={connectionPointsDialog.targetHandle}
          people={people}
          onConfirm={(sh, th) => handleUpdateConnectionPoints(connectionPointsDialog.fromId, connectionPointsDialog.toId, sh, th)}
          onCancel={() => setConnectionPointsDialog(null)}
        />
      )}
    </div>
  );
}

// --- PersonPopup --------------------------------------------------------------
function PersonPopup({ personId, x, y, people, relationships, containerRef, onClose, onEdit, onAddMember }) {
  const person = people[personId];
  if (!person) return null;

  const isDeceased = !!person.deathDate;
  const label    = `${person.givenNames} ${person.surname}`;
  const initials = label.trim().split(' ').map(p => p[0] || '').join('').slice(0, 2).toUpperCase();

  // Relationship counts
  const parents  = relationships.filter(r => r.toId === personId && r.type === 'parent').length;
  const children = relationships.filter(r => r.fromId === personId && r.type === 'child').length;
  const spouses  = relationships.filter(r => r.fromId === personId && (r.type === 'spouse' || r.type === 'ex_spouse')).length;
  const siblings = relationships.filter(r => r.fromId === personId && r.type === 'sibling').length;

  // Keep popup within container bounds
  const popupW = 260;
  const popupH = 300;
  const cw = containerRef?.current?.offsetWidth  || 800;
  const ch = containerRef?.current?.offsetHeight || 600;
  const left = Math.min(x + 16, cw - popupW - 10);
  const top  = Math.max(10, Math.min(y - 60, ch - popupH - 10));

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'absolute', left, top, zIndex: 300, width: popupW,
        background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px',
        boxShadow: '0 12px 36px rgba(0,0,0,0.18)',
        userSelect: 'none',
      }}
    >
      {/* Header band */}
      <div style={{ background: 'linear-gradient(135deg,#2563eb,#1d4ed8)', borderRadius: '12px 12px 0 0', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        {person.photo ? (
          <img src={person.photo} alt={label} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.4)', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: person.colorLabel || 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: 'white', flexShrink: 0, border: '2px solid rgba(255,255,255,0.4)' }}>
            {initials}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: isDeceased ? '#9ca3af' : '#4ade80', border: '1px solid rgba(255,255,255,0.5)' }} />
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)' }}>{isDeceased ? 'Deceased' : 'Living'}{person.gender ? ' \u00B7 ' + person.gender : ''}</span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', borderRadius: '50%', width: 24, height: 24, cursor: 'pointer', fontSize: '13px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {'\u2715'}
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        {/* Key facts */}
        <div style={{ fontSize: '12px', color: '#374151', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
          {person.birthDate && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <span style={{ color: '#9ca3af', width: 60, flexShrink: 0 }}>Born</span>
              <span>{person.birthDate}{person.birthPlace ? ', ' + person.birthPlace : ''}</span>
            </div>
          )}
          {person.deathDate && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <span style={{ color: '#9ca3af', width: 60, flexShrink: 0 }}>Died</span>
              <span style={{ color: '#dc2626' }}>{person.deathDate}</span>
            </div>
          )}
          {person.profession && (
            <div style={{ display: 'flex', gap: '6px' }}>
              <span style={{ color: '#9ca3af', width: 60, flexShrink: 0 }}>Work</span>
              <span>{person.profession}</span>
            </div>
          )}
          {person.bio && (
            <div style={{ marginTop: '4px', padding: '6px 8px', background: '#f9fafb', borderRadius: '6px', color: '#6b7280', fontStyle: 'italic', fontSize: '11px', borderLeft: '3px solid #bfdbfe' }}>
              {person.bio.length > 80 ? person.bio.slice(0, 80) + '\u2026' : person.bio}
            </div>
          )}
        </div>

        {/* Relationship tags */}
        {(parents + children + spouses + siblings) > 0 && (
          <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {parents  > 0 && <Tag color="#f0fdf4" text="#166534">{parents} parent{parents  > 1 ? 's' : ''}</Tag>}
            {children > 0 && <Tag color="#eff6ff" text="#1d4ed8">{children} child{children > 1 ? 'ren' : ''}</Tag>}
            {spouses  > 0 && <Tag color="#fdf4ff" text="#86198f">{spouses} spouse{spouses  > 1 ? 's' : ''}</Tag>}
            {siblings > 0 && <Tag color="#fffbeb" text="#92400e">{siblings} sibling{siblings > 1 ? 's' : ''}</Tag>}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onEdit} style={{ flex: 1, padding: '8px 0', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
            {'\u270F\uFE0F'} Edit
          </button>
          <button onClick={onAddMember} style={{ flex: 1, padding: '8px 0', background: '#f0fdf4', color: '#166534', border: 'none', borderRadius: '7px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
            {'\u002B'} Add Member
          </button>
        </div>
      </div>
    </div>
  );
}

function Tag({ color, text, children }) {
  return (
    <span style={{ fontSize: '10px', background: color, color: text, borderRadius: '4px', padding: '2px 7px', fontWeight: 500 }}>
      {children}
    </span>
  );
}

// --- NodeContextMenu ----------------------------------------------------------
function NodeContextMenu({ nodeId, x, y, people, connections, onAddRelation, onEdit, onStartConnect, onDisconnect, onEditConnection }) {
  const [showConnections, setShowConnections] = useState(false);

  return (
    <div style={{
      position: 'absolute', left: x, top: y, zIndex: 50,
      background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px', width: '215px',
      maxHeight: '72vh', overflowY: 'auto',
    }}>
      <SectionLabel>Connect</SectionLabel>
      <MenuButton icon={'\u{1F517}'} label="Connect to existing person\u2026" onClick={onStartConnect} color="#2563eb" />
      <Divider />
      <SectionLabel>Add New Member</SectionLabel>
      {[
        { type: 'parent',    icon: '\u261D\uFE0F', label: 'Add Parent' },
        { type: 'spouse',    icon: '\u{1F491}',    label: 'Add Spouse' },
        { type: 'ex_spouse', icon: '\u{1F494}',    label: 'Add Ex-Spouse' },
        { type: 'child',     icon: '\u{1F476}',    label: 'Add Child' },
        { type: 'sibling',   icon: '\u{1F46B}',    label: 'Add Sibling' },
      ].map(({ type, icon, label }) => (
        <MenuButton key={type} icon={icon} label={label} onClick={() => onAddRelation(type)} />
      ))}

      {connections.length > 0 && (
        <>
          <Divider />
          <button
            onClick={() => setShowConnections(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '7px 10px', borderRadius: '6px',
              fontSize: '12px', fontWeight: 600, color: '#374151',
              background: showConnections ? '#f3f4f6' : 'none', border: 'none', cursor: 'pointer',
            }}
          >
            <span>{'\u{1F504}'} Manage Connections ({connections.length})</span>
            <span style={{ fontSize: '10px' }}>{showConnections ? '\u25B2' : '\u25BC'}</span>
          </button>
          {showConnections && connections.map((conn, idx) => {
            const other  = people[conn.otherId];
            const config = EDGE_TYPE_CONFIG[conn.type] || { label: conn.type };
            return (
              <div key={idx} style={{ padding: '6px 8px', borderRadius: '6px', background: '#f9fafb', marginBottom: '4px', border: '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{other?.givenNames} {other?.surname}</span>
                  <span style={{ fontSize: '10px', background: '#e0e7ff', color: '#3730a3', borderRadius: '3px', padding: '1px 5px', flexShrink: 0 }}>{config.label}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => onEditConnection(conn.fromId, conn.toId, conn.type)} style={{ flex: 1, fontSize: '10px', padding: '4px 0', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>Edit type</button>
                  <button onClick={() => onDisconnect(conn.fromId, conn.toId, conn.type)} style={{ flex: 1, fontSize: '10px', padding: '4px 0', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 500 }}>Disconnect</button>
                </div>
              </div>
            );
          })}
        </>
      )}

      <Divider />
      <MenuButton icon="\u270F\uFE0F" label="Edit Details" onClick={onEdit} color="#2563eb" />
    </div>
  );
}

// --- EdgeContextMenu ----------------------------------------------------------
function EdgeContextMenu({ fromId, toId, type, sourceHandle, targetHandle, x, y, people, onEditConnection, onEditConnectionPoints, onDisconnect }) {
  const fromPerson = people[fromId];
  const toPerson   = people[toId];
  const config     = EDGE_TYPE_CONFIG[type] || { label: type };
  const HLABEL     = { t: 'Top', b: 'Bottom', l: 'Left', r: 'Right' };

  return (
    <div style={{
      position: 'absolute', left: x, top: y, zIndex: 50,
      background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '10px', width: '220px',
    }}>
      <p style={{ fontSize: '12px', fontWeight: 700, color: '#374151', margin: '0 0 2px' }}>
        {fromPerson?.givenNames} {'\u2194'} {toPerson?.givenNames}
      </p>
      <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 4px' }}>
        Type:{' '}
        <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: '3px', padding: '1px 6px', fontWeight: 600 }}>
          {config.label}
        </span>
      </p>
      {(sourceHandle || targetHandle) && (
        <p style={{ fontSize: '10px', color: '#9ca3af', margin: '0 0 10px' }}>
          Route: {HLABEL[sourceHandle] || sourceHandle} {'\u2192'} {HLABEL[targetHandle] || targetHandle}
        </p>
      )}
      <button onClick={() => onEditConnectionPoints(fromId, toId, sourceHandle || 'b', targetHandle || 't')} style={{ display: 'block', width: '100%', padding: '7px 10px', marginBottom: '4px', background: '#f0fdf4', color: '#166534', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}>
        {'\u2195'} Change connection points
      </button>
      <button onClick={() => onEditConnection(fromId, toId, type)} style={{ display: 'block', width: '100%', padding: '7px 10px', marginBottom: '4px', background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}>
        {'\u270F\uFE0F'} Change connection type
      </button>
      <button onClick={() => onDisconnect(fromId, toId, type)} style={{ display: 'block', width: '100%', padding: '7px 10px', background: '#fef2f2', color: '#dc2626', border: 'none', borderRadius: '6px', fontSize: '12px', cursor: 'pointer', textAlign: 'left', fontWeight: 500 }}>
        {'\u{1F5D1}\uFE0F'} Remove connection
      </button>
    </div>
  );
}

// --- ConnectionPointsDialog ---------------------------------------------------
function ConnectionPointsDialog({ fromId, toId, sourceHandle, targetHandle, people, onConfirm, onCancel }) {
  const [sh, setSh] = useState(sourceHandle || 'b');
  const [th, setTh] = useState(targetHandle || 't');
  const fromPerson = people[fromId];
  const toPerson   = people[toId];

  return (
    <DialogOverlay>
      <div style={{ background: 'white', borderRadius: '12px', padding: '22px', width: '330px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Change Connection Points</h3>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>
          <strong>{fromPerson?.givenNames} {fromPerson?.surname}</strong>
          {' \u2194 '}
          <strong>{toPerson?.givenNames} {toPerson?.surname}</strong>
        </p>
        <HandlePicker label={`Output from: ${fromPerson?.givenNames}`} value={sh} onChange={setSh} name="sourceHandle" />
        <div style={{ height: '12px' }} />
        <HandlePicker label={`Input to: ${toPerson?.givenNames}`} value={th} onChange={setTh} name="targetHandle" />
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '9px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(sh, th)} style={{ flex: 1, padding: '9px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
        </div>
      </div>
    </DialogOverlay>
  );
}

function HandlePicker({ label, value, onChange, name }) {
  const options = [
    { id: 't', label: '\u2191 Top' },
    { id: 'b', label: '\u2193 Bottom' },
    { id: 'l', label: '\u2190 Left' },
    { id: 'r', label: '\u2192 Right' },
  ];
  return (
    <div>
      <p style={{ fontSize: '11px', fontWeight: 600, color: '#374151', margin: '0 0 6px' }}>{label}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
        {options.map(opt => (
          <label key={opt.id} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
            border: `2px solid ${value === opt.id ? '#2563eb' : '#e5e7eb'}`,
            background: value === opt.id ? '#eff6ff' : 'white',
          }}>
            <input type="radio" name={name} value={opt.id} checked={value === opt.id} onChange={() => onChange(opt.id)} style={{ margin: 0, accentColor: '#2563eb' }} />
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// --- ConnectionDialog ---------------------------------------------------------
function ConnectionDialog({ fromId, toId, people, selectedType, onTypeChange, onConfirm, onCancel }) {
  const fromPerson = people[fromId];
  const toPerson   = people[toId];

  return (
    <DialogOverlay>
      <div style={{ background: 'white', borderRadius: '12px', padding: '22px', width: '330px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Create Connection</h3>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 16px' }}>
          <strong>{fromPerson?.givenNames} {fromPerson?.surname}</strong>
          {' \u2194 '}
          <strong>{toPerson?.givenNames} {toPerson?.surname}</strong>
        </p>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>Connection type:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' }}>
          {CONNECTION_OPTIONS.map(opt => (
            <label key={opt.value} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px',
              border: `2px solid ${selectedType === opt.value ? '#2563eb' : '#e5e7eb'}`,
              background: selectedType === opt.value ? '#eff6ff' : 'white', cursor: 'pointer',
            }}>
              <input type="radio" name="connType" value={opt.value} checked={selectedType === opt.value} onChange={() => onTypeChange(opt.value)} style={{ margin: 0, accentColor: '#2563eb' }} />
              <span style={{ fontSize: '16px' }}>{opt.icon}</span>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{opt.label}</div>
                <div style={{ fontSize: '10px', color: '#9ca3af' }}>{opt.hint}</div>
              </div>
            </label>
          ))}
        </div>
        {selectedType === 'child' && (
          <p style={{ fontSize: '11px', color: '#6b7280', margin: '-6px 0 12px', padding: '6px 10px', background: '#f9fafb', borderRadius: '6px' }}>
            <strong style={{ color: '#1d4ed8' }}>{fromPerson?.givenNames}</strong>
            {' is parent of '}
            <strong style={{ color: '#1d4ed8' }}>{toPerson?.givenNames}</strong>
          </p>
        )}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '9px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ flex: 1, padding: '9px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Connect</button>
        </div>
      </div>
    </DialogOverlay>
  );
}

// --- EditConnectionDialog -----------------------------------------------------
function EditConnectionDialog({ fromId, toId, currentType, people, onConfirm, onCancel }) {
  const [selectedType, setSelectedType] = useState(currentType === 'parent' ? 'child' : currentType);
  const fromPerson = people[fromId];
  const toPerson   = people[toId];
  const config     = EDGE_TYPE_CONFIG[currentType] || { label: currentType };

  return (
    <DialogOverlay>
      <div style={{ background: 'white', borderRadius: '12px', padding: '22px', width: '330px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Edit Connection</h3>
        <p style={{ fontSize: '13px', color: '#6b7280', margin: '0 0 4px' }}>
          <strong>{fromPerson?.givenNames} {fromPerson?.surname}</strong>
          {' \u2194 '}
          <strong>{toPerson?.givenNames} {toPerson?.surname}</strong>
        </p>
        <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 14px' }}>
          Current:{' '}
          <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: '3px', padding: '1px 6px', fontWeight: 600 }}>{config.label}</span>
        </p>
        <p style={{ fontSize: '11px', fontWeight: 600, color: '#374151', margin: '0 0 8px' }}>Change to:</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px' }}>
          {CONNECTION_OPTIONS.map(opt => (
            <label key={opt.value} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px',
              border: `2px solid ${selectedType === opt.value ? '#2563eb' : '#e5e7eb'}`,
              background: selectedType === opt.value ? '#eff6ff' : 'white', cursor: 'pointer',
            }}>
              <input type="radio" name="editConnType" value={opt.value} checked={selectedType === opt.value} onChange={() => setSelectedType(opt.value)} style={{ margin: 0, accentColor: '#2563eb' }} />
              <span style={{ fontSize: '16px' }}>{opt.icon}</span>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>{opt.label}</div>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '9px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onConfirm(selectedType)} style={{ flex: 1, padding: '9px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Save</button>
        </div>
      </div>
    </DialogOverlay>
  );
}

// --- Shared helpers -----------------------------------------------------------
function DialogOverlay({ children }) {
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)' }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 8px 2px', margin: 0 }}>
      {children}
    </p>
  );
}

function MenuButton({ icon, label, onClick, color = '#374151' }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '6px', fontSize: '13px', background: hover ? '#f3f4f6' : 'none', border: 'none', cursor: 'pointer', color }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span>{icon}</span>{label}
    </button>
  );
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '4px 0' }} />;
}
