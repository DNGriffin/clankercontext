import React, { useCallback, useEffect, useState } from 'react';
import type { Issue, IssueType, MonitoringSession } from '@/shared/types';
import type { ConnectionsResponse, ExportResponse, SendToOpenCodeResponse, SendToVSCodeResponse, StateResponse } from '@/shared/messages';
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
  Settings,
  Send,
  Check,
  CheckCheck,
  MousePointer2,
} from 'lucide-react';
import { SettingsView } from './SettingsView';
import { PromptEditView } from './PromptEditView';

interface PopupState {
  loading: boolean;
  error: string | null;
  session: MonitoringSession | null;
  issues: Issue[];
  autoSendingIssueId?: string;
  autoSendingConnectionType?: 'opencode' | 'vscode';
  autoSendError?: boolean;
}

type ViewState = 'main' | 'enhancement' | 'fix' | 'settings' | 'prompt-edit';

export function Popup(): React.ReactElement {
  const [state, setState] = useState<PopupState>({
    loading: true,
    error: null,
    session: null,
    issues: [],
  });

  const [view, setView] = useState<ViewState>('main');
  const [prompt, setPrompt] = useState('');
  const [editingPromptType, setEditingPromptType] = useState<IssueType>('fix');
  const [actionSuccess, setActionSuccess] = useState<{ id: string; type: 'copy' | 'download' | 'send' | 'sent' } | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [togglingPause, setTogglingPause] = useState(false);
  const [iconToggle, setIconToggle] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  // Send state
  const [sendingIssue, setSendingIssue] = useState<string | null>(null);
  const [prevAutoSendingIssueId, setPrevAutoSendingIssueId] = useState<string | undefined>(undefined);
  const [prevAutoSendingConnectionType, setPrevAutoSendingConnectionType] = useState<'opencode' | 'vscode' | undefined>(undefined);

  // Detect when auto-send completes and show success indicator
  useEffect(() => {
    if (prevAutoSendingIssueId && !state.autoSendingIssueId && !state.autoSendError) {
      // Auto-send just completed successfully - show success indicator
      // Use 'sent' for VSCode (double check), 'send' for OpenCode (single check)
      const successType = prevAutoSendingConnectionType === 'vscode' ? 'sent' : 'send';
      setActionSuccess({ id: prevAutoSendingIssueId, type: successType });
      setTimeout(() => setActionSuccess(null), 2000);
    }
    setPrevAutoSendingIssueId(state.autoSendingIssueId);
    setPrevAutoSendingConnectionType(state.autoSendingConnectionType);
  }, [state.autoSendingIssueId, state.autoSendingConnectionType, state.autoSendError, prevAutoSendingIssueId, prevAutoSendingConnectionType]);

  // Show toast when auto-send fails
  useEffect(() => {
    if (state.autoSendError) {
      setToast({ message: 'Failed, check your active connection in settings', type: 'error' });
      // Clear the error flag
      chrome.storage.session.remove('autoSendError');
    }
  }, [state.autoSendError]);

  // Auto-dismiss toast (1.5s for success, 3s for errors)
  useEffect(() => {
    if (toast) {
      const duration = toast.type === 'success' ? 1500 : 3000;
      const timer = setTimeout(() => setToast(null), duration);
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
        autoSendingIssueId: response.autoSendingIssueId,
        autoSendingConnectionType: response.autoSendingConnectionType,
        autoSendError: response.autoSendError,
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

  // Handle auto-copy on issue log (copies to clipboard without marking as exported)
  useEffect(() => {
    const handleAutoCopy = async () => {
      try {
        const { autoCopyIssueId } = await chrome.storage.session.get('autoCopyIssueId');
        if (!autoCopyIssueId) return;

        // Clear the flag immediately to prevent duplicate copies
        await chrome.storage.session.remove('autoCopyIssueId');

        // Export and copy to clipboard
        const response = (await chrome.runtime.sendMessage({
          type: 'EXPORT_ISSUE',
          issueId: autoCopyIssueId,
          format: 'clipboard',
        })) as ExportResponse;

        if (response.markdown) {
          await navigator.clipboard.writeText(response.markdown);
          // Show success indicator (but do NOT mark as exported)
          setActionSuccess({ id: autoCopyIssueId, type: 'copy' });
          setTimeout(() => setActionSuccess(null), 2000);
        }
      } catch (e) {
        console.error('[Popup] Auto-copy failed:', e);
      }
    };

    // Run once on mount
    handleAutoCopy();
  }, []);

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
        }

        // Show success indicator
        setActionSuccess({ id: issueId, type: format === 'clipboard' ? 'copy' : 'download' });
        setTimeout(() => setActionSuccess(null), 2000);

        // Mark as exported
        await chrome.runtime.sendMessage({
          type: 'MARK_ISSUE_EXPORTED',
          issueId,
        });
        await fetchState();
      } catch (error) {
        setState((prev) => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Export failed',
        }));
      }
    },
    [fetchState]
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
      }

      // Show success indicator
      setActionSuccess({ id: 'all', type: format === 'clipboard' ? 'copy' : 'download' });
      setTimeout(() => setActionSuccess(null), 2000);
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

  // Send issue to the active connection (OpenCode or VSCode)
  const handleSendClick = useCallback(async (issueId: string) => {
    try {
      // Fetch all connections first to determine type
      const response = (await chrome.runtime.sendMessage({
        type: 'GET_CONNECTIONS',
      })) as ConnectionsResponse;

      // Find the active connection
      const activeConnection = response.connections.find((c) => c.isActive && c.enabled);

      if (!activeConnection) {
        setToast({ message: 'No active connection. Select one in Settings.', type: 'error' });
        return;
      }

      // Set sending state - only show spinner for OpenCode
      if (activeConnection.type === 'opencode') {
        setSendingIssue(issueId);
      }

      // Check if connection is ready (has session/instance selected)
      const isReady =
        (activeConnection.type === 'opencode' && activeConnection.selectedSessionId) ||
        (activeConnection.type === 'vscode' && activeConnection.selectedInstanceId);

      if (!isReady) {
        setToast({ message: 'Select a session/instance for your active connection', type: 'error' });
        setSendingIssue(null);
        return;
      }

      let sendResponse: SendToOpenCodeResponse | SendToVSCodeResponse;

      if (activeConnection.type === 'opencode') {
        sendResponse = (await chrome.runtime.sendMessage({
          type: 'SEND_TO_OPENCODE',
          connectionId: activeConnection.id,
          sessionId: activeConnection.selectedSessionId,
          issueId,
        })) as SendToOpenCodeResponse;
      } else {
        sendResponse = (await chrome.runtime.sendMessage({
          type: 'SEND_TO_VSCODE',
          connectionId: activeConnection.id,
          instanceId: activeConnection.selectedInstanceId,
          issueId,
        })) as SendToVSCodeResponse;
      }

      if (sendResponse.success) {
        // Show success indicator - 'sent' for VSCode (double check), 'send' for OpenCode (single check)
        const successType = activeConnection.type === 'vscode' ? 'sent' : 'send';
        setActionSuccess({ id: issueId, type: successType });
        setTimeout(() => setActionSuccess(null), 2000);
        // Mark as exported
        await chrome.runtime.sendMessage({
          type: 'MARK_ISSUE_EXPORTED',
          issueId,
        });
        await fetchState();
      } else {
        setToast({ message: 'Failed, check your connection in Settings', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Failed, check your connection in Settings', type: 'error' });
    } finally {
      setSendingIssue(null);
    }
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
      const message = error instanceof Error ? error.message : 'Cannot listen to this page';
      setState((prev) => ({
        ...prev,
        loading: false,
        error: null,
      }));
      // Show friendly message for known restrictions, otherwise show actual error
      setToast({
        message: message.includes('Cannot attach') || message.includes('restricted')
          ? 'Cannot listen to this page'
          : message,
        type: 'error',
      });
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
        setToast({ message: 'Cannot listen to this page', type: 'error' });
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

  // Quick Select - select elements and copy to clipboard without creating an issue
  const handleQuickSelect = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'QUICK_SELECT' });
      if (response?.error) {
        throw new Error(response.error);
      }
      // Close popup so user can select elements
      window.close();
    } catch (error) {
      setToast({ message: error instanceof Error ? error.message : 'Failed to start quick select', type: 'error' });
    }
  }, []);

  // Show loading spinner on initial load
  if (state.loading && !state.session && state.issues.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[200px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  // Settings view
  if (view === 'settings') {
    return (
      <SettingsView
        key="settings"
        onBack={() => setView('main')}
        onEditPrompt={(type) => {
          setEditingPromptType(type);
          setView('prompt-edit');
        }}
      />
    );
  }

  if (view === 'prompt-edit') {
    return (
      <PromptEditView
        key={`prompt-${editingPromptType}`}
        type={editingPromptType}
        onBack={() => setView('settings')}
      />
    );
  }

  // Form view (compact)
  if (view !== 'main') {
    const isEnhancement = view === 'enhancement';
    return (
      <div key={`form-${view}`} className="flex flex-col h-full p-4">
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
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !state.loading && prompt.trim()) {
              e.preventDefault();
              handleSubmit();
            }
          }}
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
    <div key="main" className="flex flex-col p-3">
      {/* Compact Header */}
      <header className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <a
            href="https://clankercontext.com"
            target="_blank"
            rel="noopener noreferrer"
            title="Visit clankercontext.com"
          >
            <img
              src={
                !state.session || isPaused
                  ? '/icons/asleep-128.png'
                  : iconToggle
                    ? '/icons/litlogo-128.png'
                    : '/icons/icon-128.png'
              }
              alt="ClankerContext"
              className="h-10 w-10 rounded cursor-pointer"
            />
          </a>
          <span className="text-base font-semibold">ClankerContext</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setView('settings')}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={state.session ? handleTogglePause : handleStartListening}
            disabled={togglingPause || (!state.session && state.loading)}
            title={!state.session ? 'Start listening' : isPaused ? 'Resume' : 'Pause'}
          >
            {togglingPause || (!state.session && state.loading) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : !state.session || isPaused ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
          </Button>
          {state.session && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
              onClick={handleClearSession}
              title="End session"
            >
              <X className="h-4 w-4" />
            </Button>
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

      {/* Action buttons - side by side */}
      <div className="flex gap-2 mb-3">
          <Button
            variant="default"
            size="sm"
            onClick={() => setView('enhancement')}
            className="flex-1 h-9"
            disabled={state.loading || isPaused || !state.session}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Modify
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setView('fix')}
            className="flex-1 h-9"
            disabled={state.loading || isPaused || !state.session}
          >
            <Wrench className="h-4 w-4 mr-2" />
            Fix
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleQuickSelect}
            className="h-9 w-9 p-0"
            disabled={state.loading}
            title="Quick select element(s) to clipboard"
          >
            {actionSuccess?.id === 'quickSelect' ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <MousePointer2 className="h-4 w-4" />
            )}
          </Button>
      </div>

      {/* Compact issue list - show even without active session to preserve issues after reload */}
      {state.issues.length > 0 && (
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
                {actionSuccess?.id === 'all' && actionSuccess.type === 'copy' ? (
                  <Check className="h-3 w-3 text-green-500" />
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
                {actionSuccess?.id === 'all' && actionSuccess.type === 'download' ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Download className="h-3 w-3" />
                )}
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
                    className={`text-sm truncate ${issue.exportedAt ? 'line-through text-muted-foreground' : ''}`}
                    title={issue.userPrompt || issue.name || 'Unnamed issue'}
                  >
                    {issue.name || 'Unnamed issue'}
                  </span>
                </div>
                <div className="flex items-center shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleSendClick(issue.id)}
                    title="Send"
                    disabled={sendingIssue === issue.id || state.autoSendingIssueId === issue.id}
                  >
                    {actionSuccess?.id === issue.id && actionSuccess.type === 'sent' ? (
                      <CheckCheck className="h-3 w-3 text-green-500" />
                    ) : actionSuccess?.id === issue.id && actionSuccess.type === 'send' ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : sendingIssue === issue.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : state.autoSendingIssueId === issue.id && state.autoSendingConnectionType === 'vscode' ? (
                      <Send className="h-3 w-3 text-blue-500" />
                    ) : state.autoSendingIssueId === issue.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => handleExport(issue.id, 'clipboard')}
                    title="Copy"
                  >
                    {actionSuccess?.id === issue.id && actionSuccess.type === 'copy' ? (
                      <Check className="h-3 w-3 text-green-500" />
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
                    {actionSuccess?.id === issue.id && actionSuccess.type === 'download' ? (
                      <Check className="h-3 w-3 text-green-500" />
                    ) : (
                      <Download className="h-3 w-3" />
                    )}
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
        <div
          className={`fixed bottom-3 left-3 right-3 flex items-center gap-2 rounded-md px-3 py-2 text-sm shadow-lg animate-in fade-in slide-in-from-bottom-2 ${
            toast.type === 'error'
              ? 'bg-destructive text-destructive-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <Check className="h-4 w-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
