import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addPerson, addRelationship } from '../store/slices/familyTreeSlice';
import PersonForm from './PersonForm';

export default function AddFamilyMemberButtons({ personId, quickAddRequest, onConsumeQuickAdd }) {
  const [showForm, setShowForm] = useState(null); // 'parent', 'child', 'spouse', 'ex_spouse', 'sibling', null
  const dispatch = useDispatch();
  const selectedPersonId = useSelector((state) => state.familyTree.selectedPersonId);
  const targetPersonId = selectedPersonId || personId;

  useEffect(() => {
    if (!quickAddRequest?.relationType) {
      return;
    }

    setShowForm(quickAddRequest.relationType);

    if (onConsumeQuickAdd) {
      onConsumeQuickAdd();
    }
  }, [quickAddRequest, onConsumeQuickAdd]);

  const handleAddMember = (type) => (formData) => {
    const newPersonId = Math.random().toString(36).substr(2, 9);

    // Add the person
    dispatch(addPerson({ ...formData, id: newPersonId }));

    // Add relationship
    let relationshipType = '';
    if (type === 'parent') {
      relationshipType = 'parent';
      dispatch(addRelationship({ fromId: newPersonId, toId: targetPersonId, type: relationshipType }));
    } else if (type === 'child') {
      relationshipType = 'child';
      dispatch(addRelationship({ fromId: targetPersonId, toId: newPersonId, type: relationshipType }));
    } else if (type === 'spouse') {
      relationshipType = 'spouse';
      dispatch(addRelationship({ fromId: targetPersonId, toId: newPersonId, type: relationshipType }));
      dispatch(addRelationship({ fromId: newPersonId, toId: targetPersonId, type: relationshipType }));
    } else if (type === 'ex_spouse') {
      relationshipType = 'ex_spouse';
      dispatch(addRelationship({ fromId: targetPersonId, toId: newPersonId, type: relationshipType }));
      dispatch(addRelationship({ fromId: newPersonId, toId: targetPersonId, type: relationshipType }));
    } else if (type === 'sibling') {
      relationshipType = 'sibling';
      dispatch(addRelationship({ fromId: targetPersonId, toId: newPersonId, type: relationshipType }));
      dispatch(addRelationship({ fromId: newPersonId, toId: targetPersonId, type: relationshipType }));
    }

    setShowForm(null);
  };

  if (!targetPersonId) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-sm text-yellow-800">Select a person first to add family members</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        <button
          onClick={() => setShowForm('parent')}
          className="btn btn-primary btn-sm"
        >
          + Add Parent
        </button>
        <button
          onClick={() => setShowForm('child')}
          className="btn btn-primary btn-sm"
        >
          + Add Child
        </button>
        <button
          onClick={() => setShowForm('spouse')}
          className="btn btn-primary btn-sm"
        >
          + Add Spouse
        </button>
        <button
          onClick={() => setShowForm('ex_spouse')}
          className="btn btn-primary btn-sm"
        >
          + Add Ex Spouse
        </button>
        <button
          onClick={() => setShowForm('sibling')}
          className="btn btn-primary btn-sm"
        >
          + Add Sibling
        </button>
      </div>

      {showForm && (
        <div className="card">
          <h3 className="card-header">
            Add {showForm.charAt(0).toUpperCase() + showForm.slice(1)}
          </h3>
          <PersonForm
            onSubmit={handleAddMember(showForm)}
          />
          <button
            onClick={() => setShowForm(null)}
            className="btn btn-secondary btn-sm mt-4"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
