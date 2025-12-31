import React, { useCallback, useEffect, useState } from 'react';
import type { Issue, MonitoringSession } from '@/shared/types';
import type { ExportResponse, StateResponse } from '@/shared/messages';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  Wrench,
  Download,
  Copy,
  Trash2,
  Loader2,
  AlertCircle,
  ArrowLeft,
  Play,
  Pause,
  X,
} from 'lucide-react';

interface PopupState {
  loading: boolean;
  error: string | null;
  session: MonitoringSession | null;
  issues: Issue[];
  errorCount: { network: number; console: number };
}

type ViewState = 'main' | 'enhancement' | 'fix';

export function Popup(): React.ReactElement {
  const [state, setState] = useState<PopupState>({
    loading: true,
    error: null,
    session: null,
    issues: [],
    errorCount: { network: 0, console: 0 },
  });

  const [view, setView] = useState<ViewState>('main');
  const [prompt, setPrompt] = useState('');
  const [copySuccess, setCopySuccess] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const [iconToggle, setIconToggle] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Cycle icon when active (not paused)
  useEffect(() => {
    if (!state.session || isPaused) {
      return;
    }

    const interval = setInterval(() => {
      setIconToggle((prev) => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, [state.session, isPaused]);

  // Fetch state from background
  const fetchState = useCallback(async () => {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'GET_STATE',
      })) as StateResponse;

      setState((prev) => ({
        ...prev,
        loading: false,
        error: null,
        session: response.session,
        issues: response.issues,
        errorCount: response.errorCount,
      }));
      setIsPaused(response.isPaused);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';
      if (
        errorMessage.includes('Receiving end does not exist') ||
        errorMessage.includes('Could not establish connection')
      ) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: null,
          session: null,
          issues: [],
          errorCount: { network: 0, console: 0 },
        }));
        return;
      }
      setState((prev) => ({
        ...prev,
        loading: false,
        error: errorMessage || 'Unknown error',
      }));
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 2000);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Handle prompt submission
  const handleSubmit = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const response = await chrome.runtime.sendMessage({
        type: 'START_ISSUE',
        issueType: view === 'enhancement' ? 'enhancement' : 'fix',
        userPrompt: prompt,
      });

      if (response?.error) {
        throw new Error(response.error);
      }

      // Small delay to ensure element picker is shown before popup closes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Close popup so user can select element
      window.close();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to start',
      }));
    }
  }, [prompt, view]);

  // Export issue
  const handleExport = useCallback(
    async (issueId: string, format: 'download' | 'clipboard') => {
      try {
        const response = (await chrome.runtime.sendMessage({
          type: 'EXPORT_ISSUE',
          issueId,
          format,
        })) as ExportResponse;

        if (format === 'clipboard' && response.markdown) {
          await navigator.clipboard.writeText(response.markdown);
          setCopySuccess(issueId);
          setTimeout(() => setCopySuccess(null), 2000);
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Export failed',
        }));
      }
    },
    []
  );

  // Export all issues
  const handleExportAll = useCallback(async (format: 'download' | 'clipboard') => {
    try {
      const response = (await chrome.runtime.sendMessage({
        type: 'EXPORT_ALL',
        format,
      })) as ExportResponse;

      if (format === 'clipboard' && response.markdown) {
        await navigator.clipboard.writeText(response.markdown);
        setCopySuccess('all');
        setTimeout(() => setCopySuccess(null), 2000);
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Export failed',
      }));
    }
  }, []);

  // Delete issue
  const handleDelete = useCallback(
    async (issueId: string) => {
      await chrome.runtime.sendMessage({ type: 'DELETE_ISSUE', issueId });
      await fetchState();
    },
    [fetchState]
  );

  // Clear session
  const handleClearSession = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: 'CLEAR_SESSION' });
    setIsPaused(false);
    await fetchState();
  }, [fetchState]);

  // Start listening (create session)
  const handleStartListening = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      const response = await chrome.runtime.sendMessage({ type: 'START_LISTENING' });
      if (response?.error) {
        throw new Error(response.error);
      }
      await fetchState();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: null,
      }));
      setToast('Cannot listen to this page');
    }
  }, [fetchState]);

  // Toggle pause/resume
  const handleTogglePause = useCallback(async () => {
    try {
      setTogglingPause(true);
      if (isPaused) {
        const response = await chrome.runtime.sendMessage({ type: 'RESUME_LISTENING' });
        if (response?.error) {
          throw new Error(response.error);
        }
      } else {
        await chrome.runtime.sendMessage({ type: 'PAUSE_LISTENING' });
      }
      await fetchState();
    } catch (error) {
      // Show toast for resume errors (likely restricted page)
      if (isPaused) {
        setToast('Cannot listen to this page');
      } else {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Failed to toggle pause',
        }));
      }
    } finally {
      setTogglingPause(false);
    }
  }, [isPaused, fetchState]);

  // Show loading spinner on initial load
  if (state.loading && !state.session && state.issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // Form view (compact)
  if (view !== 'main') {
    const isEnhancement = view === 'enhancement';
    return (
      <div className="flex flex-col h-full p-4">
        <div className="flex items-center gap-2 mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => {
              setView('main');
              setPrompt('');
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-semibold">
            {isEnhancement ? 'Modify' : 'Report Bug'}
          </h2>
        </div>

        {state.error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive mb-3">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <textarea
          className="w-full flex-1 p-3 border rounded-lg text-sm resize-none bg-background mb-3 min-h-[100px]"
          placeholder={
            isEnhancement
              ? 'Describe what you want to change...'
              : 'Describe what needs fixed...'
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          autoFocus
        />

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-9"
            onClick={() => {
              setView('main');
              setPrompt('');
            }}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            className="flex-1 h-9"
            onClick={handleSubmit}
            disabled={state.loading || !prompt.trim()}
          >
            {state.loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Select Element
          </Button>
        </div>
      </div>
    );
  }

  // Main view (compact)
  return (
    <div className="flex flex-col p-3">
      {/* Compact Header */}
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <img
            src={
              !state.session || isPaused
                ? '/icons/asleep-128.png'
                : iconToggle
                  ? '/icons/litlogo-128.png'
                  : '/icons/icon-128.png'
            }
            alt="ClankerContext"
            className="h-8 w-8 rounded"
          />
          <span className="text-base font-semibold">ClankerContext</span>
        </div>
        <div className="flex items-center gap-1">
          {state.session && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleTogglePause}
                disabled={togglingPause}
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {togglingPause ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPaused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={handleClearSession}
                title="End session"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Error message */}
      {state.error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive mb-3">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {/* Start listening - shown when no session */}
      {!state.session && (
        <div className="flex flex-col items-center gap-3 py-6">
          <p className="text-sm text-muted-foreground text-center">
            Start listening to capture errors and log issues.
          </p>
          <Button
            variant="default"
            size="sm"
            onClick={handleStartListening}
            className="h-9 px-4"
            disabled={state.loading}
          >
            {state.loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Start listening
          </Button>
        </div>
      )}

      {/* Action buttons - side by side */}
      {state.session && (
        <div className="flex gap-2 mb-3">
          <Button
            variant="default"
            size="sm"
            onClick={() => setView('enhancement')}
            className="flex-1 h-9"
            disabled={state.loading || isPaused}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Modify
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setView('fix')}
            className="flex-1 h-9"
            disabled={state.loading || isPaused}
          >
            <Wrench className="h-4 w-4 mr-2" />
            Fix
          </Button>
        </div>
      )}

      {/* Compact issue list */}
      {state.session && state.issues.length > 0 && (
        <div className="flex flex-col gap-1 mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Issues ({state.issues.length})
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => handleExportAll('clipboard')}
                title="Copy all"
              >
                {copySuccess === 'all' ? (
                  <span className="text-xs text-green-500">OK</span>
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => handleExportAll('download')}
                title="Download all"
              >
                <Download className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <div className="flex flex-col border rounded-md divide-y">
            {state.issues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between gap-2 px-2 py-1.5 hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {issue.type === 'enhancement' ? (
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                  ) : (
                    <Wrench className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                  )}
                  <span
                    className="text-sm truncate"
                    title={issue.name || 'Unnamed issue'}
                  >
                    {issue.name || 'Unnamed issue'}
                  </span>
                </div>
                <div className="flex items-center shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleExport(issue.id, 'clipboard')}
                    title="Copy"
                  >
                    {copySuccess === issue.id ? (
                      <span className="text-xs text-green-500">OK</span>
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleExport(issue.id, 'download')}
                    title="Download"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(issue.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed bottom-3 left-3 right-3 flex items-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm text-destructive-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
