/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */

import { get } from 'lodash';
import { Observable } from 'rxjs';

import { schema } from '@kbn/config-schema';
import { CoreSetup, ElasticsearchClient } from '@kbn/core/server';
import { SearchRequest } from '@kbn/data-plugin/common';
import { getKbnServerError, reportServerError } from '@kbn/kibana-utils-plugin/server';
import { PluginSetup as UnifiedSearchPluginSetup } from '@kbn/unified-search-plugin/server';

import { TimePickerRequestBody, TimePickerResponse } from '../../common/time_picker/types';

export const setupTimePickerRoute = (
  { http }: CoreSetup,
  getAutocompleteSettings: UnifiedSearchPluginSetup['autocomplete']['getAutocompleteSettings']
) => {
  const router = http.createRouter();

  router.versioned
    .post({
      access: 'internal',
      path: '/internal/controls/timePicker/{index}',
    })
    .addVersion(
      {
        version: '1',
        validate: {
          request: {
            params: schema.object(
              {
                index: schema.string(),
              },
              { unknowns: 'allow' }
            ),
            body: schema.object(
              {
                fieldName: schema.string(),
                filters: schema.maybe(schema.any()),
                fieldSpec: schema.maybe(schema.any()),
              },
              { unknowns: 'allow' }
            ),
          },
        },
      },
      async (context, request, response) => {
        try {
          const timePickerRequest: TimePickerRequestBody = request.body;
          const { index } = request.params;
          const esClient = (await context.core).elasticsearch.client.asCurrentUser;

          const suggestionsResponse = await getTimePickerSuggestions({
            abortedEvent$: request.events.aborted$,
            request: timePickerRequest,
            esClient,
            index,
          });
          return response.ok({ body: suggestionsResponse });
        } catch (e) {
          const kbnErr = getKbnServerError(e);
          return reportServerError(response, kbnErr);
        }
      }
    );

  const getTimePickerSuggestions = async ({
    abortedEvent$,
    esClient,
    request,
    index,
  }: {
    request: TimePickerRequestBody;
    abortedEvent$: Observable<void>;
    esClient: ElasticsearchClient;
    index: string;
  }): Promise<TimePickerResponse> => {
    const abortController = new AbortController();
    abortedEvent$.subscribe(() => abortController.abort());

    /**
     * Build ES Query
     */
    const { filters, runtimeFieldMap } = request;
    const { terminateAfter, timeout } = getAutocompleteSettings();
    const timeoutSettings = { timeout: `${timeout}ms`, terminate_after: terminateAfter };

    const aggBody: any = {};

    if (request.fieldSpec) {
      if (request.fieldSpec.scripted) {
        aggBody.script = {
          source: request.fieldSpec.script,
          lang: request.fieldSpec.lang,
        };
      } else {
        aggBody.field = request.fieldSpec.name;
      }
    }

    const minMaxAgg = {
      maxAgg: {
        max: aggBody,
      },
      minAgg: {
        min: aggBody,
      },
    };

    const body: SearchRequest['body'] = {
      size: 0,
      ...timeoutSettings,
      query: {
        bool: {
          filter: filters,
        },
      },
      aggs: {
        ...minMaxAgg,
      },
      runtime_mappings: {
        ...runtimeFieldMap,
      },
    };
    // console.log(JSON.stringify(body));

    /**
     * Run ES query
     */
    const rawEsResult = await esClient.search({ index, body }, { signal: abortController.signal });

    const min = get(rawEsResult, 'aggregations.minAgg.value');
    const max = get(rawEsResult, 'aggregations.maxAgg.value');

    /**
     * Parse ES response into Options List Response
     */
    return {
      min,
      max,
    };
  };
};
