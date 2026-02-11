import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import type { Property } from '../types';
import { PropertyStatus } from '../types';

type ReviewFilter =
  | 'ALL'
  | 'MISSING_BILL'
  | 'MISSING_SIGNATURE'
  | 'MISSING_AGE'
  | 'MISSING_NOTES';

const STATUS_GROUPS: Array<{ key: PropertyStatus; label: string }> = [
  { key: PropertyStatus.VISITED, label: 'Visited' },
  { key: PropertyStatus.READY_FOR_SUBMISSION, label: 'Ready For Submission' },
  { key: PropertyStatus.COMPLETE, label: 'Complete' },
];

function hasDocument(property: Property, docType: string): boolean {
  return (property.documents || []).some((document) => document.docType === docType);
}

function ChecklistItem({
  label,
  completed,
}: {
  label: string;
  completed: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
        completed
          ? 'bg-green-100 text-green-800'
          : 'bg-amber-100 text-amber-800'
      }`}
    >
      {completed ? '✓' : '•'} {label}
    </span>
  );
}

export const FieldOpsReview: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>('ALL');

  const loadProperties = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await api.getFieldOpsProperties();
      setProperties(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load field operations data'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProperties();
  }, []);

  const filteredProperties = useMemo(() => {
    return properties.filter((property) => {
      switch (filter) {
        case 'MISSING_BILL':
          return !hasDocument(property, 'BILL');
        case 'MISSING_SIGNATURE':
          return !hasDocument(property, 'SIGNATURE');
        case 'MISSING_AGE':
          return !property.customerAge;
        case 'MISSING_NOTES':
          return !property.fieldNotes?.trim();
        default:
          return true;
      }
    });
  }, [filter, properties]);

  const grouped = useMemo(() => {
    return STATUS_GROUPS.map((group) => ({
      ...group,
      items: filteredProperties.filter((property) => property.status === group.key),
    }));
  }, [filteredProperties]);

  const quickFilterMeta: Array<{ key: ReviewFilter; label: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'MISSING_BILL', label: 'Missing Bill' },
    { key: 'MISSING_SIGNATURE', label: 'Missing Signature' },
    { key: 'MISSING_AGE', label: 'Missing Age' },
    { key: 'MISSING_NOTES', label: 'Missing Notes' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Field Ops Review</h1>
          <p className="text-sm text-gray-600 mt-1">
            Review BILL/SIGNATURE uploads and field data before submission.
          </p>
        </div>
        <button
          onClick={() => void loadProperties()}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 w-fit"
        >
          Refresh
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickFilterMeta.map((option) => (
          <button
            key={option.key}
            onClick={() => setFilter(option.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === option.key
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
          Loading field operations data...
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error}
        </div>
      )}

      {!loading &&
        !error &&
        grouped.map((group) => (
          <section key={group.key} className="bg-white rounded-lg shadow">
            <div className="px-5 py-4 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">{group.label}</h2>
              <span className="text-sm text-gray-500">{group.items.length} properties</span>
            </div>

            {group.items.length === 0 ? (
              <p className="px-5 py-5 text-sm text-gray-500">No properties in this group.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {group.items.map((property) => {
                  const hasBill = hasDocument(property, 'BILL');
                  const hasSignature = hasDocument(property, 'SIGNATURE');
                  const hasAge = Boolean(property.customerAge);
                  const hasNotes = Boolean(property.fieldNotes?.trim());
                  const hasCaseId = Boolean(property.sceCaseId);

                  return (
                    <article key={property.id} className="px-5 py-4 space-y-3">
                      <div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:items-start">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-900">
                            #{property.id} {property.addressFull}
                          </h3>
                          <p className="text-xs text-gray-600">
                            {property.customerName || 'No customer name'} •{' '}
                            {property.customerPhone || 'No customer phone'}
                          </p>
                        </div>
                        <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 font-medium">
                          {property.status}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <ChecklistItem label="BILL" completed={hasBill} />
                        <ChecklistItem label="SIGNATURE" completed={hasSignature} />
                        <ChecklistItem label="Age" completed={hasAge} />
                        <ChecklistItem label="Notes" completed={hasNotes} />
                        <ChecklistItem label="SCE Case ID" completed={hasCaseId} />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        ))}
    </div>
  );
};
