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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { monaco } from '@kbn/code-editor';
import { useMemoCss } from '@kbn/css-utils/public/use_memo_css';
import type { ChangeHistoryCompareMode } from '../../telemetry';
import type { ChangeHistoryDiffTelemetry } from '../../types';
import type { ChangeHistoryPreviewModeOption } from './change_history_compare_mode_setting';
import { useChangeHistoryDiffModeOptions } from './change_history_compare_mode_setting';
import type { ChangeHistoryCompareIndicator } from './change_history_compare_indicator';
import {
  ChangeHistoryCompareIndicatorBar,
  ChangeHistoryCompareSplitPaneLabels,
} from './change_history_compare_indicator';
import {
  CHANGE_HISTORY_PREVIEW_NAVIGATOR_HEIGHT,
  ChangeHistoryDiffNavigator,
} from './change_history_diff_navigator';
import type { ChangeHistoryDiffNavigation } from './change_history_monaco_diff';
import { ChangeHistoryMonacoDiff } from './change_history_monaco_diff';
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

/** A user-provided mode rendered in place of the Monaco editors. */
export interface ChangeHistoryPreviewCustomMode
  extends Pick<ChangeHistoryPreviewModeOption, 'id' | 'label' | 'icon' | 'data-test-subj'> {
  /** Must not be `unified` or `split`, which are reserved for the built-in diff modes. */
  render: () => ReactNode;
}

export interface ChangeHistoryPreviewProps {
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
   * Extra modes offered in the settings popover after the built-in unified / split diff modes.
   * Without a `baseline` the diff modes are not offered when custom modes exist (there is nothing
   * to compare), so a custom mode can be the only one.
   */
  customModes?: readonly ChangeHistoryPreviewCustomMode[];
  /** Id of the mode selected initially. Defaults to the first mode offered. */
  defaultModeId?: string;
  /**
   * Footer content. Always mounted, so it can run effects against the editors. Render
   * `ChangeHistoryPreviewFooterSpacer` when there is nothing to show. Defaults to the spacer.
   * The context is `null` until a Monaco editor has mounted (e.g. when starting in a custom mode).
   */
  renderFooter?: (context: ChangeHistoryPreviewEditorContext | null) => ReactNode;
  /**
   * Additional settings rendered in the settings popover below the mode setting.
   * Compose `ChangeHistoryPreviewSettingsSection`s. Without it, the popover only appears when
   * more than one mode is supported.
   */
  extraSettings?: ReactNode;
  /** Extra Emotion styles for the preview root, e.g. to style validation decoration classes. */
  containerStyles?: (theme: UseEuiTheme) => Interpolation<Theme>;

  'data-test-subj'?: string;
}

const EMPTY_CUSTOM_MODES: readonly ChangeHistoryPreviewCustomMode[] = [];

const toText = (value: string | object): string =>
  typeof value === 'string' ? value : JSON.stringify(value, null, 2);

const monacoDiffPreviewStyles = {
  footer: ({ euiTheme }: UseEuiTheme) =>
    css({
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: CHANGE_HISTORY_PREVIEW_FOOTER_HEIGHT,
      borderTop: euiTheme.border.thin,
      padding: `0 ${euiTheme.size.m}`,
    }),
  previewContent: css({
    minHeight: 0,
    overflow: 'auto',
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

export const ChangeHistoryPreview = ({
  baseline,
  target,
  language = 'json',
  diffTelemetry,
  compareIndicator,
  monacoTheme: monacoThemeProp,
  editorOptions,
  renderFooter,
  customModes = EMPTY_CUSTOM_MODES,
  defaultModeId,
  extraSettings,
  containerStyles,
  'data-test-subj': dataTestSubj = 'changeHistoryMonacoPreview',
}: ChangeHistoryPreviewProps): JSX.Element => {
  const styles = useMemoCss(monacoDiffPreviewStyles);
  const euiThemeContext = useEuiTheme();
  const baselineComparison = useMemo(
    () => (baseline === undefined ? undefined : toText(baseline)),
    [baseline]
  );
  const targetComparison = useMemo(() => toText(target), [target]);
  const [editorContext, setEditorContext] = useState<ChangeHistoryPreviewEditorContext | null>(
    null
  );
  const [diffNavigation, setDiffNavigation] = useState<ChangeHistoryDiffNavigation | null>(null);
  const diffModeOptions = useChangeHistoryDiffModeOptions();
  const modes = useMemo<ChangeHistoryPreviewModeOption[]>(() => {
    const hasBaseline = baselineComparison !== undefined;
    // A lone read-only editor is only offered when no custom mode can stand in for it.
    const diffModes = hasBaseline
      ? diffModeOptions
      : customModes.length === 0
      ? diffModeOptions.slice(0, 1)
      : [];
    return [...diffModes, ...customModes];
  }, [baselineComparison, customModes, diffModeOptions]);

  const [selectedModeId, setSelectedModeId] = useState<string | undefined>(defaultModeId);
  const viewModeId = modes.some(({ id }) => id === selectedModeId) ? selectedModeId : modes[0]?.id;
  const customMode = customModes.find(({ id }) => id === viewModeId);

  const compareMode: ChangeHistoryCompareMode = viewModeId === 'split' ? 'split' : 'unified';
  const isCompareMode = baselineComparison !== undefined && !customMode;
  // The editors are unmounted in a custom mode (their refs are cleared), but the footer stays
  // mounted so its effects and state survive mode switches.
  const footerContext = useMemo(
    () =>
      editorContext && customMode ? { ...editorContext, isEditorMounted: false } : editorContext,
    [editorContext, customMode]
  );

  const handleModeChange = useCallback(
    (modeId: string) => {
      setSelectedModeId(modeId);
      if (modeId === 'unified' || modeId === 'split') {
        diffTelemetry?.setCompareMode(modeId);
      }
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

  const hasSettings = modes.length > 1 || Boolean(extraSettings);

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
        ) : (
          // Keeps the header grid row occupied so the content and footer stay in their rows.
          <div />
        )}

        {customMode ? (
          <div css={styles.previewContent}>{customMode.render()}</div>
        ) : (
          <ChangeHistoryMonacoDiff
            baseline={baselineComparison}
            target={targetComparison}
            language={language}
            monacoTheme={monacoThemeProp}
            editorOptions={editorOptions}
            data-test-subj={dataTestSubj}
            compareMode={compareMode}
            diffTelemetry={diffTelemetry}
            onEditorContextChange={setEditorContext}
            onDiffNavigationChange={setDiffNavigation}
          />
        )}

        <div css={styles.footer} data-test-subj={`${dataTestSubj}Footer`}>
          {renderFooter ? renderFooter(footerContext) : <ChangeHistoryPreviewFooterSpacer />}
          {hasSettings ? (
            <ChangeHistoryPreviewSettingsPopover
              modes={modes}
              selectedModeId={viewModeId ?? ''}
              onModeChange={handleModeChange}
            >
              {extraSettings}
            </ChangeHistoryPreviewSettingsPopover>
          ) : null}
        </div>
      </div>
      {isCompareMode && diffNavigation && (
        <div css={styles.floatingToolbar}>
          <ChangeHistoryDiffNavigator
            currentIndex={diffNavigation.currentIndex}
            totalChanges={diffNavigation.totalChanges}
            onPrevious={diffNavigation.onPrevious}
            onNext={diffNavigation.onNext}
          />
        </div>
      )}
    </>
  );
};
