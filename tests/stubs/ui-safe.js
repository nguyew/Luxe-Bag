const React = require('react');
module.exports = { SafeAreaView: (p) => React.createElement('SafeAreaView', p, p.children), useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
