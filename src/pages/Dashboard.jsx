import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/slices/authSlice';
import { setRootPerson, updatePerson, restoreFamilyTree, selectPerson, deletePerson } from '../store/slices/familyTreeSlice';
import { useNavigate } from 'react-router-dom';
import FamilyTreeView, { EDGE_TYPE_CONFIG, DEFAULT_EDGE_PREFERENCES } from '../components/FamilyTreeView';
import PersonForm from '../components/PersonForm';
import AddFamilyMemberButtons from '../components/AddFamilyMemberButtons';
import { storageService } from '../utils/storageService';
import { exportToGEDCOM, exportToJSON, parseGEDCOM, importFromJSON } from '../utils/gedcomParser';

const EDGE_TYPE_LABELS = { parent: 'Parent', child: 'Child', spouse: 'Spouse', ex_spouse: 'Ex Spouse', sibling: 'Sibling' };

export default function Dashboard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const familyTree = useSelector((state) => state.familyTree);
  const selectedPersonId = useSelector((state) => state.familyTree.selectedPersonId);
  const selectedPerson = useSelector((state) =>
    selectedPersonId ? state.familyTree.people[selectedPersonId] : null
  );

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [quickAddRequest, setQuickAddRequest] = useState(null);
  const [sidePanelTab, setSidePanelTab] = useState('details');
  const [edgePreferences, setEdgePreferences] = useState(() => {
    const stored = localStorage.getItem('familyTreeEdgePreferences');
    if (!stored) return DEFAULT_EDGE_PREFERENCES;
    try { return { ...DEFAULT_EDGE_PREFERENCES, ...JSON.parse(stored) }; } catch { return DEFAULT_EDGE_PREFERENCES; }
  });

  useEffect(() => {
    localStorage.setItem('familyTreeEdgePreferences', JSON.stringify(edgePreferences));
  }, [edgePreferences]);

  const updateEdgePreference = (type, key, value) => {
    setEdgePreferences((cur) => ({ ...cur, [type]: { ...(cur[type] || DEFAULT_EDGE_PREFERENCES[type]), [key]: value } }));
  };

  // Restore family tree on mount
  useEffect(() => {
    const saved = storageService.loadFamilyTree();
    if (saved) {
      dispatch(restoreFamilyTree());
    }
  }, [dispatch]);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to log out?')) {
      dispatch(logout());
      navigate('/login');
    }
  };

  const handleCreateRootPerson = (formData) => {
    dispatch(setRootPerson(formData));
  };

  const handleUpdatePerson = (formData) => {
    if (selectedPersonId) {
      dispatch(updatePerson({ id: selectedPersonId, ...formData }));
      setSidePanelTab('details');
    }
  };

  const handleSelectPerson = () => setSidePanelTab('details');

  const handleEditPersonFromTree = (personId) => {
    if (personId) dispatch(selectPerson(personId));
    setSidePanelTab('edit');
  };

  const handleQuickAddFromTree = (personId, relationType) => {
    if (personId) dispatch(selectPerson(personId));
    setSidePanelTab('add');
    setQuickAddRequest({ relationType, requestId: Date.now() });
  };

  const handleExportGEDCOM = () => {
    const gedcomData = exportToGEDCOM(familyTree.people, familyTree.relationships);
    storageService.exportAsFile(
      gedcomData,
      `family_tree_${new Date().toISOString().split('T')[0]}.ged`,
      'text'
    );
  };

  const handleExportJSON = () => {
    const jsonData = exportToJSON(familyTree.people, familyTree.relationships, familyTree.rootPersonId);
    storageService.exportAsFile(
      jsonData,
      `family_tree_${new Date().toISOString().split('T')[0]}.json`,
      'json'
    );
  };

  const handleImportFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const data = await storageService.importFromFile(file);
      const imported = importFromJSON(data);
      dispatch(restoreFamilyTree());
      alert('Family tree imported successfully!');
      setShowExportMenu(false);
    } catch (error) {
      alert(`Error importing file: ${error.message}`);
    }
  };

  const handleImportGEDCOM = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const imported = parseGEDCOM(text);
      dispatch(restoreFamilyTree());
      alert('GEDCOM imported successfully!');
      setShowExportMenu(false);
    } catch (error) {
      alert(`Error importing GEDCOM: ${error.message}`);
    }
  };

  const hasRootPerson = !!familyTree.rootPersonId;

  // Shared compact header
  const header = (
    <header style={{ height: '52px', background: 'white', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', padding: '0 16px', justifyContent: 'space-between', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>🌳 Family Tree</h1>
        <span style={{ fontSize: '13px', color: '#9ca3af' }}>{user?.username}</span>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowExportMenu(!showExportMenu)} className="btn btn-secondary btn-sm">⬇ Export/Import</button>
          {showExportMenu && (
            <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: '4px', width: '176px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 50 }}>
              <button onClick={handleExportGEDCOM} className="block w-full text-left px-4 py-2 hover:bg-gray-100 text-sm" style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', fontSize: '13px' }}>Export as GEDCOM</button>
              <button onClick={handleExportJSON} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', fontSize: '13px' }}>Export as JSON</button>
              <label style={{ display: 'block', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>Import JSON<input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} /></label>
              <label style={{ display: 'block', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}>Import GEDCOM<input type="file" accept=".ged" onChange={handleImportGEDCOM} style={{ display: 'none' }} /></label>
            </div>
          )}
        </div>
        <button onClick={handleLogout} className="btn btn-secondary btn-sm">Logout</button>
      </div>
    </header>
  );

  if (!hasRootPerson) {
    return (
      <div style={{ minHeight: '100vh', background: '#f3f4f6', display: 'flex', flexDirection: 'column' }}>
        {header}
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
          <div className="card" style={{ maxWidth: '640px', width: '100%' }}>
            <h2 className="card-header">Create Your Family Tree</h2>
            <p style={{ color: '#4b5563', marginBottom: '24px' }}>Start by entering your information. This will be the root of your family tree.</p>
            <PersonForm onSubmit={handleCreateRootPerson} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {header}

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* ── Left panel ─────────────────────────────────────── */}
        <div style={{ width: '270px', flexShrink: 0, background: 'white', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {selectedPerson ? (
            <>
              {/* Person banner */}
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', background: '#f9fafb', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {selectedPerson.photo ? (
                    <img src={selectedPerson.photo} alt="" style={{ width: '44px', height: '44px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e5e7eb', flexShrink: 0 }} onError={(e) => { e.target.style.display = 'none'; }} />
                  ) : (
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: selectedPerson.colorLabel || '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700, color: '#1d4ed8', flexShrink: 0, border: '2px solid #e5e7eb' }}>
                      {selectedPerson.givenNames?.[0]}{selectedPerson.surname?.[0]}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2 style={{ fontWeight: 700, fontSize: '14px', color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedPerson.givenNames} {selectedPerson.surname}
                    </h2>
                    {selectedPerson.gender    && <p style={{ fontSize: '11px', color: '#6b7280', margin: '2px 0 0' }}>Gender: {selectedPerson.gender}</p>}
                    {selectedPerson.birthDate && <p style={{ fontSize: '11px', color: '#6b7280', margin: '1px 0 0' }}>Born: {selectedPerson.birthDate}</p>}
                  </div>
                  <button onClick={() => dispatch(selectPerson(undefined))} style={{ color: '#9ca3af', background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', flexShrink: 0, alignSelf: 'flex-start' }}>✕</button>
                </div>
              </div>

              {/* Tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', flexShrink: 0 }}>
                {[{ id: 'details', label: 'Details' }, { id: 'add', label: 'Add' }, { id: 'edit', label: 'Edit' }, { id: 'styles', label: 'Styles' }].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSidePanelTab(tab.id)}
                    style={{ flex: 1, padding: '8px 2px', fontSize: '11px', fontWeight: 500, border: 'none', borderBottom: sidePanelTab === tab.id ? '2px solid #2563eb' : '2px solid transparent', color: sidePanelTab === tab.id ? '#2563eb' : '#6b7280', background: sidePanelTab === tab.id ? '#eff6ff' : 'white', cursor: 'pointer', transition: 'all 0.1s' }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
                {sidePanelTab === 'details' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '13px' }}>
                    {selectedPerson.nickname   && <InfoRow label="Nickname"   value={selectedPerson.nickname} />}
                    {selectedPerson.profession && <InfoRow label="Profession" value={selectedPerson.profession} />}
                    {selectedPerson.birthPlace && <InfoRow label="Birth Place" value={selectedPerson.birthPlace} />}
                    {selectedPerson.deathDate  && <InfoRow label="Died"        value={selectedPerson.deathDate} color="#dc2626" />}
                    {selectedPerson.email && (
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <span style={{ fontWeight: 600, color: '#374151', minWidth: '70px', flexShrink: 0 }}>Email</span>
                        <a href={`mailto:${selectedPerson.email}`} style={{ color: '#2563eb', wordBreak: 'break-all', fontSize: '12px' }}>{selectedPerson.email}</a>
                      </div>
                    )}
                    {selectedPerson.phone    && <InfoRow label="Phone"    value={selectedPerson.phone} />}
                    {selectedPerson.address  && <InfoRow label="Address"  value={selectedPerson.address} />}
                    {selectedPerson.interests && <InfoRow label="Interests" value={selectedPerson.interests} />}
                    {selectedPerson.bio && (
                      <div style={{ marginTop: '8px', padding: '10px', background: '#f9fafb', borderRadius: '6px', fontSize: '12px', color: '#374151', fontStyle: 'italic', borderLeft: '3px solid #bfdbfe' }}>
                        "{selectedPerson.bio}"
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                      <button onClick={() => setSidePanelTab('edit')} className="btn btn-primary btn-sm" style={{ flex: 1 }}>Edit Details</button>
                      <button onClick={() => { if (window.confirm(`Delete ${selectedPerson.givenNames} ${selectedPerson.surname}?`)) dispatch(deletePerson(selectedPersonId)); }} className="btn btn-danger btn-sm" style={{ flex: 1 }}>Delete</button>
                    </div>
                  </div>
                )}

                {sidePanelTab === 'add' && (
                  <AddFamilyMemberButtons personId={selectedPersonId} quickAddRequest={quickAddRequest} onConsumeQuickAdd={() => setQuickAddRequest(null)} />
                )}

                {sidePanelTab === 'edit' && (
                  <PersonForm person={selectedPerson} onSubmit={handleUpdatePerson} />
                )}

                {sidePanelTab === 'styles' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <p style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '4px' }}>Customize relationship line colors and styles.</p>
                    {Object.entries(EDGE_TYPE_LABELS).map(([type, label]) => {
                      const pref = edgePreferences[type] || DEFAULT_EDGE_PREFERENCES[type];
                      return (
                        <div key={type} style={{ padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: pref.color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 600, fontSize: '13px', color: '#374151' }}>{label}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input type="color" value={pref.color} onChange={(e) => updateEdgePreference(type, 'color', e.target.value)} style={{ width: '36px', height: '30px', border: '1px solid #d1d5db', borderRadius: '4px', padding: '2px', cursor: 'pointer' }} />
                            <select value={pref.lineStyle} onChange={(e) => updateEdgePreference(type, 'lineStyle', e.target.value)} style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: '6px', padding: '4px 8px', fontSize: '12px' }}>
                              <option value="solid">Solid</option>
                              <option value="dotted">Dotted</option>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
              <div style={{ fontSize: '36px' }}>🌳</div>
              <p style={{ fontSize: '13px' }}>Click on a person in the tree to view their details</p>
            </div>
          )}
        </div>

        {/* ── Graph ──────────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <FamilyTreeView
            onSelectPerson={handleSelectPerson}
            onEditPerson={handleEditPersonFromTree}
            onQuickAddRelation={handleQuickAddFromTree}
            edgePreferences={edgePreferences}
          />
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, color }) {
  return (
    <div style={{ display: 'flex', gap: '6px' }}>
      <span style={{ fontWeight: 600, color: '#374151', minWidth: '70px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: color || '#4b5563', wordBreak: 'break-word' }}>{value}</span>
    </div>
  );
}
