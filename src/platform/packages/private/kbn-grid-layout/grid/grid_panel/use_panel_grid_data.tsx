/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import { useEffect, useMemo, useRef } from 'react';
import { BehaviorSubject, distinctUntilChanged, map } from 'rxjs';

import { GridLayoutData, GridPanelData, GridRowData } from '../types';
import { useGridLayoutContext } from '../use_grid_layout_context';
import { isGridDataEqual } from '../utils/equality_checks';

export const useGridPanelState = ({
  panelId,
}: {
  panelId: string;
}): BehaviorSubject<GridPanelData & { rowId: string }> => {
  const { gridLayoutStateManager } = useGridLayoutContext();
  const cleanupCallback = useRef<null | (() => void)>();

  const panel$ = useMemo(() => {
    const panelSubject = new BehaviorSubject(
      getPanelState(gridLayoutStateManager.gridLayout$.getValue(), panelId)
    );

    const subscription = gridLayoutStateManager.gridLayout$
      .pipe(
        map((layout) => getPanelState(layout, panelId)),
        distinctUntilChanged(
          (panelA, panelB) => isGridDataEqual(panelA, panelB) && panelA.rowId === panelB.rowId
        )
      )
      .subscribe((panel) => {
        panelSubject.next(panel);
      });

    cleanupCallback.current = () => {
      subscription.unsubscribe();
    };

    return panelSubject;
  }, [gridLayoutStateManager.gridLayout$, panelId]);

  useEffect(() => {
    return () => {
      if (cleanupCallback.current) cleanupCallback.current();
    };
  }, []);

  return panel$;
};

const getPanelState = (layout: GridLayoutData, panelId: string) => {
  const flattenedPanels: { [id: string]: GridPanelData & { rowId: string } } = {};
  Object.values(layout).forEach((widget) => {
    if (widget.type === 'panel') {
      flattenedPanels[widget.id] = { ...widget, rowId: 'main' };
    } else {
      Object.values((widget as GridRowData).panels).forEach((panel) => {
        flattenedPanels[panel.id] = { ...panel, rowId: widget.id };
      });
    }
  });
  return flattenedPanels[panelId];
};
