const React = require('react');
const state = { nav: null };
module.exports = {
  __state: state,
  useNavigation: () => state.nav,
  useFocusEffect: (cb) => React.useEffect(() => { const c = cb(); return typeof c === 'function' ? c : undefined; }, [cb]),
  NavigationContainer: (p) => p.children,
};
