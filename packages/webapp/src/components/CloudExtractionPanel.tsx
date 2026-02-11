import React, { useEffect, useMemo, useState } from 'react';
import { APIError, api } from '../lib/api';
import type { ExtractionRun, ExtractionSession, Property } from '../types';

interface CloudExtractionPanelProps {
  pendingProperties: Property[];
  onRunSettled?: () => Promise<void> | void;
}

function toDatetimeLocalValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof APIError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unknown cloud extraction error';
}

function parsePropertyIdInput(value: string): number[] {
  const tokens = value
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    throw new Error('Enter at least one property ID.');
  }

  const propertyIds = tokens.map((token) => {
    const parsed = Number(token);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(`Invalid property ID: ${token}`);
    }
    return parsed;
  });

  return [...new Set(propertyIds)];
}

export const CloudExtractionPanel: React.FC<CloudExtractionPanelProps> = ({
  pendingProperties,
  onRunSettled,
}) => {
  const defaultPropertyIds = useMemo(
    () => pendingProperties.map((property) => property.id).join(','),
    [pendingProperties]
  );
  const [sessions, setSessions] = useState<ExtractionSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [propertyIdsInput, setPropertyIdsInput] = useState(defaultPropertyIds);
  const [currentRun, setCurrentRun] = useState<ExtractionRun | null>(null);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [startingRun, setStartingRun] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [creatingBridgeSession, setCreatingBridgeSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionLabel, setSessionLabel] = useState('SCE Operator Session');
  const [sessionStateJson, setSessionStateJson] = useState('');
  const [sessionExpiresAt, setSessionExpiresAt] = useState(
    toDatetimeLocalValue(new Date(Date.now() + 8 * 60 * 60 * 1000))
  );
  const [bridgeLabel, setBridgeLabel] = useState('SCE Login Bridge Session');
  const [bridgeUsername, setBridgeUsername] = useState('');
  const [bridgePassword, setBridgePassword] = useState('');
  const [bridgeExpiresAt, setBridgeExpiresAt] = useState(
    toDatetimeLocalValue(new Date(Date.now() + 8 * 60 * 60 * 1000))
  );

  useEffect(() => {
    setPropertyIdsInput(defaultPropertyIds);
  }, [defaultPropertyIds]);

  const loadSessions = async () => {
    setLoadingSessions(true);
    setError(null);
    try {
      const data = await api.listExtractionSessions();
      setSessions(data);
      if (data.length === 0) {
        setSelectedSessionId(null);
        return;
      }

      if (selectedSessionId && data.some((session) => session.id === selectedSessionId)) {
        return;
      }

      const firstActive = data.find((session) => session.isActive);
      setSelectedSessionId(firstActive?.id ?? data[0].id);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    void loadSessions();
  }, []);

  useEffect(() => {
    if (!activeRunId) return;

    let cancelled = false;
    const pollRun = async () => {
      try {
        const run = await api.getCloudExtractionRun(activeRunId);
        if (cancelled) return;
        setCurrentRun(run);

        if (!['QUEUED', 'RUNNING'].includes(run.status)) {
          setActiveRunId(null);
          if (onRunSettled) {
            await onRunSettled();
          }
        }
      } catch (err) {
        if (cancelled) return;
        setError(toErrorMessage(err));
        setActiveRunId(null);
      }
    };

    void pollRun();
    const interval = setInterval(() => {
      void pollRun();
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activeRunId, onRunSettled]);

  const handleCreateSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!sessionLabel.trim()) {
      setError('Session label is required.');
      return;
    }

    if (!sessionStateJson.trim()) {
      setError('Session JSON is required.');
      return;
    }

    try {
      JSON.parse(sessionStateJson);
    } catch {
      setError('Session JSON must be valid JSON.');
      return;
    }

    const expiresAtDate = new Date(sessionExpiresAt);
    if (Number.isNaN(expiresAtDate.getTime())) {
      setError('Session expiration must be valid.');
      return;
    }

    setCreatingSession(true);
    try {
      const created = await api.createExtractionSession({
        label: sessionLabel.trim(),
        sessionStateJson: sessionStateJson.trim(),
        expiresAt: expiresAtDate.toISOString(),
      });
      setSessions((prev) => [created, ...prev]);
      setSelectedSessionId(created.id);
      setSessionStateJson('');
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setCreatingSession(false);
    }
  };

  const handleCreateBridgeSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!bridgeLabel.trim()) {
      setError('Bridge session label is required.');
      return;
    }
    if (!bridgeUsername.trim()) {
      setError('SCE username is required.');
      return;
    }
    if (!bridgePassword) {
      setError('SCE password is required.');
      return;
    }

    const expiresAtDate = new Date(bridgeExpiresAt);
    if (Number.isNaN(expiresAtDate.getTime())) {
      setError('Bridge session expiration must be valid.');
      return;
    }

    setCreatingBridgeSession(true);
    try {
      const created = await api.createExtractionSessionFromLogin({
        label: bridgeLabel.trim(),
        username: bridgeUsername.trim(),
        password: bridgePassword,
        expiresAt: expiresAtDate.toISOString(),
      });
      setSessions((prev) => [created, ...prev]);
      setSelectedSessionId(created.id);
      setBridgePassword('');
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setCreatingBridgeSession(false);
    }
  };

  const handleRun = async () => {
    if (!selectedSessionId) {
      setError('Select a session before running extraction.');
      return;
    }

    setError(null);
    let propertyIds: number[];
    try {
      propertyIds = parsePropertyIdInput(propertyIdsInput);
    } catch (err) {
      setError(toErrorMessage(err));
      return;
    }

    setStartingRun(true);
    try {
      const run = await api.createCloudExtractionRun({
        sessionId: selectedSessionId,
        propertyIds,
      });
      setCurrentRun(run);

      const started = await api.startCloudExtractionRun(run.id);
      setCurrentRun((prev) => (prev ? { ...prev, status: started.status } : prev));
      setActiveRunId(run.id);
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setStartingRun(false);
    }
  };

  return (
    <section className="rounded-lg border border-blue-200 bg-blue-50/40 p-4 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Cloud Extraction</h2>
        <p className="text-sm text-gray-700">
          Run SCE extraction server-side for currently queued properties.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Session</label>
          <div className="flex items-center gap-2">
            <select
              value={selectedSessionId ?? ''}
              onChange={(event) =>
                setSelectedSessionId(event.target.value ? Number(event.target.value) : null)
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loadingSessions}
            >
              <option value="">Select session</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.label} (expires {new Date(session.expiresAt).toLocaleString()})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadSessions()}
              className="rounded-md border border-blue-300 bg-white px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
            >
              Refresh
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            Active pending properties: {pendingProperties.length}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Property IDs (comma-separated)
          </label>
          <input
            value={propertyIdsInput}
            onChange={(event) => setPropertyIdsInput(event.target.value)}
            placeholder="101,102,103"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-gray-600">
            Defaults to all currently pending scrape IDs.
          </p>
        </div>
      </div>

      <details className="rounded-md border border-gray-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-800">
          Create session via login bridge (recommended for mobile)
        </summary>
        <form className="mt-3 space-y-3" onSubmit={handleCreateBridgeSession}>
          <p className="text-xs text-gray-600">
            Enter SCE credentials once. Cloud logs in and stores only encrypted session state.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <input
              value={bridgeLabel}
              onChange={(event) => setBridgeLabel(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="SCE Login Bridge Session"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SCE Username</label>
              <input
                type="text"
                value={bridgeUsername}
                onChange={(event) => setBridgeUsername(event.target.value)}
                autoComplete="username"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="first.last@sce.tac"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SCE Password</label>
              <input
                type="password"
                value={bridgePassword}
                onChange={(event) => setBridgePassword(event.target.value)}
                autoComplete="current-password"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Password"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expires At</label>
            <input
              type="datetime-local"
              value={bridgeExpiresAt}
              onChange={(event) => setBridgeExpiresAt(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={creatingBridgeSession}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {creatingBridgeSession ? 'Logging in...' : 'Create Session via Login'}
          </button>
        </form>
      </details>

      <details className="rounded-md border border-gray-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-800">
          Create new encrypted session
        </summary>
        <form className="mt-3 space-y-3" onSubmit={handleCreateSession}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <input
              value={sessionLabel}
              onChange={(event) => setSessionLabel(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="SCE Operator Session"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expires At</label>
            <input
              type="datetime-local"
              value={sessionExpiresAt}
              onChange={(event) => setSessionExpiresAt(event.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Session State JSON
            </label>
            <textarea
              value={sessionStateJson}
              onChange={(event) => setSessionStateJson(event.target.value)}
              className="min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder='{"cookies":[],"origins":[]}'
            />
          </div>
          <button
            type="submit"
            disabled={creatingSession}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {creatingSession ? 'Creating...' : 'Create Session'}
          </button>
        </form>
      </details>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleRun}
          disabled={startingRun || !selectedSessionId}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {startingRun ? 'Starting...' : 'Run Cloud Extraction'}
        </button>
        {activeRunId && (
          <span className="text-sm text-gray-700">
            Polling run #{activeRunId} every 3s...
          </span>
        )}
      </div>

      {currentRun && (
        <div className="rounded-md border border-gray-200 bg-white p-3 text-sm text-gray-800">
          <p>
            <span className="font-semibold">Run #{currentRun.id}</span> status: {currentRun.status}
          </p>
          <p className="mt-1">
            Processed {currentRun.processedCount}/{currentRun.totalCount} | Success:{' '}
            {currentRun.successCount} | Failed: {currentRun.failureCount}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
    </section>
  );
};
