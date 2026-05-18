import { useForm, Controller } from 'react-hook-form';
import { useEffect } from 'react';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

export default function PersonForm({ person, onSubmit, isReadOnly = false }) {
  const { register, handleSubmit, watch, control, setValue } = useForm({
    defaultValues: person || {
      givenNames: '',
      surname: '',
      nickname: '',
      gender: 'Other',
      birthDate: '',
      birthPlace: '',
      deathDate: '',
      email: '',
      phone: '',
      address: '',
      profession: '',
      interests: '',
      bio: '',
      photo: '',
      colorLabel: '',
      customFields: {},
    },
  });

  const colorLabel = watch('colorLabel');

  useEffect(() => {
    if (person) {
      Object.keys(person).forEach((key) => {
        setValue(key, person[key]);
      });
    }
  }, [person, setValue]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Name Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Basic Information</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label htmlFor="givenNames">Given Names</label>
            <input
              id="givenNames"
              {...register('givenNames')}
              disabled={isReadOnly}
              placeholder="e.g., John"
            />
          </div>
          <div className="form-group">
            <label htmlFor="surname">Surname</label>
            <input
              id="surname"
              {...register('surname')}
              disabled={isReadOnly}
              placeholder="e.g., Smith"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label htmlFor="nickname">Nickname</label>
            <input
              id="nickname"
              {...register('nickname')}
              disabled={isReadOnly}
              placeholder="e.g., Jack"
            />
          </div>
          <div className="form-group">
            <label htmlFor="gender">Gender</label>
            <select {...register('gender')} disabled={isReadOnly}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Life Events */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Life Events</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label htmlFor="birthDate">Birth Date</label>
            <input
              id="birthDate"
              type="date"
              {...register('birthDate')}
              disabled={isReadOnly}
            />
          </div>
          <div className="form-group">
            <label htmlFor="birthPlace">Birth Place</label>
            <input
              id="birthPlace"
              {...register('birthPlace')}
              disabled={isReadOnly}
              placeholder="e.g., New York, USA"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label htmlFor="deathDate">Death Date</label>
            <input
              id="deathDate"
              type="date"
              {...register('deathDate')}
              disabled={isReadOnly}
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Contact Information</h3>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            {...register('email')}
            disabled={isReadOnly}
            placeholder="john@example.com"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-group">
            <label htmlFor="phone">Phone</label>
            <input
              id="phone"
              {...register('phone')}
              disabled={isReadOnly}
              placeholder="+1 (555) 000-0000"
            />
          </div>
          <div className="form-group">
            <label htmlFor="address">Address</label>
            <input
              id="address"
              {...register('address')}
              disabled={isReadOnly}
              placeholder="Street, City, State"
            />
          </div>
        </div>
      </div>

      {/* Professional & Personal */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Professional & Personal</h3>

        <div className="form-group">
          <label htmlFor="profession">Profession</label>
          <input
            id="profession"
            {...register('profession')}
            disabled={isReadOnly}
            placeholder="e.g., Engineer, Teacher"
          />
        </div>

        <div className="form-group">
          <label htmlFor="interests">Interests & Hobbies</label>
          <input
            id="interests"
            {...register('interests')}
            disabled={isReadOnly}
            placeholder="e.g., Photography, Gardening"
          />
        </div>

        <div className="form-group">
          <label htmlFor="bio">Biography</label>
          <textarea
            id="bio"
            {...register('bio')}
            disabled={isReadOnly}
            placeholder="Write a short biography..."
            rows="4"
          />
        </div>
      </div>

      {/* Photo & Color Label */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800">Photo & Label</h3>

        <div className="form-group">
          <label htmlFor="photo">Photo URL</label>
          <input
            id="photo"
            {...register('photo')}
            disabled={isReadOnly}
            placeholder="https://example.com/photo.jpg"
          />
        </div>

        {!isReadOnly && (
          <div className="form-group">
            <label>Color Label</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setValue('colorLabel', color)}
                  className={`color-label ${colorLabel === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>
        )}
        {colorLabel && (
          <div
            className="w-8 h-8 rounded border-2 border-gray-300"
            style={{ backgroundColor: colorLabel }}
          />
        )}
      </div>

      {!isReadOnly && (
        <div className="flex gap-4 pt-4">
          <button type="submit" className="btn btn-primary flex-1">
            Save Person
          </button>
        </div>
      )}
    </form>
  );
}
