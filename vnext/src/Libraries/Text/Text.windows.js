/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 * @format
 */

'use strict';

// [Windows]
// Forking Text as a workaround in order to be able to render borders around it.

import {NativeText, NativeVirtualText} from './TextNativeComponent';

const DeprecatedTextPropTypes = require('../DeprecatedPropTypes/DeprecatedTextPropTypes');
const React = require('react');
const StyleSheet = require('../StyleSheet/StyleSheet');
const TextAncestor = require('./TextAncestor');
const Touchable = require('../Components/Touchable/Touchable');
const View = require('../Components/View/View');
const nullthrows = require('nullthrows');
const processColor = require('../StyleSheet/processColor');

import type {PressEvent} from '../Types/CoreEventTypes';
import type {HostComponent} from '../Renderer/shims/ReactNativeTypes';
import type {PressRetentionOffset, TextProps} from './TextProps';
import type {TextStyleProp, ViewStyleProp} from '../StyleSheet/StyleSheet'; // [Windows]

type ResponseHandlers = $ReadOnly<{|
  onStartShouldSetResponder: () => boolean,
  onResponderGrant: (event: PressEvent) => void,
  onResponderMove: (event: PressEvent) => void,
  onResponderRelease: (event: PressEvent) => void,
  onResponderTerminate: (event: PressEvent) => void,
  onResponderTerminationRequest: () => boolean,
|}>;

type Props = $ReadOnly<{|
  ...TextProps,
  forwardedRef: ?React.Ref<typeof NativeText | typeof NativeVirtualText>,
|}>;

type State = {|
  touchable: {|
    touchState: ?string,
    responderID: ?number,
  |},
  isHighlighted: boolean,
  createResponderHandlers: () => ResponseHandlers,
  responseHandlers: ?ResponseHandlers,
|};

const PRESS_RECT_OFFSET = {top: 20, left: 20, right: 20, bottom: 30};

/**
 * A React component for displaying text.
 *
 * See https://reactnative.dev/docs/text.html
 */
class TouchableText extends React.Component<Props, State> {
  static defaultProps = {
    accessible: true,
    allowFontScaling: true,
    ellipsizeMode: 'tail',
  };

  touchableGetPressRectOffset: ?() => PressRetentionOffset;
  touchableHandleActivePressIn: ?() => void;
  touchableHandleActivePressOut: ?() => void;
  touchableHandleLongPress: ?(event: PressEvent) => void;
  touchableHandlePress: ?(event: PressEvent) => void;
  touchableHandleResponderGrant: ?(event: PressEvent) => void;
  touchableHandleResponderMove: ?(event: PressEvent) => void;
  touchableHandleResponderRelease: ?(event: PressEvent) => void;
  touchableHandleResponderTerminate: ?(event: PressEvent) => void;
  touchableHandleResponderTerminationRequest: ?() => boolean;

  state = {
    ...Touchable.Mixin.touchableGetInitialState(),
    isHighlighted: false,
    createResponderHandlers: this._createResponseHandlers.bind(this),
    responseHandlers: null,
  };

  static getDerivedStateFromProps(
    nextProps: Props,
    prevState: State,
  ): $Shape<State> | null {
    return prevState.responseHandlers == null && isTouchable(nextProps)
      ? {
          responseHandlers: prevState.createResponderHandlers(),
        }
      : null;
  }

  render(): React.Node {
    let {forwardedRef, selectionColor, ...props} = this.props;
    if (isTouchable(this.props)) {
      props = {
        ...props,
        ...this.state.responseHandlers,
        isHighlighted: this.state.isHighlighted,
      };
    }
    if (selectionColor != null) {
      props = {
        ...props,
        selectionColor: processColor(selectionColor),
      };
    }
    if (__DEV__) {
      if (Touchable.TOUCH_TARGET_DEBUG && props.onPress != null) {
        props = {
          ...props,
          style: [props.style, {color: 'magenta'}],
        };
      }
    }

    // [Windows]
    // Due to XAML limitations, wrapping  Text with a View in order to display borders.
    // Like other platforms, ignoring borders for nested Text (using the Context API to detect nesting).
    return (
      <TextAncestor.Consumer>
        {hasTextAncestor => {
          if (hasTextAncestor) {
            return (
              // $FlowFixMe[prop-missing] For the `onClick` workaround.
              <NativeVirtualText
                {...props}
                // This is used on Android to call a nested Text component's press handler from the context menu.
                // TODO T75145059 Clean this up once Text is migrated off of Touchable
                onClick={props.onPress}
                ref={forwardedRef}
              />
            );
          } else {
            // View.js resets the TextAncestor, as a reportedly temporary change,
            // in order to properly handle nested images inside <Text> on Android/iOS:
            // https://github.com/facebook/react-native/commit/66601e755fcad10698e61d20878d52194ad0e90c.
            // Windows doesn't currently support nesting a <View> in a <Text>, so overriding this behavior here
            // by seting the Provider inside View, doesn't affect us functionally.
            let styleProps: ViewStyleProp = (props.style: any);
            if (
              styleProps &&
              styleProps.borderColor &&
              (styleProps.borderWidth ||
                styleProps.borderBottomWidth ||
                styleProps.borderEndWidth ||
                styleProps.borderLeftWidth ||
                styleProps.borderRightWidth ||
                styleProps.borderStartWidth ||
                styleProps.borderTopWidth)
            ) {
              let textStyleProps = Array.isArray(styleProps)
                ? StyleSheet.flatten(styleProps)
                : styleProps;
              let {
                margin,
                marginBottom,
                marginEnd,
                marginHorizontal,
                marginLeft,
                marginRight,
                marginStart,
                marginTop,
                marginVertical,
                padding,
                paddingBottom,
                paddingEnd,
                paddingHorizontal,
                paddingLeft,
                paddingRight,
                paddingStart,
                paddingTop,
                paddingVertical,
                ...rest
              } = textStyleProps != null ? textStyleProps : {};

              let {style, ...textPropsLessStyle} = props;

              return (
                <View style={styleProps}>
                  <TextAncestor.Provider value={true}>
                    <NativeText
                      style={((rest: any): TextStyleProp)}
                      {...textPropsLessStyle}
                      ref={forwardedRef}
                    />
                  </TextAncestor.Provider>
                </View>
              );
            } else {
              return (
                <TextAncestor.Provider value={true}>
                  <NativeText {...props} ref={forwardedRef} />
                </TextAncestor.Provider>
              );
            }
          }
        }}
      </TextAncestor.Consumer>
    );
  } // [/Windows]

  _createResponseHandlers(): ResponseHandlers {
    return {
      onStartShouldSetResponder: (): boolean => {
        const {onStartShouldSetResponder} = this.props;
        const shouldSetResponder =
          (onStartShouldSetResponder == null
            ? false
            : onStartShouldSetResponder()) || isTouchable(this.props);

        if (shouldSetResponder) {
          this._attachTouchHandlers();
        }
        return shouldSetResponder;
      },
      onResponderGrant: (event: PressEvent): void => {
        nullthrows(this.touchableHandleResponderGrant)(event);
        if (this.props.onResponderGrant != null) {
          this.props.onResponderGrant.call(this, event);
        }
      },
      onResponderMove: (event: PressEvent): void => {
        nullthrows(this.touchableHandleResponderMove)(event);
        if (this.props.onResponderMove != null) {
          this.props.onResponderMove.call(this, event);
        }
      },
      onResponderRelease: (event: PressEvent): void => {
        nullthrows(this.touchableHandleResponderRelease)(event);
        if (this.props.onResponderRelease != null) {
          this.props.onResponderRelease.call(this, event);
        }
      },
      onResponderTerminate: (event: PressEvent): void => {
        nullthrows(this.touchableHandleResponderTerminate)(event);
        if (this.props.onResponderTerminate != null) {
          this.props.onResponderTerminate.call(this, event);
        }
      },
      onResponderTerminationRequest: (): boolean => {
        const {onResponderTerminationRequest} = this.props;
        if (!nullthrows(this.touchableHandleResponderTerminationRequest)()) {
          return false;
        }
        if (onResponderTerminationRequest == null) {
          return true;
        }
        return onResponderTerminationRequest();
      },
    };
  }

  /**
   * Lazily attaches Touchable.Mixin handlers.
   */
  _attachTouchHandlers(): void {
    if (this.touchableGetPressRectOffset != null) {
      return;
    }
    for (const key in Touchable.Mixin) {
      if (typeof Touchable.Mixin[key] === 'function') {
        (this: any)[key] = Touchable.Mixin[key].bind(this);
      }
    }
    this.touchableHandleActivePressIn = (): void => {
      if (!this.props.suppressHighlighting && isTouchable(this.props)) {
        this.setState({isHighlighted: true});
      }
    };
    this.touchableHandleActivePressOut = (): void => {
      if (!this.props.suppressHighlighting && isTouchable(this.props)) {
        this.setState({isHighlighted: false});
      }
    };
    this.touchableHandlePress = (event: PressEvent): void => {
      if (this.props.onPress != null) {
        this.props.onPress(event);
      }
    };
    this.touchableHandleLongPress = (event: PressEvent): void => {
      if (this.props.onLongPress != null) {
        this.props.onLongPress(event);
      }
    };
    this.touchableGetPressRectOffset = (): PressRetentionOffset =>
      this.props.pressRetentionOffset == null
        ? PRESS_RECT_OFFSET
        : this.props.pressRetentionOffset;
  }
}

const isTouchable = (props: Props): boolean =>
  props.onPress != null ||
  props.onLongPress != null ||
  props.onStartShouldSetResponder != null;

const Text = (
  props: TextProps,
  forwardedRef: ?React.Ref<typeof NativeText | typeof NativeVirtualText>,
) => {
  return <TouchableText {...props} forwardedRef={forwardedRef} />;
};
const TextToExport = React.forwardRef(Text);
TextToExport.displayName = 'Text';

// TODO: Deprecate this.
/* $FlowFixMe(>=0.89.0 site=react_native_fb) This comment suppresses an error
 * found when Flow v0.89 was deployed. To see the error, delete this comment
 * and run Flow. */
TextToExport.propTypes = DeprecatedTextPropTypes;

type TextStatics = $ReadOnly<{|
  propTypes: typeof DeprecatedTextPropTypes,
|}>;

module.exports = ((TextToExport: any): React.AbstractComponent<
  TextProps,
  React.ElementRef<HostComponent<TextProps>>,
> &
  TextStatics);
