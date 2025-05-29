const express = require('express');
const router = express.Router();
const pool = require('../db');
const onlyChief = require('../middleware/role');
const QRCode = require('qrcode');

router.get('/', (req, res) => {
  res.redirect('/dashboard/list');
});

// ────────────── 顯示設備清單 ──────────────
/**
 * @swagger
 * /dashboard/list:
 *   get:
 *     tags:
 *      - 設備管理
 *     summary: 取得機台清單
 *     description: 取得所有機台的清單，包含 QR Code 資訊。
 *     responses:
 *       200:
 *         description: 成功取得機台清單
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   m_id:
 *                     type: string
 *                   m_name:
 *                     type: string
 *                   m_status:
 *                     type: string
 *                   m_desc:
 *                     type: string
 *                   m_pos:
 *                     type: string
 *                   dep_name:
 *                     type: string
 *                   qrCode:
 *                     type: string
 */
router.get('/list', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT m_id, m_name, m_status, m_desc, m_pos,dep_name FROM mach_list_view ORDER BY m_id'
    );
    // 為每台設備產生 QR Code 圖片（DataURL）
    for (const machine of rows) {
      const qrUrl = `http://frank.tsungyin.tw:5002/dashboard/reports/add?m_id=${machine.m_id}`;
      machine.qrCode = await QRCode.toDataURL(qrUrl);
    }
    res.render('machine_list', { machines: rows });
  } catch (err) {
    console.error('查詢 mach_list_view 失敗:', err);
    req.flash('error_msg', '無法載入設備清單');
    res.redirect('/dashboard');
  }
});

// ────────────── 顯示新增紀錄表單 ──────────────
/**
 * @swagger
 * /reports/add:
 *   get:
 *     tags:
 *      - 保養維修
 *     summary: 顯示新增報修單頁面
 *     description: 載入新增報修單的畫面，可從 URL 參數帶入設備編號（m_id）。
 *     parameters:
 *       - in: query
 *         name: m_id
 *         schema:
 *           type: string
 *         required: false
 *         description: 設備編號（可選）
 *     responses:
 *       200:
 *         description: 成功載入報修單新增頁面
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html>...</html>"
 */
router.get('/reports/add', async (req, res) => {
  const m_id = req.query.m_id || '';

  try {
    // 🔍 查詢所有設備
    const [machines] = await pool.execute('SELECT m_id, m_name FROM mach_list ORDER BY m_id');

    res.render('add_report', {
      m_id,
      machines, // ✅ 傳給 EJS 使用 datalist
      success_msg: req.flash('success_msg'),
      error_msg: req.flash('error_msg')
    });
  } catch (err) {
    console.error('載入新增報修頁面失敗:', err);
    req.flash('error_msg', '無法載入設備清單');
    res.redirect('/dashboard/list');
  }
});


// ────────────── 寫入紀錄資料 ──────────────
/**
 * @swagger
 * /reports/add:
 *   post:
 *     tags:
 *      - 保養維修
 *     summary: 新增保養/報修紀錄
 *     description: 提交保養或報修的表單資料，系統會驗證設備編號，並根據輸入項目產生詳細描述後寫入資料庫。
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               m_id:
 *                 type: string
 *                 description: 設備編號
 *               log_type:
 *                 type: string
 *                 description: 紀錄類型（如保養、報修）
 *               log_desc:
 *                 type: string
 *                 description: 額外說明描述
 *               log_flags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: 選取的保養項目代碼（例如：1、2、4 等，會與 flag_status_* 搭配）
 *               flag_status_1:
 *                 type: string
 *                 description: 加潤滑油的狀態（範例：正常、異常）
 *               flag_status_2:
 *                 type: string
 *                 description: 機械清潔的狀態
 *               flag_status_4:
 *                 type: string
 *                 description: 指示燈的狀態
 *               flag_status_8:
 *                 type: string
 *                 description: 電路的狀態
 *               flag_status_16:
 *                 type: string
 *                 description: 油壓的狀態
 *               flag_status_32:
 *                 type: string
 *                 description: 噪音的狀態
 *               flag_status_64:
 *                 type: string
 *                 description: 床台間隙的狀態
 *               flag_status_128:
 *                 type: string
 *                 description: 螺桿間隙的狀態
 *               flag_status_256:
 *                 type: string
 *                 description: 軸承間隙的狀態
 *     responses:
 *       302:
 *         description: 表單提交後將重新導向至對應頁面
 *       400:
 *         description: 請求參數錯誤或格式錯誤
 *       500:
 *         description: 伺服器內部錯誤或新增失敗
 */
router.post('/reports/add', async (req, res) => {
  const logFlagMap = {
    1: '加潤滑油',
    2: '機械清潔',
    4: '指示燈',
    8: '電路正常',
    16: '油壓正常',
    32: '噪音正常',
    64: '床台間隙',
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

    let combinedDesc = '';
    if (Array.isArray(log_flags)) {
      const statusLines = log_flags.map(flag => {
        const value = parseInt(flag);
        const itemName = logFlagMap[value] || `未知項目(${value})`;
        const status = req.body[`flag_status_${value}`] || '未填';
        return `${itemName}（${status}）`;
      });
      combinedDesc = statusLines.join('\n');
    }

    const fullDesc = [combinedDesc, '|', log_desc].filter(Boolean).join('\n');

    await pool.execute(
      'INSERT INTO mach_tlb (m_id, log_sign, log_type, log_desc, log_time) VALUES (?, ?, ?, ?, NOW())',
      [m_id, log_sign, log_type, fullDesc]
    );

    req.flash('success_msg', '保養紀錄新增成功！');
    res.redirect('/dashboard/maintenance');
  } catch (err) {
    console.error('新增紀錄失敗:', err);
    req.flash('error_msg', '紀錄新增失敗');
    res.redirect('/dashboard/reports/add');
  }
});


// ────────────── 顯示保養紀錄 ──────────────
/**
 * @swagger
 * /maintenance:
 *   get:
 *     tags:
 *      - 保養維修
 *     summary: 取得保養/報修紀錄列表
 *     description: 查詢 `mach_tlb_view` 資料視圖，回傳所有非空的保養或報修紀錄，依照紀錄時間排序。
 *     responses:
 *       200:
 *         description: 成功取得保養/報修紀錄頁面
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html>...</html>"
 *       302:
 *         description: 當查詢發生錯誤時重新導向至 /dashboard，並顯示錯誤訊息
 *       500:
 *         description: 查詢資料時發生伺服器內部錯誤
 */
router.get('/maintenance', async (req, res) => {
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
/**
 * @swagger
 * /status:
 *   get:
 *     tags:
 *      - 設備管理
 *     summary: 顯示設備狀態頁面（僅限主管）
 *     description: 僅主管（onlyChief 中介軟體驗證通過）可存取此頁面，系統將查詢 mach_list 並依設備編號排序後顯示清單。
 *     responses:
 *       200:
 *         description: 成功載入設備狀態頁面
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html>...</html>"
 *       302:
 *         description: 查詢錯誤時重新導向至 /dashboard，並顯示錯誤訊息
 *       403:
 *         description: 無權限存取（非主管身分）
 */
router.get('/status',onlyChief, async (req, res) => {
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
/**
 * @swagger
 * /status:
 *   post:
 *     tags:
 *      - 設備管理
 *     summary: 新增設備狀態紀錄（僅限主管）
 *     description: 僅主管（經 onlyChief 驗證）可提交設備狀態變更資料，資料將寫入 mach_tlb 表中。
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               m_id:
 *                 type: string
 *                 description: 設備編號
 *               m_status:
 *                 type: string
 *                 description: 設備狀態（例如：運轉中、停機中、維修中）
 *               m_pos:
 *                 type: string
 *                 description: 設備位置描述（例如:1廠)
 *     responses:
 *       302:
 *         description: 提交成功或失敗後，將重新導向至 /dashboard/status 並顯示 flash 訊息
 *       403:
 *         description: 無權限操作（非主管身份）
 *       500:
 *         description: 資料庫錯誤或內部伺服器錯誤
 */
router.post('/status', onlyChief, async (req, res) => {
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
/**
 * @swagger
 * /add:
 *   get:
 *     tags:
 *      - 設備管理
 *     summary: 顯示新增機台頁面（僅限主管）
 *     description: 僅主管（通過 onlyChief 驗證）可存取，頁面將載入所有部門資料供選擇。
 *     responses:
 *       200:
 *         description: 成功載入新增機台頁面
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html>...</html>"
 *       302:
 *         description: 當部門資料查詢失敗時，重新導向至 /dashboard 並顯示錯誤訊息
 *       403:
 *         description: 無權限存取（非主管身份）
 */
router.get('/add',onlyChief, async (req, res) => {
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
/**
 * @swagger
 * /add:
 *   post:
 *     tags:
 *      - 設備管理
 *     summary: 新增機台（僅限主管）
 *     description: 僅主管（通過 onlyChief 驗證）可提交新增機台表單，資料將同時寫入 mach_list 與 mach_tlb 資料表。
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               m_id:
 *                 type: string
 *                 description: 設備編號（需唯一）
 *               m_name:
 *                 type: string
 *                 description: 設備名稱
 *               m_desc:
 *                 type: string
 *                 description: 設備描述
 *               m_status:
 *                 type: string
 *                 description: 設備狀態（初始狀態，例如：正常、維修中）
 *               m_pos:
 *                 type: string
 *                 description: 設備位置
 *               m_dep:
 *                 type: string
 *                 description: 所屬部門代碼（dep_id）
 *     responses:
 *       302:
 *         description: 新增成功或失敗後，會重新導向至對應頁面，並顯示 flash 訊息
 *       400:
 *         description: 設備編號已存在或輸入格式有誤
 *       403:
 *         description: 無權限操作（非主管身份）
 *       500:
 *         description: 伺服器錯誤或資料庫寫入失敗
 */

router.post('/add',onlyChief, async (req, res) => {
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
/**
 * @swagger
 * /check-mid/{m_id}:
 *   get:
 *     tags:
 *      - 設備管理
 *     summary: 檢查設備編號是否已存在
 *     description: 根據路由參數中的 m_id，查詢 mach_list 資料表，回傳該設備編號是否已存在。
 *     parameters:
 *       - in: path
 *         name: m_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 欲檢查的設備編號
 *     responses:
 *       200:
 *         description: 查詢成功，回傳設備是否存在
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 exists:
 *                   type: boolean
 *                   description: 是否已存在該設備編號
 *               example:
 *                 exists: true
 *       500:
 *         description: 資料庫錯誤或伺服器發生問題
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: 伺服器錯誤
 */
router.get('/check-mid/:m_id', async (req, res) => {
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
/**
 * @swagger
 * /edit/{m_id}:
 *   get:
 *     tags:
 *      - 設備管理
 *     summary: 顯示編輯機台頁面（僅限主管）
 *     description: 僅主管（通過 onlyChief 中介層驗證）可存取此路由。根據設備編號查詢設備資料與部門清單，用於編輯畫面呈現。
 *     parameters:
 *       - in: path
 *         name: m_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 要編輯的設備編號
 *     responses:
 *       200:
 *         description: 成功載入編輯頁面，並顯示設備與部門資料
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               example: "<html>...</html>"
 *       302:
 *         description: 查無資料或發生錯誤時導向 /dashboard/list，並顯示錯誤訊息
 *       403:
 *         description: 無權限存取（非主管身分）
 *       500:
 *         description: 資料庫錯誤或伺服器內部錯誤
 */
router.get('/edit/:m_id',onlyChief, async (req, res) => {
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
/**
 * @swagger
 * /edit/{m_id}:
 *   post:
 *     tags:
 *      - 設備管理
 *     summary: 更新機台資料（僅限主管）
 *     description: 僅主管（通過 onlyChief 驗證）可編輯指定設備資料，根據設備編號更新名稱、描述與部門。
 *     parameters:
 *       - in: path
 *         name: m_id
 *         required: true
 *         schema:
 *           type: string
 *         description: 要更新的設備編號
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               m_name:
 *                 type: string
 *                 description: 新的設備名稱
 *               m_desc:
 *                 type: string
 *                 description: 新的設備描述
 *               m_dep:
 *                 type: string
 *                 description: 所屬部門代碼
 *     responses:
 *       302:
 *         description: 更新成功或失敗後，重新導向 /dashboard/list 並顯示 flash 訊息
 *       400:
 *         description: 更新失敗，設備不存在
 *       403:
 *         description: 無權限操作（非主管身分）
 *       500:
 *         description: 資料庫錯誤或伺服器發生錯誤
 */

router.post('/edit/:m_id',onlyChief, async (req, res) => {
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
