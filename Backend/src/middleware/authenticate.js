const passport = require('../config/passport');

const authenticate = (req, res, next) => {
  passport.authenticate('jwt', { session: false }, (error, user) => {
    if (error) {
      return next(error);
    }
    if (!user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    req.user = user;
    return next();
  })(req, res, next);
};

module.exports = authenticate;
