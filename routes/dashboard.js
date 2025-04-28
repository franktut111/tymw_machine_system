const express = require('express');
const router = express.Router();
const pool = require('../db');
const ensureAuthenticated = require('../middleware/auth');

//redirect(重新導向)
//res用來回傳資料給前端
//req 是 request（請求）的縮寫，是 前端送來的請求資訊。
//當使用者對你的網站發出請求（例如進入一個網址、提交表單），Express 就會把相關的資料裝進 req 裡。
//async:讓函式變成非同步函式,才可以使用await  await:用來等待一個結果,等它完成後再繼續執行下面的程式碼
//try是希望成功的邏輯,catch是失敗後該如何處理
router.get('/', (req, res) => {
  res.redirect('/dashboard/list');
});
//顯示設備清單
// 顯示設備清單（從 mach_list_view 讀取）
router.get('/list', async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT m_id, m_name, m_status, m_desc FROM mach_list_view ORDER BY m_id');
    res.render('machine_list', { machines: rows });
  } catch (err) {
    console.error('查詢 mach_list_view 失敗:', err);
    req.flash('error_msg', '無法載入設備清單');
    res.redirect('/dashboard');
  }
});






// 顯示新增紀錄表單
// 顯示新增紀錄表單
router.get('/reports/add', ensureAuthenticated, (req, res) => {
  res.render('add_report', {
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
});


// 寫入紀錄資料
router.post('/reports/add', ensureAuthenticated, async (req, res) => {
  const { m_id, log_type, log_desc } = req.body;
  const log_sign = req.session.user.cn;

  try {
    // 先確認設備是否存在
    const [checkResult] = await pool.execute('SELECT * FROM mach_list WHERE m_id = ?', [m_id]);

    if (checkResult.length === 0) {
      req.flash('error_msg', `找不到設備編號：${m_id}`);
      return res.redirect('/dashboard/reports/add');
    }

    // 設備存在才繼續新增紀錄
    await pool.execute(
      'INSERT INTO mach_tlb (m_id, log_sign, log_type, log_desc, log_time) VALUES (?, ?, ?, ?, NOW())',
      [m_id, log_sign, log_type, log_desc]
    );

    req.flash('success_msg', '紀錄新增成功！');
    res.redirect('/dashboard/maintenance');
  } catch (err) {
    console.error('新增紀錄失敗:', err);
    req.flash('error_msg', '紀錄新增失敗');
    res.redirect('/dashboard/reports/add');
  }
});






// 設備保養紀錄
// 顯示設備保養紀錄
// 在 routes/dashboard.js 中的 /maintenance 路由中更新查詢
// 顯示設備保養紀錄（只顯示有 log_type 的）
router.get('/maintenance', ensureAuthenticated, async (req, res) => {
  try {
    // 查詢 mach_tlb_view 資料，只抓 log_type 有東西的
    const [rows] = await pool.execute(`
      SELECT * FROM mach_tlb_view 
      WHERE log_type IS NOT NULL 
      ORDER BY log_time DESC
    `);
    
    res.render('machine_reports', { reports: rows });
  } catch (err) {
    console.error('查詢 mach_tlb_view 失敗:', err);
    req.flash('error_msg', '無法載入設備保養紀錄');
    res.redirect('/dashboard');
  }
});







// 顯示設備狀態更新表單
router.get('/status', ensureAuthenticated, async (req, res) => {
  try {
    const [machines] = await pool.execute('SELECT m_id, m_name FROM mach_list ORDER BY m_id');
    res.render('machine_status', { machines });
  } catch (err) {
    console.error('無法載入設備:', err);
    req.flash('error_msg', '無法載入設備列表');
    res.redirect('/dashboard');
  }
});

// 提交設備狀態更新
router.post('/status', ensureAuthenticated, async (req, res) => {
  const { m_id, m_status } = req.body;
  const log_sign = req.session.user.cn;

  try {
    await pool.execute(
      'INSERT INTO mach_tlb (m_id, m_status, log_sign, log_time) VALUES (?, ?, ?, NOW())',
      [m_id, m_status, log_sign]
    );
    req.flash('success_msg', '設備狀態更新成功！');
    res.redirect('/dashboard/status');
  } catch (err) {
    console.error('寫入設備狀態失敗:', err);
    req.flash('error_msg', '設備狀態更新失敗');
    res.redirect('/dashboard/status');
  }
});






// 新增設備
// 檢查 m_id 是否已存在
router.get('/add', ensureAuthenticated, (req, res) => {
  res.render('add_machine', {
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
});

router.get('/check-mid/:m_id', ensureAuthenticated, async (req, res) => {
  const m_id = req.params.m_id;

  try {
    const [rows] = await pool.execute('SELECT m_id FROM mach_list WHERE m_id = ?', [m_id]);
    if (rows.length > 0) {
      return res.json({ exists: true });
    } else {
      return res.json({ exists: false });
    }
  } catch (err) {
    console.error('檢查設備編號失敗:', err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

router.post('/add', ensureAuthenticated, async (req, res) => {
  const { m_id, m_name, m_desc, m_status } = req.body;
  const log_sign = req.session.user.cn;

  try {
    // 檢查是否已有相同設備編號
    const [existing] = await pool.execute('SELECT * FROM mach_list WHERE m_id = ?', [m_id]);

    if (existing.length > 0) {
      req.flash('error_msg', '設備編號已存在，請重新輸入');
      return res.redirect('/dashboard/add');
    }

    // 寫入 mach_list 基本資料
    await pool.execute(
      'INSERT INTO mach_list (m_id, m_name, m_desc) VALUES (?, ?, ?)',
      [m_id, m_name, m_desc]
    );

    // 僅將狀態寫入 mach_tlb，不再寫入 log_type
    await pool.execute(
      `INSERT INTO mach_tlb (m_id, m_status, log_sign, log_desc, log_time)
       VALUES (?, ?, ?, ?, NOW())`,
      [m_id, m_status, log_sign, '']
    );
    
    
    req.flash('success_msg', '設備新增成功！');
    res.redirect('/dashboard/list');
  } catch (err) {
    console.error('新增設備失敗:', err);
    req.flash('error_msg', '新增設備時發生錯誤');
    res.redirect('/dashboard/add');
  }
});

// 顯示修改設備表單
router.get('/edit/:m_id', ensureAuthenticated, async (req, res) => {
  const m_id = req.params.m_id;

  try {
    const [rows] = await pool.execute('SELECT * FROM mach_list WHERE m_id = ?', [m_id]);

    if (rows.length === 0) {
      req.flash('error_msg', '找不到該設備');
      return res.redirect('/dashboard/list');
    }

    res.render('edit_machine', {
      machine: rows[0],
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('載入設備資料失敗:', err);
    req.flash('error_msg', '無法載入設備資料');
    res.redirect('/dashboard/list');
  }
});

// 提交修改設備資料
router.post('/edit/:m_id', ensureAuthenticated, async (req, res) => {
  const m_id = req.params.m_id;
  const { m_name, m_desc } = req.body;

  try {
    const [result] = await pool.execute(
      'UPDATE mach_list SET m_name = ?, m_desc = ? WHERE m_id = ?',
      [m_name, m_desc, m_id]
    );

    if (result.affectedRows === 0) {
      req.flash('error_msg', '更新失敗，設備不存在');
      return res.redirect('/dashboard/list');
    }

    req.flash('success_msg', '設備資料更新成功！');
    res.redirect('/dashboard/list');
  } catch (err) {
    console.error('更新設備失敗:', err);
    req.flash('error_msg', '更新設備資料時發生錯誤');
    res.redirect('/dashboard/list');
  }
});




module.exports = router;

