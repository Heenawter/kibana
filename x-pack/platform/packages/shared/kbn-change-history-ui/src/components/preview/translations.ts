/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { i18n } from '@kbn/i18n';

export const VERSION_BADGE = (version: number): string =>
  i18n.translate('xpack.changeHistoryUi.preview.versionBadge', {
    defaultMessage: 'v{version}',
    values: { version },
  });

export const VERSION_BADGE_FALLBACK = i18n.translate(
  'xpack.changeHistoryUi.preview.versionBadgeFallback',
  { defaultMessage: 'Selected version' }
);

export const COMPARING_WITH_LABEL = i18n.translate(
  'xpack.changeHistoryUi.preview.comparingWithLabel',
  { defaultMessage: 'Comparing with:' }
);

export const PREVIOUS_VERSION_LABEL = i18n.translate(
  'xpack.changeHistoryUi.preview.previousVersionLabel',
  { defaultMessage: 'Previous version:' }
);

export const SELECTED_VERSION_LABEL = i18n.translate(
  'xpack.changeHistoryUi.preview.selectedVersionLabel',
  { defaultMessage: 'Selected version:' }
);
