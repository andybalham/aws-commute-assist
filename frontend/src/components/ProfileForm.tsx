import { useState } from 'react';
import { StationAutocomplete } from './StationAutocomplete';
import { TflLineSelector, isLondonTerminus } from './TflLineSelector';
import type { CommuteProfile } from '../api/types';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

interface StationState {
  crs: string;
  name: string;
}

interface FormState {
  name: string;
  outboundOrigin: StationState;
  outboundDestination: StationState;
  outboundTime: string;
  returnOrigin: StationState;
  returnDestination: StationState;
  returnTime: string;
  tflLines: string[];
}

interface FormErrors {
  name?: string;
  'outbound.originCRS'?: string;
  'outbound.destinationCRS'?: string;
  'outbound.departureTime'?: string;
  'return.originCRS'?: string;
  'return.destinationCRS'?: string;
  'return.departureTime'?: string;
}

function emptyForm(): FormState {
  return {
    name: '',
    outboundOrigin: { crs: '', name: '' },
    outboundDestination: { crs: '', name: '' },
    outboundTime: '',
    returnOrigin: { crs: '', name: '' },
    returnDestination: { crs: '', name: '' },
    returnTime: '',
    tflLines: [],
  };
}

function profileToForm(p: CommuteProfile): FormState {
  return {
    name: p.name,
    outboundOrigin: { crs: p.outbound.originCRS, name: '' },
    outboundDestination: { crs: p.outbound.destinationCRS, name: '' },
    outboundTime: p.outbound.departureTime,
    returnOrigin: { crs: p.return.originCRS, name: '' },
    returnDestination: { crs: p.return.destinationCRS, name: '' },
    returnTime: p.return.departureTime,
    tflLines: p.tflLines ?? [],
  };
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Profile name is required';
  if (!form.outboundOrigin.crs) errors['outbound.originCRS'] = 'Origin station is required';
  if (!form.outboundDestination.crs) errors['outbound.destinationCRS'] = 'Destination station is required';
  if (!form.outboundTime) {
    errors['outbound.departureTime'] = 'Departure time is required';
  } else if (!TIME_REGEX.test(form.outboundTime)) {
    errors['outbound.departureTime'] = 'Must be HH:MM (00:00–23:59)';
  }
  if (!form.returnOrigin.crs) errors['return.originCRS'] = 'Origin station is required';
  if (!form.returnDestination.crs) errors['return.destinationCRS'] = 'Destination station is required';
  if (!form.returnTime) {
    errors['return.departureTime'] = 'Departure time is required';
  } else if (!TIME_REGEX.test(form.returnTime)) {
    errors['return.departureTime'] = 'Must be HH:MM (00:00–23:59)';
  }
  return errors;
}

interface ProfileFormProps {
  profile?: CommuteProfile;
  onSubmit: (data: {
    name: string;
    outbound: { originCRS: string; destinationCRS: string; departureTime: string };
    return: { originCRS: string; destinationCRS: string; departureTime: string };
    tflLines: string[];
  }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function ProfileForm({ profile, onSubmit, onCancel, isSubmitting }: ProfileFormProps) {
  const [form, setForm] = useState<FormState>(profile ? profileToForm(profile) : emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});

  function setOutboundOrigin(crs: string, name: string) {
    setForm((prev) => ({
      ...prev,
      outboundOrigin: { crs, name },
      returnDestination: { crs, name },
    }));
  }

  function setOutboundDestination(crs: string, name: string) {
    setForm((prev) => ({
      ...prev,
      outboundDestination: { crs, name },
      returnOrigin: { crs, name },
    }));
  }

  const showTfl =
    isLondonTerminus(form.outboundDestination.crs) ||
    isLondonTerminus(form.returnDestination.crs);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    onSubmit({
      name: form.name.trim(),
      outbound: {
        originCRS: form.outboundOrigin.crs,
        destinationCRS: form.outboundDestination.crs,
        departureTime: form.outboundTime,
      },
      return: {
        originCRS: form.returnOrigin.crs,
        destinationCRS: form.returnDestination.crs,
        departureTime: form.returnTime,
      },
      tflLines: showTfl ? form.tflLines : [],
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Profile name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Profile Name</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="e.g. Weekday Commute"
          className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            errors.name ? 'border-red-400' : 'border-gray-300'
          }`}
        />
        {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
      </div>

      {/* Outbound leg */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-gray-900">Outbound Journey</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StationAutocomplete
            label="Origin"
            value={form.outboundOrigin.crs}
            stationName={form.outboundOrigin.crs ? `${form.outboundOrigin.name || form.outboundOrigin.crs}` : ''}
            onChange={setOutboundOrigin}
            error={errors['outbound.originCRS']}
          />
          <StationAutocomplete
            label="Destination"
            value={form.outboundDestination.crs}
            stationName={form.outboundDestination.crs ? `${form.outboundDestination.name || form.outboundDestination.crs}` : ''}
            onChange={setOutboundDestination}
            error={errors['outbound.destinationCRS']}
          />
        </div>
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time</label>
          <input
            type="time"
            value={form.outboundTime}
            onChange={(e) => setForm({ ...form, outboundTime: e.target.value })}
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors['outbound.departureTime'] ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors['outbound.departureTime'] && (
            <p className="mt-1 text-xs text-red-600">{errors['outbound.departureTime']}</p>
          )}
        </div>
      </fieldset>

      {/* Return leg */}
      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-gray-900">Return Journey</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <StationAutocomplete
            label="Origin"
            value={form.returnOrigin.crs}
            stationName={form.returnOrigin.crs ? `${form.returnOrigin.name || form.returnOrigin.crs}` : ''}
            onChange={(crs, name) => setForm({ ...form, returnOrigin: { crs, name } })}
            error={errors['return.originCRS']}
          />
          <StationAutocomplete
            label="Destination"
            value={form.returnDestination.crs}
            stationName={form.returnDestination.crs ? `${form.returnDestination.name || form.returnDestination.crs}` : ''}
            onChange={(crs, name) => setForm({ ...form, returnDestination: { crs, name } })}
            error={errors['return.destinationCRS']}
          />
        </div>
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">Departure Time</label>
          <input
            type="time"
            value={form.returnTime}
            onChange={(e) => setForm({ ...form, returnTime: e.target.value })}
            className={`w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors['return.departureTime'] ? 'border-red-400' : 'border-gray-300'
            }`}
          />
          {errors['return.departureTime'] && (
            <p className="mt-1 text-xs text-red-600">{errors['return.departureTime']}</p>
          )}
        </div>
      </fieldset>

      {/* TfL lines (conditional) */}
      {showTfl && (
        <TflLineSelector
          selected={form.tflLines}
          onChange={(lines) => setForm({ ...form, tflLines: lines })}
        />
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? 'Saving...' : profile ? 'Update Profile' : 'Create Profile'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
