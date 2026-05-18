import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectPerson } from '../store/slices/familyTreeSlice';
import ReactFlow, {
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  MiniMap,
} from 'reactflow';
import 'reactflow/dist/style.css';

export const EDGE_TYPE_CONFIG = {
  parent: { label: 'Parent', defaultColor: '#3b82f6' },
  child: { label: 'Child', defaultColor: '#22c55e' },
  spouse: { label: 'Spouse', defaultColor: '#ec4899' },
  ex_spouse: { label: 'Ex Spouse', defaultColor: '#ef4444' },
  sibling: { label: 'Sibling', defaultColor: '#f59e0b' },
};

export const DEFAULT_EDGE_PREFERENCES = {
  parent: { color: '#3b82f6', lineStyle: 'solid' },
  child: { color: '#22c55e', lineStyle: 'solid' },
  spouse: { color: '#ec4899', lineStyle: 'solid' },
  ex_spouse: { color: '#ef4444', lineStyle: 'dotted' },
  sibling: { color: '#f59e0b', lineStyle: 'solid' },
};

function normalizeRelationshipType(type) {
  if (type === 'ex-spouse' || type === 'ex spouse' || type === 'exSpouse') {
    return 'ex_spouse';
  }

  return type;
}

export default function FamilyTreeView({ onSelectPerson, onEditPerson, onQuickAddRelation, edgePreferences }) {
  const people        = useSelector((state) => state.familyTree.people);
  const relationships = useSelector((state) => state.familyTree.relationships);
  const rootPersonId  = useSelector((state) => state.familyTree.rootPersonId);
  const selectedPersonId = useSelector((state) => state.familyTree.selectedPersonId);
  const dispatch = useDispatch();
  const treeContainerRef = useRef(null);

  const [contextMenu, setContextMenu] = useState(null);

  const prefs = edgePreferences || DEFAULT_EDGE_PREFERENCES;

  // Generate nodes from people
  const nodes = useMemo(() => {
    const nodeMap = new Map();

    // Use a BFS approach to position nodes by generation
    const visited = new Set();
    const queue = [{ id: rootPersonId, level: 0, index: 0, siblingCount: 1 }];

    while (queue.length > 0) {
      const { id, level, index, siblingCount } = queue.shift();

      if (visited.has(id)) continue;
      visited.add(id);

      const person = people[id];
      if (!person) continue;

      // Calculate position based on level and sibling index
      const x = (index - siblingCount / 2 + 0.5) * 250;
      const y = level * 150;

      const isSelected = selectedPersonId === id;

      nodeMap.set(id, {
        id,
        data: {
          label: `${person.givenNames} ${person.surname}`,
          birthDate: person.birthDate,
          deathDate: person.deathDate,
          photo: person.photo,
          colorLabel: person.colorLabel,
          id: person.id,
          onSelect: onSelectPerson,
        },
        position: { x, y },
        style: {
          background: isSelected ? '#dbeafe' : 'white',
          border: `2px solid ${isSelected ? '#2563eb' : '#3b82f6'}`,
          borderRadius: '8px',
          padding: '10px',
          minWidth: '150px',
          textAlign: 'center',
          boxShadow: isSelected
            ? '0 4px 12px rgba(37, 99, 235, 0.3)'
            : '0 2px 4px rgba(0, 0, 0, 0.1)',
          cursor: 'pointer',
        },
        selected: isSelected,
      });

      // Find children and parents to add to queue
      const children = relationships
        .filter((rel) => rel.fromId === id && rel.type === 'child')
        .map((rel) => rel.toId);

      const parents = relationships
        .filter((rel) => rel.toId === id && rel.type === 'parent')
        .map((rel) => rel.fromId);

      // Add children to next level
      children.forEach((childId, idx) => {
        queue.push({
          id: childId,
          level: level + 1,
          index: idx,
          siblingCount: children.length,
        });
      });

      // Add parents to previous level
      parents.forEach((parentId, idx) => {
        queue.push({
          id: parentId,
          level: level - 1,
          index: idx,
          siblingCount: parents.length,
        });
      });
    }

    return Array.from(nodeMap.values()).map((node) => ({
      ...node,
      data: {
        ...node.data,
        onClick: () => {
          dispatch(selectPerson(node.id));
          if (onSelectPerson) onSelectPerson(node.id);
        },
      },
    }));
  }, [people, relationships, rootPersonId, selectedPersonId, onSelectPerson, dispatch]);

  // Generate edges from relationships
  const edges = useMemo(() => {
    const edgeSet = new Set();
    const edgeList = [];

    relationships.forEach((rel) => {
      const edgeId = `${rel.fromId}-${rel.toId}`;

      if (edgeSet.has(edgeId)) return;
      edgeSet.add(edgeId);

      const relationType  = normalizeRelationshipType(rel.type);
      const relationConfig = EDGE_TYPE_CONFIG[relationType] || { label: rel.type, defaultColor: '#94a3b8' };
      const pref           = prefs[relationType] || { color: relationConfig.defaultColor, lineStyle: 'solid' };

      edgeList.push({
        id:        edgeId,
        source:    rel.fromId,
        target:    rel.toId,
        label:     relationConfig.label,
        animated:  pref.lineStyle === 'dotted',
        style:     { strokeWidth: 2, stroke: pref.color, strokeDasharray: pref.lineStyle === 'dotted' ? '6 4' : 'none' },
        labelStyle:{ fontSize: '11px', fill: pref.color, fontWeight: 500 },
        markerEnd: { type: 'arrowclosed', color: pref.color },
      });
    });

    return edgeList;
  }, [relationships, prefs]);

  const [reactFlowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [reactFlowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => {
    setNodes(nodes);
  }, [nodes, setNodes]);

  useEffect(() => {
    setEdges(edges);
  }, [edges, setEdges]);

  // Update node styles when selected person changes
  React.useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        selected: node.id === selectedPersonId,
        style: {
          ...node.style,
          background: node.id === selectedPersonId ? '#dbeafe' : 'white',
          border: `2px solid ${node.id === selectedPersonId ? '#2563eb' : '#3b82f6'}`,
          boxShadow:
            node.id === selectedPersonId
              ? '0 4px 12px rgba(37, 99, 235, 0.3)'
              : '0 2px 4px rgba(0, 0, 0, 0.1)',
        },
      }))
    );
  }, [selectedPersonId, setNodes]);

  // Handle node clicks
  const onNodeClick = useCallback((event, node) => {
    dispatch(selectPerson(node.id));
    setContextMenu(null);
    if (onSelectPerson) onSelectPerson(node.id);
  }, [dispatch, onSelectPerson]);

  const onNodeDoubleClick = useCallback((event, node) => {
    dispatch(selectPerson(node.id));
    setContextMenu(null);

    if (onEditPerson) {
      onEditPerson(node.id);
    }
  }, [dispatch, onEditPerson]);

  const onNodeContextMenu = useCallback((event, node) => {
    event.preventDefault();
    dispatch(selectPerson(node.id));

    if (treeContainerRef.current) {
      const rect = treeContainerRef.current.getBoundingClientRect();
      setContextMenu({
        nodeId: node.id,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    }
  }, [dispatch]);

  const handleMenuAction = useCallback((relationType) => {
    if (!contextMenu?.nodeId) return;
    if (onQuickAddRelation) onQuickAddRelation(contextMenu.nodeId, relationType);
    setContextMenu(null);
  }, [contextMenu, onQuickAddRelation]);

  const handleMenuEdit = useCallback(() => {
    if (!contextMenu?.nodeId) return;
    if (onEditPerson) onEditPerson(contextMenu.nodeId);
    setContextMenu(null);
  }, [contextMenu, onEditPerson]);

  const handlePaneClick = useCallback(() => setContextMenu(null), []);

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
    <div
      ref={treeContainerRef}
      style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}
    >
      <ReactFlow
        nodes={reactFlowNodes}
        edges={reactFlowEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={handlePaneClick}
        fitView
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={(n) => (n.selected ? '#dbeafe' : '#ffffff')}
          nodeStrokeColor={(n) => (n.selected ? '#2563eb' : '#3b82f6')}
          nodeBorderRadius={8}
          style={{ backgroundColor: '#f3f4f6', border: '1px solid #e5e7eb' }}
        />
      </ReactFlow>

      {contextMenu && (
        <div
          style={{
            position: 'absolute',
            left: contextMenu.x,
            top:  contextMenu.y,
            zIndex: 50,
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '10px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            padding: '6px',
            width: '200px',
          }}
        >
          <p style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '4px 8px 6px' }}>
            Add Relationship
          </p>
          {[
            { type: 'parent',    icon: '👆', label: 'Add Parent' },
            { type: 'spouse',    icon: '💑', label: 'Add Spouse' },
            { type: 'ex_spouse', icon: '💔', label: 'Add Ex Spouse' },
            { type: 'child',     icon: '👶', label: 'Add Child' },
            { type: 'sibling',   icon: '👫', label: 'Add Sibling' },
          ].map(({ type, icon, label }) => (
            <button
              key={type}
              onClick={() => handleMenuAction(type)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '6px', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', color: '#374151' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >
              <span>{icon}</span> {label}
            </button>
          ))}
          <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '4px 0' }} />
          <button
            onClick={handleMenuEdit}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '6px', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 500 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <span>✏️</span> Edit Details
          </button>
        </div>
      )}
    </div>
  );
}
