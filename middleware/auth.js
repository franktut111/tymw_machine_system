module.exports = function ensureAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash('error_msg', '請先登入以繼續使用');
  res.redirect('/login');
};




