import { useSelector, useDispatch } from 'react-redux';
import { selectPerson, deletePerson } from '../store/slices/familyTreeSlice';

export default function PersonCard({ personId, onEdit }) {
  const person = useSelector((state) => state.familyTree.people[personId]);
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const dispatch = useDispatch();
  const selectedPersonId = useSelector((state) => state.familyTree.selectedPersonId);

  if (!person) return null;

  const handleDelete = () => {
    if (window.confirm(`Delete ${person.givenNames} ${person.surname}?`)) {
      dispatch(deletePerson(personId));
    }
  };

  const handleSelect = () => {
    dispatch(selectPerson(personId));
  };

  const handleEdit = (event) => {
    event.stopPropagation();
    if (onEdit) {
      onEdit(personId);
    }
  };

  const isSelected = selectedPersonId === personId;

  return (
    <div
      className={`card cursor-pointer transition-all transform hover:scale-105 ${
        isSelected ? 'ring-2 ring-blue-500 shadow-lg' : ''
      }`}
      onClick={handleSelect}
      style={person.colorLabel ? { borderLeft: `4px solid ${person.colorLabel}` } : {}}
    >
      {person.photo && (
        <div className="mb-4 -mx-5 -mt-5 mb-4">
          <img
            src={person.photo}
            alt={`${person.givenNames} ${person.surname}`}
            className="w-full h-48 object-cover rounded-t"
            onError={(e) => {
              e.target.style.display = 'none';
            }}
          />
        </div>
      )}

      <div className="space-y-2">
        <h3 className="text-lg font-bold text-gray-800">
          {person.givenNames} <span className="font-semibold">{person.surname}</span>
        </h3>

        {person.nickname && (
          <p className="text-sm text-gray-600">
            <strong>Nickname:</strong> {person.nickname}
          </p>
        )}

        {person.gender && (
          <p className="text-sm text-gray-600">
            <strong>Gender:</strong> {person.gender}
          </p>
        )}

        {person.birthDate && (
          <p className="text-sm text-gray-600">
            <strong>Born:</strong> {person.birthDate}
            {person.birthPlace && ` in ${person.birthPlace}`}
          </p>
        )}

        {person.deathDate && (
          <p className="text-sm text-red-600">
            <strong>Died:</strong> {person.deathDate}
          </p>
        )}

        {person.profession && (
          <p className="text-sm text-gray-600">
            <strong>Profession:</strong> {person.profession}
          </p>
        )}

        {person.email && (
          <p className="text-sm text-gray-600">
            <strong>Email:</strong> <a href={`mailto:${person.email}`} className="text-blue-600 hover:underline">{person.email}</a>
          </p>
        )}

        {person.phone && (
          <p className="text-sm text-gray-600">
            <strong>Phone:</strong> {person.phone}
          </p>
        )}

        {person.bio && (
          <p className="text-sm text-gray-700 mt-3 italic">
            "{person.bio}"
          </p>
        )}

        {isAuthenticated && (
          <div className="flex gap-2 mt-4 pt-4 border-t">
            {onEdit && (
              <button onClick={handleEdit} className="btn btn-primary btn-sm flex-1">
                Edit Details
              </button>
            )}
            <button onClick={handleDelete} className="btn btn-danger btn-sm flex-1">
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
