/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0; you may not use this file except in compliance with the Elastic License
 * 2.0.
 */

import { bisector } from 'd3-array';

import type { TimeKey } from '../time';
import { compareToTimeKey } from '../time';

export interface SearchResult {
  gid: string;
  fields: TimeKey;
  matches: SearchResultFieldMatches;
}

export interface SearchResultFieldMatches {
  [field: string]: string[];
}

export const getSearchResultKey = (result: SearchResult) =>
  ({
    gid: result.gid,
    tiebreaker: result.fields.tiebreaker,
    time: result.fields.time,
  } as TimeKey);

const searchResultTimeBisector = bisector(compareToTimeKey(getSearchResultKey));
export const getSearchResultIndexBeforeTime = searchResultTimeBisector.left;
export const getSearchResultIndexAfterTime = searchResultTimeBisector.right;
