// @flow
import * as React from 'react';
import { Spacer, Line, Column, LargeSpacer } from './Grid';
import { useResponsiveWindowSize } from './Responsive/ResponsiveWindowMeasurer';

type TextFieldWithButtonLayoutProps = {|
  renderTextField: () => React.Node,
  renderButton: (style: {|
    marginTop?: number,
    marginBottom?: number,
    marginLeft?: number,
    marginRight?: number,
    margin?: number,
    flexShrink?: 0,
  |}) => React.Node,
  margin?: 'none' | 'dense',
  noFloatingLabelText?: boolean,
|};

const buttonCommonStyles = {
  // Ensure the button is not shrinked, even if the text field
  // (in particular with a long helper text) is large.
  flexShrink: 0,
};

const textFieldWithButtonLayoutStyles = {
  filledTextFieldWithLabelRightButtonMargins: {
    ...buttonCommonStyles,
    marginTop: 15, // Properly align with the text field (only dense "filled" text fields supported)
    marginLeft: 8,
  },
  filledTextFieldWithoutLabelRightButtonMargins: {
    ...buttonCommonStyles,
    marginTop: 6, // Properly align with the text field (only dense "filled" text fields supported)
    marginLeft: 8,
  },
  standardTextFieldWithLabelRightButtonMargins: {
    ...buttonCommonStyles,
    marginTop: 17, // Properly align with the text field (only "standard" text fields with margin "none" supported)
    marginLeft: 8,
  },
  standardTextFieldWithoutLabelRightButtonMargins: {
    ...buttonCommonStyles,
    marginTop: 0, // Properly align with the text field (only "standard" text fields with margin "none" supported)
    marginLeft: 8,
  },
  textFieldOnMobileMargins: {
    ...buttonCommonStyles,
    // Thanks to the ResponsiveLineStackLayout, the text field is full width on mobile and is spaced out already.
    marginTop: 0,
    marginLeft: 0,
  },
};

/**
 * Position a button on the right of a TextField.
 */
export const TextFieldWithButtonLayout = ({
  margin,
  noFloatingLabelText,
  renderTextField,
  renderButton,
}: TextFieldWithButtonLayoutProps) => {
  const { isMobile, isLandscape } = useResponsiveWindowSize();
  return (
    <ResponsiveLineStackLayout
      alignItems="flex-start" // Align from the top to stay at the same position when error/multiline
      expand
      noMargin
      noResponsiveLandscape
    >
      {renderTextField()}
      {renderButton(
        isMobile && !isLandscape
          ? textFieldWithButtonLayoutStyles.textFieldOnMobileMargins
          : margin === 'none'
          ? noFloatingLabelText
            ? textFieldWithButtonLayoutStyles.standardTextFieldWithoutLabelRightButtonMargins
            : textFieldWithButtonLayoutStyles.standardTextFieldWithLabelRightButtonMargins
          : noFloatingLabelText
          ? textFieldWithButtonLayoutStyles.filledTextFieldWithoutLabelRightButtonMargins
          : textFieldWithButtonLayoutStyles.filledTextFieldWithLabelRightButtonMargins
      )}
    </ResponsiveLineStackLayout>
  );
};

type LineStackLayoutProps = {|
  id?: string,
  alignItems?: string,
  justifyContent?: string,
  expand?: boolean,
  noMargin?: boolean,
  children: React.Node,
  useLargeSpacer?: boolean,
  overflow?: 'hidden', // allows children Text components to use text ellipsis when they are too long
  neverShrink?: boolean,
|};

export const LineStackLayout = ({
  id,
  alignItems,
  justifyContent,
  expand,
  noMargin,
  children,
  useLargeSpacer,
  overflow,
  neverShrink,
}: LineStackLayoutProps) => {
  let isFirstChild = true;
  return (
    <Line
      id={id}
      alignItems={alignItems}
      justifyContent={justifyContent}
      expand={expand}
      noMargin={noMargin}
      overflow={overflow}
      neverShrink={neverShrink}
    >
      {React.Children.map(children, (child, index) => {
        if (!child) return null;

        const addSpacers = !isFirstChild;
        isFirstChild = false;

        return (
          <React.Fragment>
            {addSpacers && (useLargeSpacer ? <LargeSpacer /> : <Spacer />)}
            {child}
          </React.Fragment>
        );
      })}
    </Line>
  );
};

type ResponsiveLineStackLayoutProps = {|
  id?: string,
  alignItems?: string,
  justifyContent?: string,
  expand?: boolean,
  /** Prefer `noColumnMargin` if needed. */
  noMargin?: boolean,
  /** Remove the margin on the left and right of the column, when the layout is shown as a single column. */
  noColumnMargin?: boolean,
  /** Do not measure window width in case parent component is in smaller component */
  forceMobileLayout?: boolean,
  noOverflowParent?: boolean,
  noResponsiveLandscape?: boolean,
  useLargeSpacer?: boolean,
  children: React.Node,
|};

export const ResponsiveLineStackLayout = ({
  id,
  alignItems,
  justifyContent,
  expand,
  noMargin,
  noColumnMargin,
  forceMobileLayout,
  noOverflowParent,
  noResponsiveLandscape,
  useLargeSpacer,
  children,
}: ResponsiveLineStackLayoutProps) => {
  const { isMobile, isLandscape } = useResponsiveWindowSize();
  const assumeMobileScreen = forceMobileLayout || isMobile;
  const shouldPreventSwitchingToColumn = noResponsiveLandscape && isLandscape;
  const shouldSwitchToColumn =
    assumeMobileScreen && !shouldPreventSwitchingToColumn;

  return shouldSwitchToColumn ? (
    <ColumnStackLayout
      id={id}
      noMargin={noMargin || noColumnMargin}
      expand
      useLargeSpacer={useLargeSpacer}
      noOverflowParent={noOverflowParent}
    >
      {children}
    </ColumnStackLayout>
  ) : (
    <LineStackLayout
      id={id}
      alignItems={alignItems}
      justifyContent={justifyContent}
      expand={expand}
      noMargin={noMargin}
      useLargeSpacer={useLargeSpacer}
    >
      {children}
    </LineStackLayout>
  );
};

type ColumnStackLayoutProps = {|
  id?: string,
  alignItems?: string,
  justifyContent?: string,
  expand?: boolean,
  noMargin?: boolean,
  children: React.Node,
  noOverflowParent?: boolean,
  useFullHeight?: boolean,
  useLargeSpacer?: boolean,
|};

export const ColumnStackLayout = ({
  id,
  alignItems,
  justifyContent,
  expand,
  noMargin,
  children,
  noOverflowParent,
  useFullHeight,
  useLargeSpacer,
}: ColumnStackLayoutProps) => {
  let isFirstChild = true;
  return (
    <Column
      id={id}
      alignItems={alignItems}
      justifyContent={justifyContent}
      expand={expand}
      noMargin={noMargin}
      noOverflowParent={noOverflowParent}
      useFullHeight={useFullHeight}
    >
      {React.Children.map(children, (child, index) => {
        if (!child) return null;

        const addSpacers = !isFirstChild;
        isFirstChild = false;

        return (
          <React.Fragment>
            {addSpacers && (useLargeSpacer ? <LargeSpacer /> : <Spacer />)}
            {child}
          </React.Fragment>
        );
      })}
    </Column>
  );
};
