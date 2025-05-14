const express = require('express');
const router = express.Router();
const pool = require('../db');
const ensureAuthenticated = require('../middleware/auth');

// Redirect 根目錄到 /dashboard/list
router.get('/', (req, res) => {
  res.redirect('/dashboard/list');
});

// ────────────── 顯示設備清單 ──────────────
router.get('/list', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT m_id, m_name, m_status, m_desc, m_pos,dep_name FROM mach_list_view ORDER BY m_id'
    );
    res.render('machine_list', { machines: rows });
  } catch (err) {
    console.error('查詢 mach_list_view 失敗:', err);
    req.flash('error_msg', '無法載入設備清單');
    res.redirect('/dashboard');
  }
});

// ────────────── 顯示新增紀錄表單 ──────────────
router.get('/reports/add', ensureAuthenticated, (req, res) => {
  res.render('add_report', {
    success_msg: req.flash('success_msg'),
    error_msg: req.flash('error_msg')
  });
});

// ────────────── 寫入紀錄資料 ──────────────
router.post('/reports/add', ensureAuthenticated, async (req, res) => {
  const logFlagMap = {
    1: '加潤滑油',
    2: '機械清潔',
    4: '指示燈',
    8: '電路正常',
    16: '油壓正常',
    32: '噪音正常',
    64: '床抬間隙',
    128: '螺桿間隙',
    256: '軸承間隙'
  };

  const { m_id, log_type, log_desc, log_flags } = req.body;
  const log_sign = req.session.user.cn;

  try {
    const [checkResult] = await pool.execute('SELECT * FROM mach_list WHERE m_id = ?', [m_id]);
    if (checkResult.length === 0) {
      req.flash('error_msg', `找不到設備編號：${m_id}`);
      return res.redirect('/dashboard/reports/add');
    }

    let selectedFlags = Array.isArray(log_flags)
      ? log_flags.map(flag => logFlagMap[parseInt(flag)]).filter(Boolean)
      : [];

    const combinedDesc = selectedFlags.length > 0
      ? `檢查項目：${selectedFlags.join('、')}\n${log_desc}`
      : log_desc;

    await pool.execute(
      'INSERT INTO mach_tlb (m_id, log_sign, log_type, log_desc, log_time) VALUES (?, ?, ?, ?, NOW())',
      [m_id, log_sign, log_type, combinedDesc]
    );

    req.flash('success_msg', '紀錄新增成功！');
    res.redirect('/dashboard/maintenance');
  } catch (err) {
    console.error('新增紀錄失敗:', err);
    req.flash('error_msg', '紀錄新增失敗');
    res.redirect('/dashboard/reports/add');
  }
});

// ────────────── 顯示保養紀錄 ──────────────
router.get('/maintenance', ensureAuthenticated, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM mach_tlb_view ORDER BY log_time DESC');
    const filteredReports = rows.filter(report => report.log_type !== null);
    res.render('machine_reports', { reports: filteredReports });
  } catch (err) {
    console.error('查詢 mach_tlb_view 失敗:', err);
    req.flash('error_msg', '無法載入設備保養紀錄');
    res.redirect('/dashboard');
  }
});

// ────────────── 顯示狀態更新表單 ──────────────
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

// ────────────── 提交狀態更新 ──────────────
router.post('/status', ensureAuthenticated, async (req, res) => {
  const { m_id, m_status, m_pos } = req.body;
  const log_sign = req.session.user.cn;

  try {
    await pool.execute(
      'INSERT INTO mach_tlb (m_id, m_status, log_sign, log_time, m_pos) VALUES (?, ?, ?, NOW(), ?)',
      [m_id, m_status, log_sign, m_pos]
    );
    req.flash('success_msg', '設備狀態更新成功！');
    res.redirect('/dashboard/status');
  } catch (err) {
    console.error('寫入設備狀態失敗:', err);
    req.flash('error_msg', '設備狀態更新失敗');
    res.redirect('/dashboard/status');
  }
});

// ────────────── 顯示新增設備表單 ──────────────
router.get('/add', ensureAuthenticated, async (req, res) => {
  try {
    const [departments] = await pool.execute('SELECT dep_id, dep_name FROM department ORDER BY dep_id');
    res.render('add_machine', {
      departments,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('載入部門資料失敗:', err);
    req.flash('error_msg', '無法載入部門資料');
    res.redirect('/dashboard');
  }
});

// POST 新增設備
router.post('/add', ensureAuthenticated, async (req, res) => {
  const { m_id, m_name, m_desc, m_status, m_pos, m_dep } = req.body;
  const log_sign = req.session.user.cn;

  try {
    const [existing] = await pool.execute('SELECT m_id FROM mach_list WHERE m_id = ?', [m_id]);
    if (existing.length > 0) {
      req.flash('error_msg', '設備編號已存在，請重新輸入');
      return res.redirect('/dashboard/add');
    }

    await pool.execute(
      'INSERT INTO mach_list (m_id, m_name, m_desc, m_dep) VALUES (?, ?, ?, ?)',
      [m_id, m_name, m_desc, m_dep]
    );

    await pool.execute(
      'INSERT INTO mach_tlb (m_id, m_status, log_sign, m_pos, log_desc, log_time) VALUES (?, ?, ?, ?, ?, NOW())',
      [m_id, m_status, log_sign, m_pos, '']
    );

    req.flash('success_msg', '設備新增成功！');
    res.redirect('/dashboard/list');
  } catch (err) {
    console.error('新增設備失敗:', err);
    req.flash('error_msg', '新增設備時發生錯誤');
    res.redirect('/dashboard/add');
  }
});

// AJAX: 檢查設備編號是否存在
router.get('/check-mid/:m_id', ensureAuthenticated, async (req, res) => {
  const { m_id } = req.params;
  try {
    const [rows] = await pool.execute('SELECT m_id FROM mach_list WHERE m_id = ?', [m_id]);
    res.json({ exists: rows.length > 0 });
  } catch (err) {
    console.error('檢查設備編號錯誤:', err);
    res.status(500).json({ error: '伺服器錯誤' });
  }
});

// ────────────── 顯示設備編輯表單 ──────────────
// routes/dashboard.js
router.get('/edit/:m_id', ensureAuthenticated, async (req, res) => {
  const m_id = req.params.m_id;
  try {
    const [machineRows] = await pool.execute('SELECT * FROM mach_list WHERE m_id = ?', [m_id]);
    if (machineRows.length === 0) {
      req.flash('error_msg', '找不到該設備');
      return res.redirect('/dashboard/list');
    }

    const [departments] = await pool.execute('SELECT dep_id, dep_name FROM department ORDER BY dep_id');

    res.render('edit_machine', {
      machine: machineRows[0],
      departments,
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('載入設備資料失敗:', err);
    req.flash('error_msg', '無法載入設備資料');
    res.redirect('/dashboard/list');
  }
});



// ────────────── 提交編輯設備 ──────────────
router.post('/edit/:m_id', ensureAuthenticated, async (req, res) => {
  const m_id = req.params.m_id;
  const { m_name, m_desc,m_dep } = req.body;

  try {
    const [result] = await pool.execute(
      'UPDATE mach_list SET m_name = ?, m_desc = ?, m_dep = ? WHERE m_id = ?',
      [m_name, m_desc, m_dep, m_id]
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
