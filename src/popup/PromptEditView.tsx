import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Loader2, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { IssueType, PromptTemplate } from '@/shared/types';
import { storageManager } from '@/background/StorageManager';
import { DEFAULT_PROMPT_TEMPLATES, PROMPT_TEMPLATE_LABELS } from '@/prompts/templates';

interface PromptEditViewProps {
  type: IssueType;
  onBack: () => void;
}

export function PromptEditView({ type, onBack }: PromptEditViewProps): React.ReactElement {
  const [content, setContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCustom, setIsCustom] = useState(false);

  const loadTemplate = useCallback(async () => {
    try {
      setLoading(true);
      const stored = await storageManager.getPromptTemplate(type);
      const templateContent = stored?.content ?? DEFAULT_PROMPT_TEMPLATES[type];
      setContent(templateContent);
      setOriginalContent(templateContent);
      setIsCustom(Boolean(stored));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prompt template');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  useEffect(() => {
    document.body.classList.add('prompt-edit');
    return () => {
      document.body.classList.remove('prompt-edit');
    };
  }, []);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      const record: PromptTemplate = {
        type,
        content,
        updatedAt: Date.now(),
      };
      await storageManager.upsertPromptTemplate(record);
      setOriginalContent(content);
      setIsCustom(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save prompt template');
    } finally {
      setSaving(false);
    }
  }, [content, type]);

  const handleReset = useCallback(async () => {
    try {
      await storageManager.deletePromptTemplate(type);
      const defaultContent = DEFAULT_PROMPT_TEMPLATES[type];
      setContent(defaultContent);
      setOriginalContent(defaultContent);
      setIsCustom(false);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reset prompt template');
    }
  }, [type]);

  const isDirty = content !== originalContent;

  return (
    <div className="flex h-full w-full min-h-[600px] flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex flex-col">
            <span className="text-sm font-semibold">
              Edit {PROMPT_TEMPLATE_LABELS[type]} prompt
            </span>
            <span className="text-[11px] text-muted-foreground">
              {isCustom ? 'Custom' : 'Default'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={loading || saving || !isCustom}
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={loading || saving || !isDirty}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      {error ? (
        <div className="border-b bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <textarea
          className="flex-1 w-full resize-none bg-background px-3 py-3 font-mono text-xs leading-relaxed outline-none"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          spellCheck={false}
          autoFocus
        />
      )}
    </div>
  );
}
