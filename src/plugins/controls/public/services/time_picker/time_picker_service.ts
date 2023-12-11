/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { memoize } from 'lodash';

import dateMath from '@kbn/datemath';
import { CoreStart } from '@kbn/core/public';
import { getEsQueryConfig } from '@kbn/data-plugin/common';
import { buildEsQuery, type TimeRange } from '@kbn/es-query';
import { KibanaPluginServiceFactory } from '@kbn/presentation-util-plugin/public';

import {
  TimePickerRequest,
  TimePickerResponse,
  TimePickerRequestBody,
  TimePickerFailureResponse,
} from '../../../common/time_picker/types';
import { ControlsHTTPService } from '../http/types';
import { ControlsDataService } from '../data/types';
import { ControlsPluginStartDeps } from '../../types';
import { ControlsTimePickerService } from './types';

class TimePickerService implements ControlsTimePickerService {
  private core: CoreStart;
  private data: ControlsDataService;
  private http: ControlsHTTPService;

  constructor(core: CoreStart, requiredServices: TimePickerServiceRequiredServices) {
    this.core = core;
    ({ data: this.data, http: this.http } = requiredServices);
  }

  private getRoundedTimeRange = (timeRange: TimeRange) => ({
    from: dateMath.parse(timeRange.from)!.startOf('minute').toISOString(),
    to: dateMath.parse(timeRange.to)!.endOf('minute').toISOString(),
  });

  private timePickerCacheResolver = (request: TimePickerRequest) => {
    const {
      query,
      filters,
      timeRange,
      runPastTimeout,
      field: { name: fieldName },
      dataView: { title: dataViewTitle },
    } = request;
    return [
      ...(timeRange ? JSON.stringify(this.getRoundedTimeRange(timeRange)) : []), // round timeRange to the minute to avoid cache misses
      Math.floor(Date.now() / 1000 / 60), // Only cache results for a minute in case data changes in ES index
      JSON.stringify(filters),
      JSON.stringify(query),
      runPastTimeout,
      dataViewTitle,
      fieldName,
    ].join('|');
  };

  private cachedTimePickerRequest = memoize(
    async (request: TimePickerRequest, abortSignal: AbortSignal) => {
      const index = request.dataView.title;
      const requestBody = this.getRequestBody(request);
      return await this.http.fetch<TimePickerResponse>(`/internal/controls/timePicker/${index}`, {
        version: '1',
        body: JSON.stringify(requestBody),
        signal: abortSignal,
        method: 'POST',
      });
    },
    this.timePickerCacheResolver
  );

  private getRequestBody = (request: TimePickerRequest): TimePickerRequestBody => {
    const timeService = this.data.query.timefilter.timefilter;
    const { query, filters, dataView, timeRange, field, ...passThroughProps } = request;
    const timeFilter = timeRange ? timeService.createFilter(dataView, timeRange) : undefined;
    const filtersToUse = [...(filters ?? []), ...(timeFilter ? [timeFilter] : [])];
    const config = getEsQueryConfig(this.core.uiSettings);
    const esFilters = [buildEsQuery(dataView, query ?? [], filtersToUse ?? [], config)];

    return {
      ...passThroughProps,
      filters: esFilters,
      fieldName: field.name,
      fieldSpec: field,
      runtimeFieldMap: dataView.toSpec().runtimeFieldMap,
    };
  };

  public timePickerResponseWasFailure = (
    response: TimePickerResponse
  ): response is TimePickerFailureResponse => {
    return (response as TimePickerFailureResponse).error !== undefined;
  };

  public runTimePickerRequest = async (request: TimePickerRequest, abortSignal: AbortSignal) => {
    try {
      return await this.cachedTimePickerRequest(request, abortSignal);
    } catch (error: any) {
      // Remove rejected results from memoize cache
      this.cachedTimePickerRequest.cache.delete(this.timePickerCacheResolver(request));
      return { error } as TimePickerFailureResponse;
    }
  };

  public clearTimePickerCache = () => {
    this.cachedTimePickerRequest.cache = new memoize.Cache();
  };
}

export interface TimePickerServiceRequiredServices {
  data: ControlsDataService;
  http: ControlsHTTPService;
}

export type TimePickerServiceFactory = KibanaPluginServiceFactory<
  ControlsTimePickerService,
  ControlsPluginStartDeps,
  TimePickerServiceRequiredServices
>;

export const timePickerServiceFactory: TimePickerServiceFactory = (
  startParams,
  requiredServices
) => {
  return new TimePickerService(startParams.coreStart, requiredServices);
};
