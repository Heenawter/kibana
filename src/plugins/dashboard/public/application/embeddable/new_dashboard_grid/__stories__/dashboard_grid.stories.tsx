/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License
 * 2.0 and the Server Side Public License, v 1; you may not use this file except
 * in compliance with, at your election, the Elastic License 2.0 or the Server
 * Side Public License, v 1.
 */
import React, { useState } from 'react';
import { EuiPanel } from '@elastic/eui';
import 'gridstack/dist/h5/gridstack-dd-native';
import { Grid } from '../components/grid';
import { smallGridData, mediumGridData, largeGridData } from './fixtures';

import {
  MarkdownGridPanel,
  ControlsPanel,
  MetricsPanel,
  UniqueVisitorsPanel,
  ResponseCodesPanel,
  GraphPanel,
  LogsTable,
} from '../constants';

import SANKEY_CHART_GRAPH from '../images/sankey_chart.png';
import DESTINATION_HEATMAP from '../images/destination_heatmap.png';
import REQUEST_MAP from '../images/total_requests_map.png';
import BYTES_BAR_GRAPH from '../images/bytes_bar_graph.png';
import { TestReactGrid } from '../components/new_grid';
import { ControlledStack } from '../components/test_react_grid_demo';
import { SubgridDemo } from '../components/test_subgrid_demo';

export default {
  component: EuiPanel,
  title: 'Dashboard Grid Layout',
  description: 'POC of new grid layout system',
  argTypes: {},
};

export const DefaultReactExample = () => {
  return <ControlledStack />;
};

export const SubgridExample = () => {
  return <SubgridDemo />;
};

export const EmptyExample = () => {
  return <TestReactGrid columns={24} />;
};

export const SmallGridExample = () => {
  return <TestReactGrid columns={12} gridData={smallGridData} />;
};

export const MediumGridExample = () => {
  return <TestReactGrid columns={24} gridData={mediumGridData} />;
};

export const LargeGridExample = () => {
  return <TestReactGrid columns={48} gridData={largeGridData} />;
};

export const LogsDashboardExample = () => {
  const gridData = [
    {
      x: 0,
      y: 0,
      w: 17,
      h: 6,
      id: '343f0bef-0b19-452e-b1c8-59beb18b6f0c',
      render: () => <MarkdownGridPanel />,
    },
    {
      x: 17,
      y: 0,
      w: 31,
      h: 6,
      id: '30326cdb-4ddd-49eb-a4f1-b555caa21d7c',
      render: () => <ControlsPanel />,
    },
    {
      x: 0,
      y: 6,
      w: 12,
      h: 8,
      id: 'bb94016e-f4a6-49ca-87a9-296a2869d570',
      render: () => <MetricsPanel value="2,777" label="Visits" fontSize="22px" />,
    },
    {
      x: 12,
      y: 6,
      w: 12,
      h: 8,
      id: '11',
      render: () => <UniqueVisitorsPanel />,
    },
    {
      x: 24,
      y: 6,
      w: 24,
      h: 13,
      id: '15',
      render: () => <ResponseCodesPanel />,
    },
    {
      x: 0,
      y: 14,
      w: 12,
      h: 5,
      id: '01d8e435-91c0-484f-a11e-856747050b0a',
      render: () => <MetricsPanel value="4.4%" label="HTTP 4xx" fontSize="12px" />,
    },
    {
      x: 12,
      y: 14,
      w: 12,
      h: 5,
      id: '8c1456d4-1993-4ba2-b701-04aca02c9fef',
      render: () => <MetricsPanel value="3.4%" label="HTTP 5xx" fontSize="12px" />,
    },
    {
      x: 0,
      y: 19,
      w: 24,
      h: 18,
      render: () => <GraphPanel title="[Logs] Total Requests and Bytes" graph={REQUEST_MAP} />,
    },
    {
      x: 24,
      y: 19,
      w: 24,
      h: 33,
      id: '14',
      render: () => (
        <GraphPanel
          title="[Logs] Machine OS and Destination Sankey Chart"
          graph={SANKEY_CHART_GRAPH}
        />
      ),
    },
    {
      x: 0,
      y: 37,
      w: 24,
      h: 15,
      id: '8e59c7cf-6e42-4343-a113-c4a255fcf2ce',
      render: () => (
        <GraphPanel
          title="[Logs] Unique Destination Heatmap"
          graph={DESTINATION_HEATMAP}
          height="94%"
        />
      ),
    },
    {
      x: 0,
      y: 52,
      w: 24,
      h: 13,
      id: '9',
      render: () => <LogsTable />,
    },

    {
      x: 24,
      y: 52,
      w: 24,
      h: 13,
      id: '10',
      render: () => (
        <GraphPanel title="[Logs] Bytes distribution" graph={BYTES_BAR_GRAPH} height="93%" />
      ),
    },
  ];

  return <TestReactGrid gridData={gridData} />;
};
