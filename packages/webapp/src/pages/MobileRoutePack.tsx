import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { generateRouteSheet } from '../lib/pdf-generator';
import type { MobileRoutePlanResponse, Property } from '../types';

interface PlannedRouteState {
  plan: MobileRoutePlanResponse;
  orderedProperties: Property[];
}

function parseStartCoordinates(
  rawStartLat: string,
  rawStartLon: string
): {
  startLat?: number;
  startLon?: number;
  error?: string;
} {
  const hasLat = rawStartLat.trim() !== '';
  const hasLon = rawStartLon.trim() !== '';

  if (!hasLat && !hasLon) {
    return {};
  }

  if (hasLat !== hasLon) {
    return { error: 'Provide both start latitude and start longitude or leave both blank.' };
  }

  const parsedLat = Number(rawStartLat);
  const parsedLon = Number(rawStartLon);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLon)) {
    return { error: 'Start latitude and longitude must be valid numbers.' };
  }

  return { startLat: parsedLat, startLon: parsedLon };
}

function createOrderedProperties(
  allProperties: Property[],
  planned: MobileRoutePlanResponse
): Property[] {
  const map = new Map<number, Property>();
  for (const property of allProperties) {
    map.set(property.id, property);
  }
  for (const property of planned.properties) {
    map.set(property.id, property);
  }

  return planned.orderedPropertyIds
    .map((propertyId) => map.get(propertyId))
    .filter((property): property is Property => Boolean(property));
}

export const MobileRoutePack: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [routeName, setRouteName] = useState('Field Route');
  const [description, setDescription] = useState('');
  const [startLat, setStartLat] = useState('');
  const [startLon, setStartLon] = useState('');
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const [plannedRoute, setPlannedRoute] = useState<PlannedRouteState | null>(null);

  useEffect(() => {
    const loadProperties = async () => {
      setLoadingProperties(true);
      setError(null);

      try {
        const data = await api.getProperties({ limit: 1000 });
        setProperties(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load properties');
      } finally {
        setLoadingProperties(false);
      }
    };

    void loadProperties();
  }, []);

  useEffect(() => {
    // Any change to planning inputs invalidates the current planned route.
    setPlannedRoute(null);
  }, [routeName, description, startLat, startLon, selectedPropertyIds]);

  const selectedCount = selectedPropertyIds.length;

  const selectedProperties = useMemo(() => {
    const selected = new Set(selectedPropertyIds);
    return properties.filter((property) => selected.has(property.id));
  }, [properties, selectedPropertyIds]);

  const togglePropertySelection = (propertyId: number) => {
    setSelectedPropertyIds((currentSelection) => {
      if (currentSelection.includes(propertyId)) {
        return currentSelection.filter((id) => id !== propertyId);
      }
      return [...currentSelection, propertyId];
    });
  };

  const handlePlanRoute = async () => {
    const trimmedName = routeName.trim();
    if (!trimmedName) {
      setError('Route name is required.');
      return;
    }

    if (selectedPropertyIds.length === 0) {
      setError('Select at least one property before planning the route.');
      return;
    }

    const startCoordinates = parseStartCoordinates(startLat, startLon);
    if (startCoordinates.error) {
      setError(startCoordinates.error);
      return;
    }

    setPlanning(true);
    setError(null);

    try {
      const plan = await api.createMobileRoutePlan({
        name: trimmedName,
        description: description.trim() || undefined,
        propertyIds: selectedPropertyIds,
        startLat: startCoordinates.startLat,
        startLon: startCoordinates.startLon,
      });

      const orderedProperties = createOrderedProperties(properties, plan);
      if (orderedProperties.length !== plan.orderedPropertyIds.length) {
        throw new Error('Route plan response did not include every selected property');
      }

      setPlannedRoute({ plan, orderedProperties });
    } catch (err) {
      setPlannedRoute(null);
      setError(err instanceof Error ? err.message : 'Failed to plan route');
    } finally {
      setPlanning(false);
    }
  };

  const handleGeneratePdf = async () => {
    if (!plannedRoute || plannedRoute.orderedProperties.length === 0) {
      setError('Plan a route before generating the PDF.');
      return;
    }

    setGeneratingPdf(true);
    setError(null);

    try {
      await generateRouteSheet(plannedRoute.orderedProperties, {
        includeQR: true,
        includeCustomerData: true,
        notes: description.trim(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate route PDF');
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-gray-900">Mobile Route Pack Builder</h1>
        <p className="text-sm text-gray-600">
          Plan a route from deployed webapp access, then generate a fillable QR PDF.
        </p>
      </header>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm text-amber-900 font-medium">Extension-only boundary</p>
        <p className="text-sm text-amber-800 mt-1">
          SCE extraction and SCE submission automation still require the desktop extension.
          This page handles route planning and PDF generation only.
        </p>
      </section>

      {error && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </section>
      )}

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="route-name" className="block text-sm font-medium text-gray-700 mb-1">
              Route name
            </label>
            <input
              id="route-name"
              type="text"
              value={routeName}
              onChange={(event) => setRouteName(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Field Route AM"
            />
          </div>
          <div>
            <label
              htmlFor="route-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description (optional)
            </label>
            <input
              id="route-description"
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="South zone sweep"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="start-lat" className="block text-sm font-medium text-gray-700 mb-1">
              Start latitude (optional)
            </label>
            <input
              id="start-lat"
              inputMode="decimal"
              value={startLat}
              onChange={(event) => setStartLat(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="33.745"
            />
          </div>
          <div>
            <label htmlFor="start-lon" className="block text-sm font-medium text-gray-700 mb-1">
              Start longitude (optional)
            </label>
            <input
              id="start-lon"
              inputMode="decimal"
              value={startLon}
              onChange={(event) => setStartLon(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="-117.867"
            />
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Select properties</h2>
            <p className="text-sm text-gray-600">
              {loadingProperties
                ? 'Loading properties...'
                : `${selectedCount} selected out of ${properties.length}`}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedPropertyIds(properties.map((property) => property.id))}
              disabled={loadingProperties || properties.length === 0}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setSelectedPropertyIds([])}
              disabled={selectedPropertyIds.length === 0}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        </div>

        {properties.length === 0 && !loadingProperties ? (
          <p className="rounded-md border border-dashed border-gray-300 p-4 text-sm text-gray-600">
            No properties found. Add properties first, then return to build a route pack.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {properties.map((property) => {
              const isSelected = selectedPropertyIds.includes(property.id);
              return (
                <button
                  key={property.id}
                  type="button"
                  onClick={() => togglePropertySelection(property.id)}
                  className={`w-full rounded-xl border px-4 py-4 text-left transition min-h-[96px] ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">
                    #{property.id} {property.addressFull}
                  </p>
                  <p className="mt-2 text-xs text-gray-600">
                    {property.customerName || 'No customer name'} •{' '}
                    {property.customerPhone || 'No customer phone'}
                  </p>
                  <p className="mt-2 text-xs font-medium text-gray-500">
                    {isSelected ? 'Selected for route' : 'Tap to include in route'}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm space-y-4">
        <button
          type="button"
          onClick={handlePlanRoute}
          disabled={planning || selectedCount === 0}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-400"
        >
          {planning ? 'Planning route...' : 'Plan Route'}
        </button>

        {plannedRoute && (
          <div className="rounded-md border border-green-200 bg-green-50 p-4 space-y-3">
            <p className="text-sm font-semibold text-green-900">
              Route planned successfully. Ordered stops: {plannedRoute.plan.orderedPropertyIds.length}
            </p>
            <div className="max-h-52 overflow-auto rounded bg-white p-3 border border-green-200">
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700">
                {plannedRoute.orderedProperties.map((property) => (
                  <li key={property.id}>
                    #{property.id} {property.addressFull}
                  </li>
                ))}
              </ol>
            </div>
            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={generatingPdf}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-base font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {generatingPdf ? 'Generating PDF...' : 'Generate PDF'}
            </button>
          </div>
        )}
      </section>

      {selectedProperties.length > 0 && (
        <p className="text-xs text-gray-500">
          Planned route uses {selectedProperties.length} selected properties and writes ordered IDs to
          the route record for later field execution.
        </p>
      )}
    </div>
  );
};
