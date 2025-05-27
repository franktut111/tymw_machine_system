const express = require('express');
const router = express.Router();
/**
 * @swagger
 * /:
 *   get:
 *     tags:
 *       - 首頁
 *     summary: 顯示系統首頁
 *     description: 載入首頁畫面，並顯示成功或錯誤訊息（使用 flash）。
 *     responses:
 *       200:
 *         description: 成功載入首頁
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       302:
 *         description: 若需要登入或權限錯誤，可重導向至其他頁面（如登入頁）
 */

router.get('/', (req, res) => {
  res.render('index', {
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
});
module.exports = router;
