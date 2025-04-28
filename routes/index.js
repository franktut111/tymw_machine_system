const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.render('index', {
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
});
module.exports = router;
