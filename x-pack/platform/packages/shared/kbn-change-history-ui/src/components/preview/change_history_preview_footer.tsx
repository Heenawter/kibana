/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { UseEuiTheme } from '@elastic/eui';
import { css } from '@emotion/react';
import React from 'react';
import { useMemoCss } from '@kbn/css-utils/public/use_memo_css';

/** Collapsed footer row height. */
export const CHANGE_HISTORY_PREVIEW_FOOTER_HEIGHT = '48px';

/** Empty footer bar. Render it from `renderFooter` when there is nothing to show in the footer. */
export const ChangeHistoryPreviewFooterSpacer = (): JSX.Element => {
  const styles = useMemoCss(componentStyles);

  return <div css={styles.spacer} aria-hidden={true} />;
};

const componentStyles = {
  spacer: ({ euiTheme }: UseEuiTheme) =>
    css({
      minHeight: CHANGE_HISTORY_PREVIEW_FOOTER_HEIGHT,
      borderTop: euiTheme.border.thin,
      backgroundColor: euiTheme.colors.backgroundBaseSubdued,
    }),
};
