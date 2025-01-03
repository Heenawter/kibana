/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import type { MetricsExplorerSeries } from '../../../../../common/http_api';
import type { STATE_NAMES } from './states';

export interface Process {
  command: string;
  cpu: number | null;
  memory: number | null;
  startTime: number;
  state: keyof typeof STATE_NAMES;
  pid: number;
  user: string;
  timeseries: {
    [x: string]: MetricsExplorerSeries;
  };
  apmTrace?: string; // Placeholder
}
