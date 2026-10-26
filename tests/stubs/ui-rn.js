const React = require('react');
const h = React.createElement;
const host = (name) => (props) => h(name, props, props.children);

const Pressable = (p) => h('Pressable', p, typeof p.children === 'function' ? p.children({ pressed: false }) : p.children);
const renderMaybe = (c) => (c ? (typeof c === 'function' ? h(c) : c) : null);

function FlatList(p) {
  const data = p.data || [];
  return h('FlatList', p,
    renderMaybe(p.ListHeaderComponent),
    data.length === 0 ? renderMaybe(p.ListEmptyComponent) : null,
    data.map((item, index) => h(React.Fragment, { key: p.keyExtractor ? p.keyExtractor(item, index) : index }, p.renderItem({ item, index }))),
    renderMaybe(p.ListFooterComponent));
}
class Value { constructor(v) { this.v = v; } setValue(v) { this.v = v; } interpolate() { return this; } addListener() { return ''; } removeListener() {} stopAnimation() {} }
const anim = () => ({ start: (cb) => cb && cb({ finished: true }), stop() {} });
const Animated = { Value, View: host('AnimatedView'), Text: host('AnimatedText'), timing: anim, spring: anim, parallel: anim, sequence: anim, loop: anim, event: () => () => {} };
const alerts = [];
const Alert = { alert: (title, message, buttons) => alerts.push({ title, message, buttons: buttons || [] }) };

module.exports = {
  View: host('View'), Text: host('Text'), TextInput: host('TextInput'), Image: host('Image'), ScrollView: host('ScrollView'),
  KeyboardAvoidingView: host('KeyboardAvoidingView'), ActivityIndicator: host('ActivityIndicator'), Switch: host('Switch'),
  Pressable, FlatList, Animated, Alert, __alerts: alerts,
  Modal: (p) => (p.visible ? h('Modal', p, p.children) : null),
  RefreshControl: () => null, StatusBar: () => null,
  StyleSheet: { create: (s) => s, flatten: (s) => s, hairlineWidth: 1, absoluteFill: {}, absoluteFillObject: {} },
  Platform: { OS: 'ios', select: (o) => (o.ios !== undefined ? o.ios : o.default) },
  AppState: { addEventListener: () => ({ remove() {} }) },
  Linking: { openSettings() {}, openURL() {} },
  LayoutAnimation: { configureNext() {}, Presets: { easeInEaseOut: {} } },
};
