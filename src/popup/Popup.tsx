import React, { useCallback, useEffect, useState } from 'react';
import type { Issue, MonitoringSession } from '@/shared/types';
import type { ExportResponse, StateResponse } from '@/shared/messages';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
      await chrome.runtime.sendMessage({ type: 'START_LISTENING' });
      await fetchState();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to start',
      }));
    }
  }, [fetchState]);

  // Toggle pause/resume
  const handleTogglePause = useCallback(async () => {
    try {
      setTogglingPause(true);
      if (isPaused) {
        await chrome.runtime.sendMessage({ type: 'RESUME_LISTENING' });
      } else {
        await chrome.runtime.sendMessage({ type: 'PAUSE_LISTENING' });
      }
      await fetchState();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to toggle pause',
      }));
    } finally {
      setTogglingPause(false);
    }
  }, [isPaused, fetchState]);

  // Show loading spinner on initial load
  if (state.loading && !state.session && state.issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[280px] gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <span className="text-base text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // Form view (full page)
  if (view !== 'main') {
    const isEnhancement = view === 'enhancement';
    return (
      <div className="flex flex-col h-full p-5">
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={() => {
              setView('main');
              setPrompt('');
            }}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold">
            {isEnhancement ? 'Modify' : 'Report Bug'}
          </h2>
        </div>

        {state.error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-base text-destructive mb-4">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <label className="text-base text-muted-foreground mb-3 block">
          {isEnhancement
            ? 'Describe what you want to change'
            : 'Describe what needs fixed'}
        </label>
        <textarea
          className="w-full flex-1 p-4 border rounded-lg text-base resize-none bg-background mb-5 min-h-[120px]"
          placeholder={
            isEnhancement
              ? 'e.g., Add a dark mode toggle to the settings panel'
              : 'e.g., The button does not respond when clicked'
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          autoFocus
        />

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 h-12 text-base"
            onClick={() => {
              setView('main');
              setPrompt('');
            }}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-12 text-base"
            onClick={handleSubmit}
            disabled={state.loading || !prompt.trim()}
          >
            {state.loading && <Loader2 className="h-5 w-5 animate-spin mr-2" />}
            Select Element
          </Button>
        </div>
      </div>
    );
  }

  // Main view
  return (
    <div className="flex flex-col gap-5 p-5">
      {/* Header */}
      <header className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-3">
          <img
            src="/icons/clankercontext logo.jpg"
            alt="ClankerContext"
            className="h-14 w-14 rounded"
          />
          <h1 className="text-xl font-semibold tracking-tight">ClankerContext</h1>
        </div>
        {state.session && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={handleTogglePause}
            disabled={togglingPause}
            title={isPaused ? 'Resume listening' : 'Pause listening'}
          >
            {togglingPause ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : isPaused ? (
              <Play className="h-5 w-5" />
            ) : (
              <Pause className="h-5 w-5" />
            )}
          </Button>
        )}
      </header>

      {/* Error message */}
      {state.error && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-4 py-3 text-base text-destructive">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {/* Start listening prompt - shown when no session */}
      {!state.session && (
        <div className="flex flex-col items-center gap-4 py-8">
          <p className="text-base text-muted-foreground text-center">
            Click "Start listening" to begin debugging the browser.
          </p>
          <Button
            variant="default"
            onClick={handleStartListening}
            className="h-12 px-6 text-base"
            disabled={state.loading}
          >
            {state.loading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <Play className="h-5 w-5 mr-2" />
            )}
            Start listening
          </Button>
        </div>
      )}

      {/* Main action buttons - only shown when session exists */}
      {state.session && (
        <div className="flex flex-col gap-3">
          <Button
            variant="default"
            onClick={() => setView('enhancement')}
            className="w-full justify-start h-12 text-base"
            disabled={state.loading || isPaused}
          >
            <Sparkles className="h-5 w-5 mr-3" />
            Modify with AI
          </Button>
          <Button
            variant="secondary"
            onClick={() => setView('fix')}
            className="w-full justify-start h-12 text-base"
            disabled={state.loading || isPaused}
          >
            <Wrench className="h-5 w-5 mr-3" />
            Fix with AI
          </Button>
        </div>
      )}

      {/* Issue list - only shown when session exists */}
      {state.session && state.issues.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-base font-medium text-muted-foreground">
            Logged Issues ({state.issues.length})
          </h2>
          <div className="flex flex-col gap-2">
            {state.issues.map((issue) => (
              <Card key={issue.id} className="border bg-muted/30">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {issue.type === 'enhancement' ? (
                        <Sparkles className="h-4 w-4 text-primary shrink-0" />
                      ) : (
                        <Wrench className="h-4 w-4 text-orange-500 shrink-0" />
                      )}
                      <span className="text-base font-medium truncate" title={issue.name || 'Unnamed issue'}>
                        {issue.name || 'Unnamed issue'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleExport(issue.id, 'clipboard')}
                        title="Copy to clipboard"
                      >
                        {copySuccess === issue.id ? (
                          <span className="text-sm text-green-500">OK</span>
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => handleExport(issue.id, 'download')}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(issue.id)}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Export all / Clear session buttons - only shown when session exists */}
      {state.session && state.issues.length > 0 && (
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => handleExportAll('download')}
            className="flex-1 h-10"
          >
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
          <Button
            variant="outline"
            onClick={() => handleExportAll('clipboard')}
            className="flex-1 h-10"
          >
            <Copy className="h-4 w-4 mr-2" />
            {copySuccess === 'all' ? 'Copied!' : 'Copy All'}
          </Button>
        </div>
      )}

      {state.session && (
        <Button
          variant="ghost"
          onClick={handleClearSession}
          className="text-muted-foreground"
        >
          Clear Session
        </Button>
      )}
    </div>
  );
}
