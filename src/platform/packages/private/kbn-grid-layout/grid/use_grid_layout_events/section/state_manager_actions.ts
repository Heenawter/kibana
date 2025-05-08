/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the "Elastic License
 * 2.0", the "GNU Affero General Public License v3.0 only", and the "Server Side
 * Public License v 1"; you may not use this file except in compliance with, at
 * your election, the "Elastic License 2.0", the "GNU Affero General Public
 * License v3.0 only", or the "Server Side Public License, v 1".
 */

import deepEqual from 'fast-deep-equal';
import { pick } from 'lodash';

import { GridLayoutStateManager, GridSectionData, OrderedLayout } from '../../types';
import { getPanelKeysInOrder } from '../../utils/resolve_grid_section';
import { resolveSections } from '../../utils/section_management';
import { getSensorType } from '../sensors';
import { PointerPosition, UserInteractionEvent } from '../types';

let startingLayout: OrderedLayout | undefined;

export const startAction = (
  e: UserInteractionEvent,
  gridLayoutStateManager: GridLayoutStateManager,
  sectionId: string
) => {
  const headerRef = gridLayoutStateManager.headerRefs.current[sectionId];
  if (!headerRef) return;

  startingLayout = gridLayoutStateManager.gridLayout$.getValue();
  const startingPosition = pick(headerRef.getBoundingClientRect(), ['top', 'left']);
  gridLayoutStateManager.activeRowEvent$.next({
    id: sectionId,
    startingPosition,
    sensorType: getSensorType(e),
    translate: {
      top: 0,
      left: 0,
    },
  });
};

export const commitAction = ({ activeRowEvent$, headerRefs }: GridLayoutStateManager) => {
  const event = activeRowEvent$.getValue();
  activeRowEvent$.next(undefined);
  startingLayout = undefined;

  if (!event) return;
  headerRefs.current[event.id]?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });
};

export const cancelAction = ({
  activeRowEvent$,
  gridLayout$,
  headerRefs,
}: GridLayoutStateManager) => {
  const event = activeRowEvent$.getValue();
  activeRowEvent$.next(undefined);
  if (startingLayout) {
    gridLayout$.next(startingLayout);
    startingLayout = undefined;
  }
  if (!event) return;
  headerRefs.current[event.id]?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });
};

export const moveAction = (
  gridLayoutStateManager: GridLayoutStateManager,
  startingPointer: PointerPosition,
  currentPointer: PointerPosition
) => {
  const currentActiveRowEvent = gridLayoutStateManager.activeRowEvent$.getValue();
  if (!currentActiveRowEvent) return;

  const {
    runtimeSettings$: { value: runtimeSettings },
    headerRefs: { current: gridHeaderElements },
    sectionRefs: { current: gridSectionElements },
  } = gridLayoutStateManager;

  const currentLayout = gridLayoutStateManager.gridLayout$.getValue();

  // check with section ID is being targetted
  const activeRowRect = gridHeaderElements[currentActiveRowEvent.id]?.getBoundingClientRect() ?? {
    top: 0,
    bottom: 0,
  };
  const targetSectionId: string | undefined = (() => {
    let currentTargetSection;
    Object.entries(gridSectionElements).forEach(([id, section]) => {
      const { top, bottom } = section?.getBoundingClientRect() ?? { top: 0, bottom: 0 };
      if (activeRowRect.top >= top && activeRowRect.bottom <= bottom) {
        currentTargetSection = id;
      }
    });
    return currentTargetSection;
  })();

  if (!targetSectionId || !currentLayout[targetSectionId].isMainSection) {
    // when not targetting an existing main section, then simply re-order the columns based on their positions in the DOM
    const sortedRows = Object.entries({ ...gridHeaderElements, ...gridSectionElements })
      .map(([id, row]) => {
        // by spreading in this way, we use the grid wrapper elements for expanded sections and the headers for collapsed sections
        const { top, height } = row?.getBoundingClientRect() ?? { top: 0, height: 0 };
        return { id, middle: top + height / 2 };
      })
      .sort(({ middle: middleA }, { middle: middleB }) => middleA - middleB);

    const ordersAreEqual = sortedRows.every(
      (section, index) => currentLayout[section.id].order === index
    );
    if (!ordersAreEqual) {
      const orderedLayout: OrderedLayout = {};
      sortedRows.forEach((row, index) => {
        orderedLayout[row.id] = {
          ...currentLayout[row.id],
          order: index,
        };
      });
      gridLayoutStateManager.gridLayout$.next(orderedLayout);
    }
  } else {
    // when a main section is being targetted, allow the header to be dropped between panels
    const { gutterSize, rowHeight } = runtimeSettings;

    const targetRow = (() => {
      const targetedGridSection = gridSectionElements[targetSectionId];
      const targetedGridSectionRect = targetedGridSection?.getBoundingClientRect();
      const targetedGridTop = targetedGridSectionRect?.top ?? 0;
      const localYCoordinate = activeRowRect.top - targetedGridTop;
      return Math.max(Math.round(localYCoordinate / (rowHeight + gutterSize)), 0);
    })();

    // rebuild layout by splittng the targetted sectionId into 2
    let order = 0;
    let mainSectionCount = 0;
    const firstSectionOrder = currentLayout[targetSectionId].order;
    const anotherLayout: OrderedLayout = {};
    Object.entries(currentLayout)
      .sort(([idA, { order: orderA }], [idB, { order: orderB }]) => orderA - orderB)
      .forEach(([id, section]) => {
        if (id === currentActiveRowEvent.id) return;

        if (section.order < firstSectionOrder) {
          anotherLayout[id] = section;
        } else if (section.order === firstSectionOrder) {
          // split this section into 2 - one main section above the dragged section, and one below
          const topSectionPanels: GridSectionData['panels'] = {};
          const bottomSectionPanels: GridSectionData['panels'] = {};
          let startingRow: number;
          getPanelKeysInOrder(section.panels).forEach((panelId) => {
            const panel = section.panels[panelId];
            if (panel.row < targetRow) {
              topSectionPanels[panel.id] = panel;
            } else {
              if (startingRow === undefined) {
                startingRow = panel.row;
              }
              bottomSectionPanels[panel.id] = { ...panel, row: panel.row - startingRow };
            }
          });

          if (Object.keys(topSectionPanels).length > 0) {
            anotherLayout[`main-${mainSectionCount}`] = {
              id: `main-${mainSectionCount}`,
              isMainSection: true,
              order,
              panels: topSectionPanels,
            };
            order++;
            mainSectionCount++;
          }
          anotherLayout[currentActiveRowEvent.id] = {
            ...currentLayout[currentActiveRowEvent.id],
            order,
          };
          order++;

          if (Object.keys(bottomSectionPanels).length > 0) {
            anotherLayout[`main-${mainSectionCount}`] = {
              id: `main-${mainSectionCount}`,
              isMainSection: true,
              order,
              panels: bottomSectionPanels,
            };
          }
        } else {
          // push each other rows down
          const sectionId = section.isMainSection ? `main-${mainSectionCount}` : id;
          anotherLayout[sectionId] = { ...section, id: sectionId, order };
        }
        order++;
        if (section.isMainSection) mainSectionCount++;
      });

    const finalLayout = resolveSections(anotherLayout);
    if (!deepEqual(currentLayout, finalLayout))
      gridLayoutStateManager.gridLayout$.next(finalLayout);
  }
  // update the dragged element
  gridLayoutStateManager.activeRowEvent$.next({
    ...currentActiveRowEvent,
    targetSection: targetSectionId,
    translate: {
      top: currentPointer.clientY - startingPointer.clientY,
      left: currentPointer.clientX - startingPointer.clientX,
    },
  });
};
