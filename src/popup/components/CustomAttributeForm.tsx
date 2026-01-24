import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Copy, Check } from 'lucide-react';
import type { CustomAttribute, AttributeSearchDirection } from '@/shared/types';
import { normalizeAttributeName, isValidAttributeName, isValidSearchDirection } from '@/shared/utils';

interface CustomAttributeFormProps {
  attribute: CustomAttribute | null;
  onSave: (
    data: Omit<CustomAttribute, 'id' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onCancel: () => void;
}

const DIRECTION_OPTIONS: { value: AttributeSearchDirection; label: string; description: string }[] = [
  { value: 'parent', label: 'Parent', description: 'Search up the DOM tree' },
  { value: 'descendant', label: 'Descendant', description: 'Search down the DOM tree' },
  { value: 'both', label: 'Both', description: 'Search parents first, then descendants' },
];

export function CustomAttributeForm({
  attribute,
  onSave,
  onCancel,
}: CustomAttributeFormProps): React.ReactElement {
  const [name, setName] = useState(attribute?.name || '');
  const [searchDirection, setSearchDirection] = useState<AttributeSearchDirection>(
    attribute?.searchDirection || 'parent'
  );
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tokenName = normalizeAttributeName(name || 'attribute_name');
  const isNameValid = name.trim() === '' || isValidAttributeName(name.trim());
  const templateSyntax = `{{#${tokenName}_present}}
{{${tokenName}}} - your prompt here
{{/${tokenName}_present}}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Attribute name is required');
      return;
    }
    if (!isValidAttributeName(trimmedName)) {
      setError('Invalid attribute name. Must start with a letter and contain only letters, numbers, hyphens, or underscores.');
      return;
    }
    if (!isValidSearchDirection(searchDirection)) {
      setError('Invalid search direction');
      return;
    }

    setSaving(true);
    try {
      await onSave({ name: trimmedName, searchDirection });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(templateSyntax);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy:', e);
    }
  };

  return (
    <div className="flex flex-col p-3 min-h-[400px]">
      <div className="flex items-center gap-2 mb-4">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={onCancel}
          type="button"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h3 className="text-base font-semibold">
          {attribute ? 'Edit Custom Attribute' : 'Add Custom Attribute'}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col flex-1">
        <label className="text-xs text-muted-foreground mb-1">Attribute Name</label>
        <input
          type="text"
          className={`w-full p-2 border rounded-md text-sm mb-1 bg-background ${!isNameValid ? 'border-destructive' : ''}`}
          placeholder="data-qa"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          spellCheck={false}
          autoFocus
        />
        {!isNameValid && (
          <p className="text-[10px] text-destructive mb-2">
            Must start with a letter and contain only letters, numbers, hyphens, or underscores.
          </p>
        )}
        {isNameValid && <div className="mb-2" />}

        <label className="text-xs text-muted-foreground mb-1">Search Direction</label>
        <select
          className="w-full p-2 border rounded-md text-sm mb-3 bg-background"
          value={searchDirection}
          onChange={(e) => {
            const value = e.target.value;
            if (isValidSearchDirection(value)) {
              setSearchDirection(value);
              setError(null);
            }
          }}
        >
          {DIRECTION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} - {option.description}
            </option>
          ))}
        </select>

        {name && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-muted-foreground">Template Syntax</label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleCopy}
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3 mr-1" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <pre className="text-xs bg-muted p-2 rounded-md overflow-x-auto whitespace-pre-wrap">
              {templateSyntax}
            </pre>
            <p className="text-[10px] text-muted-foreground mt-1">
              Paste this into your prompt template. The section only renders if the attribute is found.
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive mb-2">{error}</p>
        )}

        <div className="flex gap-2 mt-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            className="flex-1"
            disabled={!name.trim() || !isNameValid || saving}
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            {attribute ? 'Save' : 'Add'}
          </Button>
        </div>
      </form>
    </div>
  );
}
