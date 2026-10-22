/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { UseEuiTheme } from '@elastic/eui';
import { useEuiTheme } from '@elastic/eui';
import type { Interpolation, Theme } from '@emotion/react';
import { css } from '@emotion/react';
import type { MutableRefObject, ReactNode } from 'react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { monaco } from '@kbn/code-editor';
import { useMemoCss } from '@kbn/css-utils/public/use_memo_css';
import type { ChangeHistoryCompareMode } from '../../telemetry';
import type { ChangeHistoryDiffTelemetry } from '../../types';
import type { ChangeHistoryCompareIndicator } from './change_history_compare_indicator';
import {
  ChangeHistoryCompareIndicatorBar,
  ChangeHistoryCompareSplitPaneLabels,
} from './change_history_compare_indicator';
import {
  CHANGE_HISTORY_PREVIEW_NAVIGATOR_HEIGHT,
  ChangeHistoryDiffNavigator,
} from './change_history_diff_navigator';
import {
  configureDiffEditors,
  ChangeHistoryMonacoDiff,
  scrollDiffEditorToChange,
} from './change_history_monaco_diff';
import {
  CHANGE_HISTORY_PREVIEW_FOOTER_HEIGHT,
  ChangeHistoryPreviewFooterSpacer,
} from './change_history_preview_footer';
import { ChangeHistoryPreviewSettingsPopover } from './change_history_preview_settings_popover';
import type { ChangeHistoryMonacoTheme } from './monaco_theme';

const FLOATING_NAVIGATOR_BOTTOM = `calc(${CHANGE_HISTORY_PREVIEW_FOOTER_HEIGHT} - ${CHANGE_HISTORY_PREVIEW_NAVIGATOR_HEIGHT} / 2)`;

export type ChangeHistoryMonacoLanguage = 'json' | 'yaml' | 'plaintext';

/** Editor handles and helpers a consumer needs to extend the preview (e.g. validation in the footer). */
export interface ChangeHistoryPreviewEditorContext {
  isEditorMounted: boolean;
  getActiveEditor: () => monaco.editor.IStandaloneCodeEditor | null;
  editorRef: MutableRefObject<monaco.editor.IStandaloneCodeEditor | null>;
  diffEditorRef: MutableRefObject<monaco.editor.IStandaloneDiffEditor | null>;
  decorationsRef: MutableRefObject<monaco.editor.IEditorDecorationsCollection | null>;
  compareModeRef: MutableRefObject<ChangeHistoryCompareMode>;
  /**
   * Re-applies the unified/split child-editor options, merged with `editorOptions` (stable
   * identity). Pass `extraOptions` to apply options that are not yet part of the prop.
   */
  configureDiffEditors: (
    diffEditor: monaco.editor.IStandaloneDiffEditor,
    compareMode: ChangeHistoryCompareMode,
    extraOptions?: monaco.editor.IEditorOptions
  ) => void;
}

export interface ChangeHistoryMonacoDiffPreviewProps {
  /** Older content (Monaco "original"). Strings are used as-is; other values are serialized as pretty JSON. */
  baseline?: string | object;
  /** Newer content (Monaco "modified"), or the sole read-only editor when `baseline` is omitted. */
  target: string | object;
  /** Monaco language id. Defaults to `json`. */
  language?: ChangeHistoryMonacoLanguage;
  diffTelemetry?: ChangeHistoryDiffTelemetry;
  /** Version labels shown above the diff panes. */
  compareIndicator?: ChangeHistoryCompareIndicator;
  /**
   * Monaco theme: the id of a registered theme, or a definition the component registers (see
   * `createChangeHistoryEuiMonacoTheme` to extend the default). Defaults to the EUI theme.
   */
  monacoTheme?: ChangeHistoryMonacoTheme;
  /**
   * Extra Monaco options applied to the editors (and both diff panes), e.g. to show validation
   * squiggles. Keep the identity stable (memoize) to avoid reapplying on every render.
   */
  editorOptions?: monaco.editor.IEditorOptions;
  /**
   * Footer content. Always mounted, so it can run effects against the editors. Render
   * `ChangeHistoryPreviewFooterSpacer` when there is nothing to show. Defaults to the spacer.
   */
  renderFooter?: (context: ChangeHistoryPreviewEditorContext) => ReactNode;
  /**
   * Additional settings rendered in the settings popover below the compare mode setting.
   * Compose `ChangeHistoryPreviewSettingsSection`s. Without it, the popover only appears in diff mode.
   */
  extraSettings?: ReactNode;
  /** Extra Emotion styles for the preview root, e.g. to style validation decoration classes. */
  containerStyles?: (theme: UseEuiTheme) => Interpolation<Theme>;

  'data-test-subj'?: string;
}

const toText = (value: string | object): string =>
  typeof value === 'string' ? value : JSON.stringify(value, null, 2);

const monacoDiffPreviewStyles = {
  footer: ({ euiTheme }: UseEuiTheme) =>
    css({
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      flexShrink: 0,
      height: CHANGE_HISTORY_PREVIEW_FOOTER_HEIGHT,
      borderTop: euiTheme.border.thin,
    }),
  floatingToolbar: ({ euiTheme }: UseEuiTheme) =>
    css({
      position: 'relative',
      width: '100%',
      height: '0px',

      '.diffNavigatorToolbar': {
        position: 'absolute',
        left: '50%',
        bottom: FLOATING_NAVIGATOR_BOTTOM,
        transform: 'translateX(-50%)',
        zIndex: euiTheme.levels.modal,
      },
    }),
};

export const ChangeHistoryMonacoDiffPreview = ({
  baseline,
  target,
  language = 'json',
  diffTelemetry,
  compareIndicator,
  monacoTheme: monacoThemeProp,
  editorOptions,
  renderFooter,
  extraSettings,
  containerStyles,
  'data-test-subj': dataTestSubj = 'changeHistoryMonacoPreview',
}: ChangeHistoryMonacoDiffPreviewProps): JSX.Element => {
  const styles = useMemoCss(monacoDiffPreviewStyles);
  const euiThemeContext = useEuiTheme();
  const baselineComparison = useMemo(
    () => (baseline === undefined ? undefined : toText(baseline)),
    [baseline]
  );
  const targetComparison = useMemo(() => toText(target), [target]);
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const [isEditorMounted, setIsEditorMounted] = useState(false);
  const pendingDiffScrollIndexRef = useRef<number | null>(null);
  const [diffCurrentIndex, setDiffCurrentIndex] = useState(0);
  const [diffTotalChanges, setDiffTotalChanges] = useState(0);
  const [compareMode, setCompareMode] = useState<ChangeHistoryCompareMode>('unified');
  const compareModeRef = useRef(compareMode);
  compareModeRef.current = compareMode;

  const editorOptionsRef = useRef(editorOptions);
  editorOptionsRef.current = editorOptions;

  const isCompareMode = baselineComparison !== undefined;

  const getActiveEditor = useCallback(
    () => editorRef.current ?? diffEditorRef.current?.getModifiedEditor() ?? null,
    []
  );

  const stableConfigureDiffEditors = useCallback(
    (
      diffEditor: monaco.editor.IStandaloneDiffEditor,
      mode: ChangeHistoryCompareMode,
      extraOptions?: monaco.editor.IEditorOptions
    ) => configureDiffEditors(diffEditor, mode, extraOptions ?? editorOptionsRef.current),
    []
  );

  const editorContext: ChangeHistoryPreviewEditorContext = {
    isEditorMounted,
    getActiveEditor,
    editorRef,
    diffEditorRef,
    decorationsRef,
    compareModeRef,
    configureDiffEditors: stableConfigureDiffEditors,
  };

  const handleCompareModeChange = useCallback(
    (mode: ChangeHistoryCompareMode) => {
      setCompareMode(mode);
      diffTelemetry?.setCompareMode(mode);
    },
    [diffTelemetry]
  );

  useEffect(() => {
    if (!diffTelemetry || baselineComparison === undefined) {
      return;
    }

    if (baselineComparison !== targetComparison) {
      diffTelemetry.reportDiffViewed();
    }
  }, [baselineComparison, diffTelemetry, targetComparison]);

  const handleDiffPrevious = useCallback(() => {
    const diffEditor = diffEditorRef.current;
    if (!diffEditor) {
      return;
    }

    const changes = diffEditor.getLineChanges() ?? [];
    if (changes.length === 0) {
      return;
    }

    diffTelemetry?.reportDiffChangeNavigated('line_hunk');

    setDiffCurrentIndex((currentIndex) => {
      const nextIndex = Math.max(currentIndex - 1, 0);
      pendingDiffScrollIndexRef.current = null;
      scrollDiffEditorToChange(diffEditor, nextIndex);
      return nextIndex;
    });
  }, [diffTelemetry]);

  const handleDiffNext = useCallback(() => {
    const diffEditor = diffEditorRef.current;
    if (!diffEditor) {
      return;
    }

    const changes = diffEditor.getLineChanges() ?? [];
    if (changes.length === 0) {
      return;
    }

    diffTelemetry?.reportDiffChangeNavigated('line_hunk');

    setDiffCurrentIndex((currentIndex) => {
      const nextIndex = Math.min(currentIndex + 1, Math.max(changes.length - 1, 0));
      pendingDiffScrollIndexRef.current = null;
      scrollDiffEditorToChange(diffEditor, nextIndex);
      return nextIndex;
    });
  }, [diffTelemetry]);

  const showDiffNavigator = isCompareMode;
  const hasSettings = isCompareMode || Boolean(extraSettings);

  return (
    <>
      <div
        css={[
          containerStyles?.(euiThemeContext),
          css`
            display: grid;
            grid-template-rows: auto 1fr auto; /* Header, Content (fills space), Footer */
            height: 100%;
            width: 100%;
          `,
        ]}
      >
        {isCompareMode && compareIndicator ? (
          compareMode === 'split' ? (
            <ChangeHistoryCompareSplitPaneLabels indicator={compareIndicator} />
          ) : (
            <ChangeHistoryCompareIndicatorBar indicator={compareIndicator} />
          )
        ) : null}

        <ChangeHistoryMonacoDiff
          baseline={baselineComparison}
          target={targetComparison}
          language={language}
          monacoTheme={monacoThemeProp}
          editorOptions={editorOptions}
          data-test-subj={dataTestSubj}
          compareMode={compareMode}
          editorRef={editorRef}
          diffEditorRef={diffEditorRef}
          decorationsRef={decorationsRef}
          pendingDiffScrollIndexRef={pendingDiffScrollIndexRef}
          onEditorMountedChange={setIsEditorMounted}
          setDiffCurrentIndex={setDiffCurrentIndex}
          setDiffTotalChanges={setDiffTotalChanges}
        />

        <div css={styles.footer} data-test-subj={`${dataTestSubj}Footer`}>
          {renderFooter ? renderFooter(editorContext) : <ChangeHistoryPreviewFooterSpacer />}
          {hasSettings ? (
            <ChangeHistoryPreviewSettingsPopover
              hasCompare={isCompareMode}
              compareMode={compareMode}
              onCompareModeChange={handleCompareModeChange}
            >
              {extraSettings}
            </ChangeHistoryPreviewSettingsPopover>
          ) : null}
        </div>
      </div>
      {showDiffNavigator && (
        <div css={styles.floatingToolbar}>
          <ChangeHistoryDiffNavigator
            currentIndex={diffCurrentIndex}
            totalChanges={diffTotalChanges}
            onPrevious={handleDiffPrevious}
            onNext={handleDiffNext}
          />
        </div>
      )}
    </>
  );
};
