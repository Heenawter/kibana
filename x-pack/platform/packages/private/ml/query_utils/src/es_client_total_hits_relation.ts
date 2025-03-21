/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { estypes } from '@elastic/elasticsearch';

/**
 * Custom enum for total hits relation values
 */
export const ES_CLIENT_TOTAL_HITS_RELATION: Record<
  Uppercase<estypes.SearchTotalHitsRelation>,
  estypes.SearchTotalHitsRelation
> = {
  EQ: 'eq',
  GTE: 'gte',
} as const;
