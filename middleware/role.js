// middleware/role.js
module.exports = function onlyChief(req, res, next) {
  // 20010 這個 gidNumber 代表 chief 群組
  if (req.session.user && req.session.user.isChief === true) {
    return next();
  }
  req.flash('error_msg', '權限不足');
   res.redirect(req.get('referer') || '/');
};
