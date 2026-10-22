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
  const [editorContext, setEditorContext] = useState<ChangeHistoryPreviewEditorContext | null>(
    null
  );
  const [diffNavigation, setDiffNavigation] = useState<ChangeHistoryDiffNavigation | null>(null);
  const [compareMode, setCompareMode] = useState<ChangeHistoryCompareMode>('unified');

  const isCompareMode = baselineComparison !== undefined;

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
          diffTelemetry={diffTelemetry}
          onEditorContextChange={setEditorContext}
          onDiffNavigationChange={setDiffNavigation}
        />

        <div css={styles.footer} data-test-subj={`${dataTestSubj}Footer`}>
          {renderFooter && editorContext ? (
            renderFooter(editorContext)
          ) : (
            <ChangeHistoryPreviewFooterSpacer />
          )}
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
