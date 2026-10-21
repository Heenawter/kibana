/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { monaco } from '@kbn/code-editor';
import { TestProvider } from '../../test_utils/test_providers';
import type { ChangeHistoryPreviewValidationContext } from './change_history_monaco_diff_preview';
import { ChangeHistoryMonacoDiffPreview } from './change_history_monaco_diff_preview';

interface MockValidationResult {
  id: string;
  message: string;
}

let mockValidationResults: MockValidationResult[] = [];
const mockHandleValidationErrorClick = jest.fn();

const renderValidation = ({ highlightValidationErrors }: ChangeHistoryPreviewValidationContext) =>
  highlightValidationErrors ? (
    <div data-test-subj="validationSlot">
      {mockValidationResults.length === 0
        ? 'No validation errors'
        : mockValidationResults.map((error) => (
            <button
              key={error.id}
              type="button"
              data-test-subj={`validationError-${error.id}`}
              onClick={() => mockHandleValidationErrorClick(error)}
            >
              {error.message}
            </button>
          ))}
    </div>
  ) : null;

const mockYamlModel = {
  getLineLength: jest.fn(() => 10),
  getLineCount: jest.fn(() => 1),
  getValue: jest.fn(() => 'name: current\n'),
  uri: { toString: () => 'inmemory://model/current.yaml' },
};

const mockRevealLineInCenter = jest.fn();
const mockRevealLinesInCenter = jest.fn();
const mockSetPosition = jest.fn();
const mockDiffUpdateOptions = jest.fn();
const mockOriginalUpdateOptions = jest.fn();
const mockModifiedUpdateOptions = jest.fn();
const onDidUpdateDiffCallbacks: Array<() => void> = [];
let mockLineChanges: Array<{
  originalStartLineNumber: number;
  originalEndLineNumber: number;
  modifiedStartLineNumber: number;
  modifiedEndLineNumber: number;
}> = [
  {
    originalStartLineNumber: 10,
    originalEndLineNumber: 10,
    modifiedStartLineNumber: 12,
    modifiedEndLineNumber: 12,
  },
];

jest.mock('@kbn/code-editor', () => {
  const actual = jest.requireActual('@kbn/code-editor');

  return {
    ...actual,
    monaco: {
      ...actual.monaco,
      editor: {
        ...actual.monaco.editor,
        defineTheme: jest.fn(),
        createModel: jest.fn((value: string, language: string) => ({
          value,
          language,
          dispose: jest.fn(),
        })),
        create: jest.fn(() => ({
          dispose: jest.fn(),
          layout: jest.fn(),
          getModel: jest.fn(() => mockYamlModel),
          updateOptions: jest.fn(),
          createDecorationsCollection: jest.fn(() => ({ clear: jest.fn() })),
        })),
        createDiffEditor: jest.fn(() => ({
          setModel: jest.fn(),
          dispose: jest.fn(),
          layout: jest.fn(),
          updateOptions: mockDiffUpdateOptions,
          getLineChanges: jest.fn(() => mockLineChanges),
          onDidUpdateDiff: jest.fn((listener: () => void) => {
            onDidUpdateDiffCallbacks.push(listener);
            return { dispose: jest.fn() };
          }),
          setPosition: mockSetPosition,
          revealLineInCenter: mockRevealLineInCenter,
          revealLinesInCenter: mockRevealLinesInCenter,
          getOriginalEditor: jest.fn(() => ({ updateOptions: mockOriginalUpdateOptions })),
          getModifiedEditor: jest.fn(() => ({
            updateOptions: mockModifiedUpdateOptions,
            revealLineInCenter: jest.fn(),
            getModel: jest.fn(() => mockYamlModel),
            createDecorationsCollection: jest.fn(() => ({ clear: jest.fn() })),
          })),
        })),
        setModelMarkers: jest.fn(),
        onDidChangeMarkers: jest.fn(() => ({ dispose: jest.fn() })),
      },
    },
  };
});

const mockCreateEditor = monaco.editor.create as jest.Mock;
const mockCreateDiffEditor = monaco.editor.createDiffEditor as jest.Mock;

const sampleValidationError: MockValidationResult = {
  id: 'preview-validation-error',
  message: 'Invalid document',
};

const renderPreview = (props: React.ComponentProps<typeof ChangeHistoryMonacoDiffPreview>) =>
  render(
    <TestProvider>
      <ChangeHistoryMonacoDiffPreview language="yaml" {...props} />
    </TestProvider>
  );

describe('ChangeHistoryMonacoDiffPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidationResults = [];
    onDidUpdateDiffCallbacks.length = 0;
    mockLineChanges = [
      {
        originalStartLineNumber: 10,
        originalEndLineNumber: 10,
        modifiedStartLineNumber: 12,
        modifiedEndLineNumber: 12,
      },
    ];
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  it('renders a read-only editor when no compare yaml is provided', () => {
    jest.useFakeTimers();
    renderPreview({ target: 'name: current\n' });

    expect(screen.getByTestId('changeHistoryMonacoPreview')).toBeInTheDocument();
    expect(mockCreateEditor).toHaveBeenCalled();
    expect(mockCreateDiffEditor).not.toHaveBeenCalled();
    expect(screen.queryByText('No validation errors')).not.toBeInTheDocument();
    expect(screen.getByTestId('changeHistoryPreviewSettingsButton')).toBeInTheDocument();
  });

  it('renders a diff editor when compare yaml is identical', () => {
    jest.useFakeTimers();
    mockLineChanges = [];
    renderPreview({
      target: 'name: same\n',
      baseline: 'name: same\n',
    });

    expect(mockCreateDiffEditor).toHaveBeenCalled();
    expect(mockCreateEditor).not.toHaveBeenCalled();
    expect(screen.getByTestId('changeHistoryDiffNavigator')).toHaveTextContent('No changes');
  });

  it('shows the comparing-with indicator when identical versions are compared', () => {
    jest.useFakeTimers();
    mockLineChanges = [];
    renderPreview({
      target: 'name: same\n',
      baseline: 'name: same\n',
      compareIndicator: {
        baselineVersion: 69,
        currentVersion: 71,
      },
    });

    expect(screen.getByTestId('changeHistoryCompareIndicator')).toBeInTheDocument();
    expect(screen.getByText('Comparing with:')).toBeInTheDocument();
    expect(screen.getByTestId('changeHistoryCompareIndicatorBadge')).toHaveTextContent('v69');
    expect(mockCreateDiffEditor).toHaveBeenCalled();
    expect(screen.getByTestId('changeHistoryDiffNavigator')).toHaveTextContent('No changes');

    fireEvent.click(screen.getByTestId('changeHistoryPreviewSettingsButton'));
    expect(screen.getByTestId('changeHistoryCompareUnified')).toBeInTheDocument();
    expect(screen.getByTestId('changeHistoryCompareSplit')).toBeInTheDocument();
  });

  it('renders a diff editor when compare yaml is empty and current yaml is not', () => {
    jest.useFakeTimers();
    renderPreview({
      target: 'name: v2\n',
      baseline: '',
    });

    expect(mockCreateDiffEditor).toHaveBeenCalled();
    expect(mockCreateEditor).not.toHaveBeenCalled();
    expect(monaco.editor.createModel).toHaveBeenCalledWith('', 'yaml');

    fireEvent.click(screen.getByTestId('changeHistoryPreviewSettingsButton'));

    expect(screen.getByTestId('changeHistoryCompareUnified')).toBeInTheDocument();
    expect(screen.getByTestId('changeHistoryCompareSplit')).toBeInTheDocument();
  });

  it('calls reportDiffViewed when compare yaml differs', () => {
    jest.useFakeTimers();
    const reportDiffViewed = jest.fn();

    renderPreview({
      target: 'name: current\n',
      baseline: 'name: original\n',
      diffTelemetry: {
        compareMode: 'unified',
        setCompareMode: jest.fn(),
        reportDiffViewed,
        reportDiffChangeNavigated: jest.fn(),
      },
    });

    expect(reportDiffViewed).toHaveBeenCalledTimes(1);
  });

  it('does not call reportDiffViewed when compare yaml is identical', () => {
    jest.useFakeTimers();
    const reportDiffViewed = jest.fn();
    mockLineChanges = [];

    renderPreview({
      target: 'name: same\n',
      baseline: 'name: same\n',
      diffTelemetry: {
        compareMode: 'unified',
        setCompareMode: jest.fn(),
        reportDiffViewed,
        reportDiffChangeNavigated: jest.fn(),
      },
    });

    expect(reportDiffViewed).not.toHaveBeenCalled();
  });

  it('renders a diff editor when compare yaml differs', () => {
    jest.useFakeTimers();
    renderPreview({
      target: 'name: current\n',
      baseline: 'name: original\n',
    });

    expect(mockCreateDiffEditor).toHaveBeenCalled();
    expect(mockCreateDiffEditor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lineNumbers: 'on', renderSideBySide: false })
    );
    expect(mockOriginalUpdateOptions).toHaveBeenCalledWith(
      expect.objectContaining({ lineNumbers: 'off' })
    );
    expect(mockModifiedUpdateOptions).toHaveBeenCalledWith(
      expect.objectContaining({ lineNumbers: 'on' })
    );
    expect(mockCreateEditor).not.toHaveBeenCalled();
    expect(screen.getByTestId('changeHistoryDiffNavigator')).toHaveTextContent('1 of 1 changes');
    expect(screen.getByTestId('changeHistoryPreviewSettingsButton')).toBeInTheDocument();
  });

  it('shows the comparing-with indicator when compare labels are provided', () => {
    jest.useFakeTimers();
    renderPreview({
      target: 'name: current\n',
      baseline: 'name: original\n',
      compareIndicator: {
        baselineVersion: 5,
        currentVersion: 8,
      },
    });

    expect(screen.getByTestId('changeHistoryCompareIndicator')).toBeInTheDocument();
    expect(screen.getByText('Comparing with:')).toBeInTheDocument();
    expect(screen.getByTestId('changeHistoryCompareIndicatorBadge')).toHaveTextContent('v5');
  });

  it('shows split pane labels when compare mode is split', () => {
    jest.useFakeTimers();
    renderPreview({
      target: 'name: current\n',
      baseline: 'name: original\n',
      compareIndicator: {
        baselineVersion: 5,
        currentVersion: 8,
      },
    });

    fireEvent.click(screen.getByTestId('changeHistoryPreviewSettingsButton'));
    fireEvent.click(screen.getByTestId('changeHistoryCompareSplit'));

    expect(screen.getByTestId('changeHistoryCompareSplitPaneLabels')).toBeInTheDocument();
    expect(screen.getByText('Previous version:')).toBeInTheDocument();
    expect(screen.getByText('Selected version:')).toBeInTheDocument();
    expect(screen.getByTestId('changeHistoryCompareSplitBaselineBadge')).toHaveTextContent('v5');
    expect(screen.getByTestId('changeHistoryCompareSplitCurrentBadge')).toHaveTextContent('v8');
    expect(screen.queryByTestId('changeHistoryCompareIndicator')).not.toBeInTheDocument();
  });

  it('shows the unsaved changes badge for the selected pane when there is no version', () => {
    jest.useFakeTimers();
    renderPreview({
      target: 'name: draft\n',
      baseline: 'name: original\n',
      compareIndicator: {
        baselineVersion: 2,
        currentBadgeLabel: 'Unsaved changes',
        currentBadgeColor: 'warning',
      },
    });

    fireEvent.click(screen.getByTestId('changeHistoryPreviewSettingsButton'));
    fireEvent.click(screen.getByTestId('changeHistoryCompareSplit'));

    expect(screen.getByTestId('changeHistoryCompareSplitCurrentBadge')).toHaveTextContent(
      'Unsaved changes'
    );
    expect(screen.getByText('Selected version:')).toBeInTheDocument();
  });

  it('scrolls to the first diff when diff computation completes', () => {
    jest.useFakeTimers();
    renderPreview({
      target: 'name: current\nsteps:\n  - name: updated\n',
      baseline: 'name: original\nsteps:\n  - name: old\n',
    });

    expect(onDidUpdateDiffCallbacks).toHaveLength(1);
    act(() => {
      onDidUpdateDiffCallbacks[0]();
    });

    expect(mockSetPosition).toHaveBeenCalledWith({ lineNumber: 12, column: 1 });
    expect(mockRevealLineInCenter).toHaveBeenCalledWith(12);
  });

  it('updates diff layout via updateOptions when compare mode changes', () => {
    jest.useFakeTimers();
    renderPreview({
      target: 'name: current\n',
      baseline: 'name: original\n',
    });

    expect(mockCreateDiffEditor).toHaveBeenCalled();

    const createCallsBeforeToggle = mockCreateDiffEditor.mock.calls.length;

    fireEvent.click(screen.getByTestId('changeHistoryPreviewSettingsButton'));
    fireEvent.click(screen.getByTestId('changeHistoryCompareSplit'));

    expect(mockDiffUpdateOptions).toHaveBeenCalledWith(
      expect.objectContaining({ renderSideBySide: true, renderIndicators: true })
    );
    expect(mockCreateDiffEditor.mock.calls.length).toBe(createCallsBeforeToggle);
  });

  it('keeps settings popover open when toggling highlight validation', () => {
    renderPreview({
      target: 'name: current\n',
      baseline: 'name: original\n',
      renderValidation,
    });

    fireEvent.click(screen.getByTestId('changeHistoryPreviewSettingsButton'));
    expect(screen.getByTestId('changeHistoryCompareUnified')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('changeHistoryHighlightValidationErrors'));

    expect(screen.getByTestId('changeHistoryCompareUnified')).toBeInTheDocument();
    expect(screen.getByTestId('changeHistoryHighlightValidationErrors')).toBeInTheDocument();
  });

  it('keeps settings popover open when switching compare mode', () => {
    renderPreview({
      target: 'name: current\n',
      baseline: 'name: original\n',
    });

    fireEvent.click(screen.getByTestId('changeHistoryPreviewSettingsButton'));
    fireEvent.click(screen.getByTestId('changeHistoryCompareSplit'));

    expect(screen.getByTestId('changeHistoryCompareUnified')).toBeInTheDocument();
    expect(screen.getByTestId('changeHistoryCompareSplit')).toBeInTheDocument();
  });

  it('shows the validation slot when highlight validation is enabled', () => {
    renderPreview({ target: 'name: current\n', renderValidation });

    fireEvent.click(screen.getByTestId('changeHistoryPreviewSettingsButton'));
    fireEvent.click(screen.getByTestId('changeHistoryHighlightValidationErrors'));

    expect(screen.getByTestId('validationSlot')).toBeInTheDocument();
    expect(screen.getByText('No validation errors')).toBeInTheDocument();
  });

  it('does not show compare mode settings when yaml has no diff baseline', () => {
    jest.useFakeTimers();
    renderPreview({ target: 'name: current\n' });

    fireEvent.click(screen.getByTestId('changeHistoryPreviewSettingsButton'));

    expect(screen.queryByTestId('changeHistoryCompareUnified')).not.toBeInTheDocument();
    expect(screen.queryByTestId('changeHistoryCompareSplit')).not.toBeInTheDocument();
  });

  it('shows the validation accordion when highlight validation is enabled', async () => {
    jest.useFakeTimers();
    renderPreview({ target: 'name: current\n', renderValidation });

    fireEvent.click(screen.getByTestId('changeHistoryPreviewSettingsButton'));
    fireEvent.click(screen.getByTestId('changeHistoryHighlightValidationErrors'));

    await act(async () => {
      jest.advanceTimersByTime(150);
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText('No validation errors')).toBeInTheDocument();
    });
  });

  it('renders the validation slot and lets it use the editor context', async () => {
    mockValidationResults = [sampleValidationError];

    renderPreview({ target: 'name: current\nsteps:\n  - bad\n', renderValidation });

    fireEvent.click(screen.getByTestId('changeHistoryPreviewSettingsButton'));
    fireEvent.click(screen.getByTestId('changeHistoryHighlightValidationErrors'));

    await waitFor(() => {
      expect(screen.getByTestId(`validationError-${sampleValidationError.id}`)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId(`validationError-${sampleValidationError.id}`));

    expect(mockHandleValidationErrorClick).toHaveBeenCalledWith(sampleValidationError);
  });

  it('moves compare mode selection and focus with arrow keys', () => {
    jest.useFakeTimers();
    renderPreview({
      target: 'name: current\n',
      baseline: 'name: original\n',
    });

    fireEvent.click(screen.getByTestId('changeHistoryPreviewSettingsButton'));

    const unifiedTile = screen.getByTestId('changeHistoryCompareUnified');
    const splitTile = screen.getByTestId('changeHistoryCompareSplit');

    unifiedTile.focus();
    expect(unifiedTile).toHaveFocus();

    fireEvent.keyDown(unifiedTile, { key: 'ArrowRight' });

    expect(splitTile).toHaveFocus();
    expect(mockDiffUpdateOptions).toHaveBeenCalledWith(
      expect.objectContaining({ renderSideBySide: true, renderIndicators: true })
    );
  });

  it('hides the validation setting when no validation slot is provided', () => {
    jest.useFakeTimers();
    renderPreview({ target: 'name: current\n' });

    fireEvent.click(screen.getByTestId('changeHistoryPreviewSettingsButton'));

    expect(screen.queryByTestId('changeHistoryHighlightValidationErrors')).not.toBeInTheDocument();
  });

  it('serializes objects as pretty JSON and defaults the language to json', () => {
    jest.useFakeTimers();
    render(
      <TestProvider>
        <ChangeHistoryMonacoDiffPreview baseline={{ a: 1 }} target={{ a: 2 }} />
      </TestProvider>
    );

    expect(monaco.editor.createModel).toHaveBeenCalledWith('{\n  "a": 1\n}', 'json');
    expect(monaco.editor.createModel).toHaveBeenCalledWith('{\n  "a": 2\n}', 'json');
  });

  it('uses a provided Monaco theme instead of defining its own', () => {
    jest.useFakeTimers();
    renderPreview({ target: 'name: current\n', monacoTheme: 'my-theme' });

    expect(monaco.editor.defineTheme).not.toHaveBeenCalled();
    expect(mockCreateEditor).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ theme: 'my-theme' })
    );
  });
});
