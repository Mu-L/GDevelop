// @flow
import React from 'react';
import { t } from '@lingui/macro';
import { I18n } from '@lingui/react';
import { type I18n as I18nType } from '@lingui/core';
import { useInterval } from '../Utils/UseInterval';
import { getElementAncestry } from './HTMLUtils';
import {
  type InAppTutorialFlowFormattedStep,
  type InAppTutorialFormattedTooltip,
  type EditorIdentifier,
} from '../Utils/GDevelopServices/InAppTutorial';
import InAppTutorialElementHighlighter from './InAppTutorialElementHighlighter';
import InAppTutorialTooltipDisplayer from './InAppTutorialTooltipDisplayer';
import {
  aboveMaterialUiMaxZIndex,
  isElementADialog,
  isElementAMuiInput,
} from '../UI/MaterialUISpecificUtil';
import { getEditorTabSelector } from './InAppTutorialOrchestrator';
import InAppTutorialDialog from './InAppTutorialDialog';
import BlockingLayerWithHoles from './BlockingLayerWithHoles';
import useIsElementVisibleInScroll from '../Utils/UseIsElementVisibleInScroll';
import { instancesEditorId } from '../InstancesEditor';
import { swipeableDrawerContainerId } from '../SceneEditor/SwipeableDrawerEditorsDisplay';

const styles = {
  avatarContainer: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    zIndex: aboveMaterialUiMaxZIndex, // Make sure the avatar is above the dialogs or drawers created by Material UI.
    display: 'flex',
    visibility: 'hidden',
    boxShadow:
      '0px 2px 4px -1px rgb(0 0 0 / 20%), 0px 4px 5px 0px rgb(0 0 0 / 14%), 0px 1px 10px 0px rgb(0 0 0 / 12%)', // Same as used by Material UI for the Paper component
    borderRadius: 30,
  },
  link: { cursor: 'pointer' },
  avatarImage: { cursor: 'pointer' },
};

const ELEMENT_QUERY_FREQUENCY = 500;
const HIDE_QUERY_FREQUENCY = 1000;

const getElementToHighlightRootDialog = (
  element: HTMLElement
): Element | null => {
  const elementAncestry = getElementAncestry(element, []);
  // Ancestry is starting from direct parent to furthest parent.
  for (
    let parentIndex = elementAncestry.length - 1;
    parentIndex >= 0;
    parentIndex--
  ) {
    const parent = elementAncestry[parentIndex];
    if (isElementADialog(parent)) {
      return parent;
    }
  }
  return null;
};

const isThereAnOpenDialogInTheFollowingSiblings = (
  element: Element
): boolean => {
  let nextElement = element.nextElementSibling;
  while (nextElement) {
    if (isElementADialog(nextElement, { isVisible: true })) {
      return true;
    } else {
      nextElement = nextElement.nextElementSibling;
    }
  }
  return false;
};

const isThereAnErrorBoundarySomewhere = () =>
  !!document.querySelector('[data-error-boundary]');

const getWrongEditorTooltip = (
  i18n: I18nType,
  expectedEditor: {| editor: EditorIdentifier, scene?: string |} | null
): InAppTutorialFormattedTooltip | null => {
  if (!expectedEditor) return null;
  // TODO: handle external event, external layout, resources and extension editors
  const translatedExpectedEditor =
    expectedEditor.editor === 'Scene'
      ? i18n._(t`the scene editor`)
      : expectedEditor.editor === 'Home'
      ? i18n._(t`the home page`)
      : i18n._(t`the events sheet`);

  const sceneMention = expectedEditor.scene
    ? ` for scene "${expectedEditor.scene}"`
    : '';

  return {
    title: i18n._(t`You're leaving the game tutorial`),
    placement: 'top',
    description: i18n._(
      t`Go back to ${translatedExpectedEditor}${sceneMention} to keep creating your game.`
    ),
    standalone: true,
  };
};

export const queryElementOrItsMostVisuallySignificantParent = (
  elementToHighlightId: string
): {|
  elementToHighlight: ?HTMLElement,
  elementWithId: ?HTMLElement,
|} => {
  let foundElement = document.querySelector(elementToHighlightId);
  if (foundElement instanceof HTMLTextAreaElement) {
    // In this case, the element to highlight is a Material UI multiline text field
    // and the textarea only occupies a fraction of the whole input. So we're going
    // to highlight the parent div.
    const parentDiv = foundElement.closest('div');
    if (parentDiv instanceof HTMLElement && isElementAMuiInput(parentDiv)) {
      return { elementToHighlight: parentDiv, elementWithId: foundElement };
    }
  } else if (
    foundElement instanceof HTMLInputElement &&
    'searchBar' in foundElement.dataset
  ) {
    const containerDiv = foundElement.closest('div[data-search-bar-container]');
    if (containerDiv instanceof HTMLElement) {
      return { elementToHighlight: containerDiv, elementWithId: foundElement };
    }
  }
  return {
    elementToHighlight: foundElement,
    elementWithId: foundElement,
  };
};

type Props = {|
  step: InAppTutorialFlowFormattedStep,
  expectedEditor: {| editor: EditorIdentifier, scene?: string |} | null,
  goToFallbackStep: () => void,
  endTutorial: ({| reason: 'completed' | 'user-early-exit' |}) => void,
  progress: number,
  goToNextStep: () => void,
|};

function InAppTutorialStepDisplayer({
  step: {
    elementToHighlightId,
    tooltip,
    nextStepTrigger,
    dialog,
    interactsWithCanvas,
    disableBlockingLayer,
  },
  expectedEditor,
  goToFallbackStep,
  endTutorial,
  progress,
  goToNextStep,
}: Props) {
  const [
    elementToHighlight,
    setElementToHighlight,
  ] = React.useState<?HTMLElement>(null);
  const [elementWithId, setElementWithId] = React.useState<?HTMLElement>(null);
  const [
    hideBehindPriorityElement,
    setHideBehindPriorityElement,
  ] = React.useState<boolean>(false);
  const [assistantImage, setAssistantImage] = React.useState<?HTMLDivElement>(
    null
  );
  const [blockingLayerHoles, setBlockingLayerHoles] = React.useState([]);

  const defineAssistantImage = React.useCallback(node => {
    if (node) {
      setAssistantImage(node);
    }
  }, []);

  // The element could disappear if the user closes a dialog for instance.
  // So we need to periodically query it.
  const queryElement = React.useCallback(
    () => {
      if (!elementToHighlightId) return;

      const {
        elementToHighlight,
        elementWithId,
      } = queryElementOrItsMostVisuallySignificantParent(elementToHighlightId);
      setElementToHighlight(elementToHighlight);
      setElementWithId(elementWithId);
    },
    [elementToHighlightId]
  );
  useInterval(queryElement, ELEMENT_QUERY_FREQUENCY);

  const hideIfBehindPriorityElement = React.useCallback(
    () => {
      if (!elementToHighlight) return;
      setHideBehindPriorityElement(false);
      const rootDialog = getElementToHighlightRootDialog(elementToHighlight);
      if (!rootDialog) {
        // if the element to highlight in not on a dialog, the highlighter
        // is on a z index close to element to highlight. So it will be hidden
        // behind a dialog if there's one, so no need to force-hide it.
        return;
      }
      if (
        // Material UI dialogs are displayed at z-index 1300 and out of the root
        // React element. So the highlighter and the tooltip visibility can only be
        // tuned via their z index.
        // When the element to highlight is on a dialog, the highlighter and
        // the tooltip must be at a similar yet higher z-index. But MUI handles
        // multiple dialogs by setting the latest opened dialog root html element
        // below the previous one. So the highlighter and the tooltip will be visible
        // through the latest dialog. So we have to "manually" hide them when we detect
        // the element to highlight is both on a dialog and that there's another dialog
        // opened above it.
        isThereAnOpenDialogInTheFollowingSiblings(rootDialog) ||
        // The tooltip is not displayed if there is an error boundary somewhere to avoid
        // bothering the user that would be trying to close the error boundary.
        isThereAnErrorBoundarySomewhere()
      ) {
        setHideBehindPriorityElement(true);
      }
    },
    [elementToHighlight]
  );
  useInterval(hideIfBehindPriorityElement, HIDE_QUERY_FREQUENCY);

  React.useEffect(
    () => {
      setElementToHighlight(null);
      setHideBehindPriorityElement(false);
    },
    [elementToHighlightId]
  );

  React.useEffect(
    () => {
      // If the element is missing and we are on the right editor, go back
      // to fallback step after a delay.
      if (elementToHighlightId && !elementToHighlight && !expectedEditor) {
        const timeoutId = setTimeout(goToFallbackStep, 1000);
        return () => clearTimeout(timeoutId);
      }
    },
    [elementToHighlightId, elementToHighlight, goToFallbackStep, expectedEditor]
  );

  const renderHighlighter = () => {
    if (
      // hide highlighter if
      (!elementToHighlight && !expectedEditor) || // there's no element to highlight and the user is on the right editor
      hideBehindPriorityElement // the element to highlight is on a dialog hidden behind another one
    ) {
      return null;
    }
    if (expectedEditor) {
      const tabToHighlight = document.querySelector(
        getEditorTabSelector({
          editor: expectedEditor.editor,
          sceneName: expectedEditor.scene,
        })
      );
      if (tabToHighlight) {
        return <InAppTutorialElementHighlighter element={tabToHighlight} />;
      }
      return null;
    }
    if (!elementToHighlight) return null;
    return <InAppTutorialElementHighlighter element={elementToHighlight} />;
  };

  const renderDialog = () => {
    if (!dialog) return null;

    return (
      <InAppTutorialDialog
        dialogContent={dialog}
        goToNextStep={goToNextStep}
        endTutorial={endTutorial}
      />
    );
  };

  const getFillAutomaticallyFunction = React.useCallback(
    () => {
      if (!nextStepTrigger || !('valueEquals' in nextStepTrigger)) {
        return undefined;
      }
      // $FlowIgnore - checked above that valueEquals in in nextStepTrigger.
      const { valueEquals } = nextStepTrigger;
      if (
        valueEquals === null ||
        valueEquals === undefined ||
        typeof valueEquals !== 'string'
      ) {
        return undefined;
      }

      if (
        !(elementWithId instanceof HTMLInputElement) &&
        !(elementWithId instanceof HTMLTextAreaElement)
      ) {
        return undefined;
      }

      const valuePropertyDescriptor = Object.getOwnPropertyDescriptor(
        elementWithId.constructor.prototype,
        'value'
      );
      if (!valuePropertyDescriptor) return undefined;
      const valueSetter = valuePropertyDescriptor.set;
      if (!valueSetter) return undefined;
      return () => {
        valueSetter.call(elementWithId, valueEquals);
        // Trigger blur to make sure the value is taken into account
        // by the React input.
        elementWithId.dispatchEvent(new Event('blur', { bubbles: true }));
      };
    },
    [nextStepTrigger, elementWithId]
  );

  const anchorElement = tooltip
    ? tooltip.standalone
      ? assistantImage
      : elementToHighlight || null
    : null;
  const activeCanvas = document.querySelector(
    `#scene-editor[data-active=true] #${instancesEditorId}`
  );
  const swipeableDrawerContainer = document.querySelector(
    `#${swipeableDrawerContainerId}`
  );

  const updateBlockingLayerVisibility = React.useCallback(
    (entries: IntersectionObserverEntry[]) => {
      let holes = [];
      if (
        anchorElement &&
        !expectedEditor &&
        !hideBehindPriorityElement &&
        !disableBlockingLayer
      ) {
        const isIntersecting = entries[0].isIntersecting;
        if (isIntersecting) {
          if (elementToHighlight) {
            holes.push(elementToHighlight);
          }
          if (tooltip && tooltip.standalone && assistantImage) {
            holes.push(assistantImage);
          }
          if (interactsWithCanvas && activeCanvas) {
            // If the swipeable drawer exists, we are on mobile and as the drawers are on top
            // of the canvas, let's avoid creating holes as it will produce the opposite effect.
            if (swipeableDrawerContainer) {
              holes = [];
            } else {
              holes.push(activeCanvas);
            }
          }
        }
      }

      setBlockingLayerHoles(holes);
    },
    [
      anchorElement,
      expectedEditor,
      hideBehindPriorityElement,
      activeCanvas,
      interactsWithCanvas,
      disableBlockingLayer,
      elementToHighlight,
      assistantImage,
      tooltip,
      swipeableDrawerContainer,
    ]
  );

  useIsElementVisibleInScroll(anchorElement, updateBlockingLayerVisibility);

  const renderTooltip = (i18n: I18nType) => {
    if (tooltip && !expectedEditor && !hideBehindPriorityElement) {
      if (!anchorElement) return null;

      return (
        <>
          <InAppTutorialTooltipDisplayer
            endTutorial={endTutorial}
            anchorElement={anchorElement}
            tooltip={tooltip}
            progress={progress}
            goToNextStep={goToNextStep}
            buttonLabel={
              nextStepTrigger && nextStepTrigger.clickOnTooltipButton
                ? nextStepTrigger.clickOnTooltipButton
                : undefined
            }
            fillAutomatically={getFillAutomaticallyFunction()}
            isBlockingLayerDisplayed={!!blockingLayerHoles.length}
          />
          <BlockingLayerWithHoles elements={blockingLayerHoles} />
        </>
      );
    }

    const wrongEditorTooltip = getWrongEditorTooltip(i18n, expectedEditor);
    if (wrongEditorTooltip && assistantImage) {
      return (
        <InAppTutorialTooltipDisplayer
          endTutorial={endTutorial}
          anchorElement={assistantImage}
          tooltip={wrongEditorTooltip}
          progress={progress}
          goToNextStep={goToNextStep}
          // No Blocking Layer when on the wrong editor.
          isBlockingLayerDisplayed={false}
        />
      );
    }
    return null;
  };

  return (
    <I18n>
      {({ i18n }) => {
        const displayRedHero =
          expectedEditor || (tooltip && tooltip.standalone);
        return (
          <>
            <div
              style={{
                ...styles.avatarContainer,
                visibility: displayRedHero ? 'visible' : 'hidden',
              }}
              ref={defineAssistantImage}
              id="in-app-tutorial-avatar"
            >
              <img
                alt="GDevelop mascot red hero"
                src="res/hero60.png"
                width={60}
                height={60}
                style={styles.avatarImage}
              />
            </div>
            {renderHighlighter()}
            {renderTooltip(i18n)}
            {renderDialog()}
          </>
        );
      }}
    </I18n>
  );
}

export default InAppTutorialStepDisplayer;
