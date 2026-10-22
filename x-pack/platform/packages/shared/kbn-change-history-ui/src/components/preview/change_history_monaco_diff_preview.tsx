/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { UseEuiTheme } from '@elastic/eui';
import { EuiFlexGroup, EuiFlexItem, EuiText, useEuiTheme } from '@elastic/eui';
import type { Interpolation, Theme } from '@emotion/react';
import { css } from '@emotion/react';
import type { MutableRefObject, ReactNode } from 'react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { monaco } from '@kbn/code-editor';
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
  CHANGE_HISTORY_PREVIEW_FOOTER_HEIGHT,
  ChangeHistoryPreviewFooterSpacer,
} from './change_history_preview_footer';
import { ChangeHistoryPreviewSettingsPopover } from './change_history_preview_settings_popover';
import { buildChangeHistoryUnifiedDiffLayoutStyles } from './change_history_unified_diff_layout';
import {
  CHANGE_HISTORY_DIFF_GLOBAL_EDITOR_OPTIONS,
  CHANGE_HISTORY_DIFF_MONACO_BASE_OPTIONS,
  CHANGE_HISTORY_PREVIEW_MONACO_OPTIONS,
  CHANGE_HISTORY_SPLIT_DIFF_EDITOR_OPTIONS,
  CHANGE_HISTORY_UNIFIED_DIFF_EDITOR_OPTIONS,
  CHANGE_HISTORY_UNIFIED_DIFF_MODIFIED_EDITOR_OPTIONS,
} from './monaco_options';
import type { ChangeHistoryMonacoTheme } from './monaco_theme';
import { useResolveChangeHistoryMonacoTheme } from './monaco_theme';

const FLOATING_NAVIGATOR_BOTTOM = `calc(${CHANGE_HISTORY_PREVIEW_FOOTER_HEIGHT} - ${CHANGE_HISTORY_PREVIEW_NAVIGATOR_HEIGHT} / 2)`;

const getDiffEditorOptions = (
  compareMode: ChangeHistoryCompareMode,
  theme: string,
  editorOptions: monaco.editor.IEditorOptions | undefined
): monaco.editor.IStandaloneDiffEditorConstructionOptions => ({
  ...CHANGE_HISTORY_DIFF_MONACO_BASE_OPTIONS,
  theme,
  ...(compareMode === 'split'
    ? CHANGE_HISTORY_SPLIT_DIFF_EDITOR_OPTIONS
    : CHANGE_HISTORY_UNIFIED_DIFF_MODIFIED_EDITOR_OPTIONS),
  ...editorOptions,
  renderSideBySide: compareMode === 'split',
  renderIndicators: compareMode === 'split',
});

const configureDiffEditors = (
  diffEditor: monaco.editor.IStandaloneDiffEditor,
  compareMode: ChangeHistoryCompareMode,
  editorOptions: monaco.editor.IEditorOptions | undefined
): void => {
  const sharedChildOptions: monaco.editor.IEditorOptions & monaco.editor.IGlobalEditorOptions = {
    ...CHANGE_HISTORY_DIFF_GLOBAL_EDITOR_OPTIONS,
    glyphMargin: false,
    folding: false,
    ...editorOptions,
  };

  if (compareMode === 'split') {
    const splitOptions: monaco.editor.IEditorOptions = {
      ...sharedChildOptions,
      ...CHANGE_HISTORY_SPLIT_DIFF_EDITOR_OPTIONS,
    };
    diffEditor.getOriginalEditor().updateOptions(splitOptions);
    diffEditor.getModifiedEditor().updateOptions(splitOptions);
    return;
  }

  diffEditor.getOriginalEditor().updateOptions({
    ...sharedChildOptions,
    ...CHANGE_HISTORY_UNIFIED_DIFF_EDITOR_OPTIONS,
  });
  diffEditor.getModifiedEditor().updateOptions({
    ...sharedChildOptions,
    ...CHANGE_HISTORY_UNIFIED_DIFF_MODIFIED_EDITOR_OPTIONS,
  });
};

const getChangeStartLine = (change: monaco.editor.ILineChange): number => {
  if (change.modifiedStartLineNumber > 0) {
    return change.modifiedStartLineNumber;
  }

  return change.originalStartLineNumber;
};

const getChangeEndLine = (change: monaco.editor.ILineChange): number => {
  if (change.modifiedEndLineNumber > 0) {
    return change.modifiedEndLineNumber;
  }

  return change.originalEndLineNumber;
};

const scrollDiffEditorToChange = (
  diffEditor: monaco.editor.IStandaloneDiffEditor,
  changeIndex: number
): boolean => {
  const changes = diffEditor.getLineChanges() ?? [];
  if (changes.length === 0) {
    return false;
  }

  const boundedIndex = Math.max(0, Math.min(changeIndex, changes.length - 1));
  const change = changes[boundedIndex];
  const startLine = getChangeStartLine(change);
  if (startLine <= 0) {
    return false;
  }

  const endLine = Math.max(startLine, getChangeEndLine(change));

  diffEditor.setPosition({ lineNumber: startLine, column: 1 });
  if (endLine > startLine) {
    diffEditor.revealLinesInCenter(startLine, endLine);
  } else {
    diffEditor.revealLineInCenter(startLine);
  }

  return true;
};

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
  editor: (themeContext: UseEuiTheme) =>
    css({
      flex: '1 1 0',
      minHeight: 0,
      overflow: 'hidden',
      position: 'relative',
      zIndex: 0,
      display: 'flex',
      flexDirection: 'column',
      // Monaco scrollbars default to z-index 11; keep them below floating overlays.
      ...buildChangeHistoryUnifiedDiffLayoutStyles(themeContext),
      '& .monaco-editor .scrollbar': {
        zIndex: 1,
      },
    }),
  monacoHost: (themeContext: UseEuiTheme) =>
    css`
      flex: 1 1 auto;
      min-height: 0;
      height: 100%;
      padding: 0 ${themeContext.euiTheme.size.m};
      & > div {
        height: 100%;
      }

      /* Monaco draws its own scrollbars; match EUI's thin, rounded scrollbar. */
      .monaco-scrollable-element > .scrollbar > .slider {
        width: calc(${themeContext.euiTheme.size.s} * 0.75) !important;
        border-radius: ${themeContext.euiTheme.border.radius.medium} !important;
        margin-right: 2px;
      }
    `,
  monacoHostSplit: css({
    padding: 0,
  }),
  monacoHostUnified: ({ euiTheme }: UseEuiTheme) =>
    css({
      paddingLeft: `calc(${euiTheme.size.m} + ${euiTheme.size.s})`,
    }),
  footer: css({
    position: 'relative',
    zIndex: 1,
  }),
  footerContent: ({ euiTheme }: UseEuiTheme) =>
    css({
      width: '100%',
      flexShrink: 0,
      minHeight: CHANGE_HISTORY_PREVIEW_FOOTER_HEIGHT,
      overflow: 'hidden',
      backgroundColor: euiTheme.colors.backgroundBaseSubdued,

      '.euiAccordion': {
        backgroundColor: euiTheme.colors.backgroundBaseSubdued,
        borderTop: euiTheme.border.thin,
      },
    }),
  footerSettingsAnchor: ({ euiTheme }: UseEuiTheme) =>
    css({
      position: 'absolute',
      right: euiTheme.size.m,
      top: 0,
      height: CHANGE_HISTORY_PREVIEW_FOOTER_HEIGHT,
      display: 'flex',
      alignItems: 'center',
      zIndex: 2,
    }),
  floatingToolbar: ({ euiTheme }: UseEuiTheme) =>
    css({
      position: 'absolute',
      left: '50%',
      // Overlap the editor/footer seam; must sit above the footer accordion.
      bottom: FLOATING_NAVIGATOR_BOTTOM,
      transform: 'translateX(-50%)',
      zIndex: euiTheme.levels.modal,
      flex: '0 0 auto',
      width: 'auto',
      height: 'auto',
      pointerEvents: 'none',

      '& > *': {
        pointerEvents: 'auto',
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
  const baselineYaml = useMemo(
    () => (baseline === undefined ? undefined : toText(baseline)),
    [baseline]
  );
  const targetYaml = useMemo(() => toText(target), [target]);
  const containerRef = useRef<HTMLDivElement>(null);
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const pendingDiffScrollIndexRef = useRef<number | null>(null);
  const [diffCurrentIndex, setDiffCurrentIndex] = useState(0);
  const [diffTotalChanges, setDiffTotalChanges] = useState(0);
  const [compareMode, setCompareMode] = useState<ChangeHistoryCompareMode>('unified');
  const compareModeRef = useRef(compareMode);
  compareModeRef.current = compareMode;
  const [isEditorMounted, setIsEditorMounted] = useState(false);
  const editorOptionsRef = useRef(editorOptions);
  editorOptionsRef.current = editorOptions;

  const monacoTheme = useResolveChangeHistoryMonacoTheme(monacoThemeProp);
  const monacoThemeRef = useRef(monacoTheme);
  monacoThemeRef.current = monacoTheme;

  const isCompareMode = baselineYaml !== undefined;
  const useDiffEditor = isCompareMode;

  const getActiveEditor = useCallback(
    () => editorRef.current ?? diffEditorRef.current?.getModifiedEditor() ?? null,
    []
  );

  const configureDiffEditorsRef = useRef(configureDiffEditors);
  configureDiffEditorsRef.current = configureDiffEditors;

  const stableConfigureDiffEditors = useCallback(
    (
      diffEditor: monaco.editor.IStandaloneDiffEditor,
      mode: ChangeHistoryCompareMode,
      extraOptions?: monaco.editor.IEditorOptions
    ) =>
      configureDiffEditorsRef.current(diffEditor, mode, extraOptions ?? editorOptionsRef.current),
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
    if (!diffTelemetry || !useDiffEditor || baselineYaml == null) {
      return;
    }

    if (baselineYaml !== targetYaml) {
      diffTelemetry.reportDiffViewed();
    }
  }, [baselineYaml, diffTelemetry, targetYaml, useDiffEditor]);

  const updateDiffState = useCallback((editor: monaco.editor.IStandaloneDiffEditor) => {
    const changes = editor.getLineChanges() ?? [];
    setDiffTotalChanges(changes.length);
    setDiffCurrentIndex((currentIndex) =>
      changes.length === 0 ? 0 : Math.min(currentIndex, changes.length - 1)
    );
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (useDiffEditor && baselineYaml != null) {
      const mountCompareMode = compareModeRef.current;
      const originalModel = monaco.editor.createModel(baselineYaml, language);
      const modifiedModel = monaco.editor.createModel(targetYaml, language);
      const diffEditor = monaco.editor.createDiffEditor(
        container,
        getDiffEditorOptions(mountCompareMode, monacoThemeRef.current, editorOptionsRef.current)
      );

      diffEditor.setModel({ original: originalModel, modified: modifiedModel });
      configureDiffEditors(diffEditor, mountCompareMode, editorOptionsRef.current);
      diffEditor.layout();
      diffEditorRef.current = diffEditor;
      editorRef.current = null;
      setIsEditorMounted(true);
      pendingDiffScrollIndexRef.current = 0;
      setDiffCurrentIndex(0);

      updateDiffState(diffEditor);
      const diffDisposable = diffEditor.onDidUpdateDiff(() => {
        updateDiffState(diffEditor);

        const pendingIndex = pendingDiffScrollIndexRef.current;
        if (pendingIndex !== null && scrollDiffEditorToChange(diffEditor, pendingIndex)) {
          pendingDiffScrollIndexRef.current = null;
        }
      });

      return () => {
        diffDisposable.dispose();
        diffEditor.dispose();
        originalModel.dispose();
        modifiedModel.dispose();
        diffEditorRef.current = null;
        decorationsRef.current?.clear();
        decorationsRef.current = null;
        setIsEditorMounted(false);
      };
    }

    const model = monaco.editor.createModel(targetYaml, language);
    const editor = monaco.editor.create(container, {
      ...CHANGE_HISTORY_PREVIEW_MONACO_OPTIONS,
      ...editorOptionsRef.current,
      theme: monacoThemeRef.current,
      model,
    });
    editor.layout();

    editorRef.current = editor;
    diffEditorRef.current = null;
    setIsEditorMounted(true);
    setDiffTotalChanges(0);
    setDiffCurrentIndex(0);

    return () => {
      editor.dispose();
      model.dispose();
      editorRef.current = null;
      decorationsRef.current?.clear();
      decorationsRef.current = null;
      setIsEditorMounted(false);
    };
  }, [baselineYaml, language, monacoTheme, targetYaml, updateDiffState, useDiffEditor]);

  useEffect(() => {
    const diffEditor = diffEditorRef.current;
    if (!diffEditor || !useDiffEditor) {
      return;
    }

    diffEditor.updateOptions({
      renderSideBySide: compareMode === 'split',
      renderIndicators: compareMode === 'split',
    });
    configureDiffEditors(diffEditor, compareMode, editorOptionsRef.current);
    diffEditor.layout();
  }, [compareMode, useDiffEditor]);

  // Consumer-supplied options (e.g. validation display) are applied after mount and on change.
  useEffect(() => {
    if (!isEditorMounted || !editorOptions) {
      return;
    }

    editorRef.current?.updateOptions(editorOptions);
    const diffEditor = diffEditorRef.current;
    if (diffEditor) {
      diffEditor.updateOptions(editorOptions);
      configureDiffEditors(diffEditor, compareModeRef.current, editorOptions);
    }
  }, [editorOptions, isEditorMounted]);

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

  console.log({ isCompareMode, compareMode, containerRef });
  return (
    <div
      css={[
        containerStyles?.(euiThemeContext),
        css`
          height: 100%;
          width: 100%;
        `,
      ]}
    >
      <div
        css={[
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
        <EuiText
          component="div"
          css={[
            styles.monacoHost,
            isCompareMode && compareMode === 'split' ? styles.monacoHostSplit : undefined,
            isCompareMode && compareMode === 'unified' ? styles.monacoHostUnified : undefined,
          ]}
        >
          <div ref={containerRef} data-test-subj={`${dataTestSubj}Editor`} />
        </EuiText>
        <div css={styles.footer}>
          <div css={styles.footerContent} data-test-subj={`${dataTestSubj}Footer`}>
            {renderFooter ? renderFooter(editorContext) : <ChangeHistoryPreviewFooterSpacer />}
          </div>
          {hasSettings ? (
            <div css={styles.footerSettingsAnchor}>
              <ChangeHistoryPreviewSettingsPopover
                hasCompare={isCompareMode}
                compareMode={compareMode}
                onCompareModeChange={handleCompareModeChange}
              >
                {extraSettings}
              </ChangeHistoryPreviewSettingsPopover>
            </div>
          ) : null}
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
        </div>
      </div>
    </div>

    // <EuiFlexGroup
    //   direction="column"
    //   gutterSize="none"
    //   responsive={false}
    //   css={[styles.container, { height }, containerStyles?.(euiThemeContext)]}
    //   data-test-subj={dataTestSubj}
    // >
    //   <EuiFlexItem css={styles.editor} grow={true}>
    // {isCompareMode && compareIndicator ? (
    //   compareMode === 'split' ? (
    //     <ChangeHistoryCompareSplitPaneLabels indicator={compareIndicator} />
    //   ) : (
    //     <ChangeHistoryCompareIndicatorBar indicator={compareIndicator} />
    //   )
    // ) : null}
    // <EuiText
    //   component="div"
    //   css={[
    //     styles.monacoHost,
    //     isCompareMode && compareMode === 'split' ? styles.monacoHostSplit : undefined,
    //     isCompareMode && compareMode === 'unified' ? styles.monacoHostUnified : undefined,
    //   ]}
    // >
    //   <div ref={containerRef} data-test-subj={`${dataTestSubj}Editor`} />
    // </EuiText>
    //   </EuiFlexItem>
    // <EuiFlexItem css={styles.footer} grow={false}>
    //   <div css={styles.footerContent} data-test-subj={`${dataTestSubj}Footer`}>
    //     {renderFooter ? renderFooter(editorContext) : <ChangeHistoryPreviewFooterSpacer />}
    //   </div>
    //   {hasSettings ? (
    //     <div css={styles.footerSettingsAnchor}>
    //       <ChangeHistoryPreviewSettingsPopover
    //         hasCompare={isCompareMode}
    //         compareMode={compareMode}
    //         onCompareModeChange={handleCompareModeChange}
    //       >
    //         {extraSettings}
    //       </ChangeHistoryPreviewSettingsPopover>
    //     </div>
    //   ) : null}
    // </EuiFlexItem>
    //   {showDiffNavigator ? (
    //     <EuiFlexItem css={styles.floatingToolbar} grow={false}>
    // <ChangeHistoryDiffNavigator
    //   currentIndex={diffCurrentIndex}
    //   totalChanges={diffTotalChanges}
    //   onPrevious={handleDiffPrevious}
    //   onNext={handleDiffNext}
    // />
    //     </EuiFlexItem>
    //   ) : null}
    // </EuiFlexGroup>
  );
};
