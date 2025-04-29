require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const ensureAuthenticated = require('./middleware/auth');
const app = express();


// 設定視圖引擎 20250429
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');

// 靜態資源與解析 body
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// session 與 flash 訊息
app.use(session({
  secret: process.env.SESSION_SECRET || 'defaultSecret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 6000*60*60 } // 設定 session 時效
}));


app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user; // 如果你有登入系統
  next();
});


// ping 用於刷新 session（避免閒置過期）
app.get('/ping', (req, res) => {
  if (req.session) {
    req.session._garbage = Date();
    req.session.touch();
  }
  res.sendStatus(200);
});


// 確保 user 資料在每個請求中都可用
app.use((req, res, next) => {
  res.locals.user = req.user || null;  // 如果有用戶，設置 user；否則設為 null
  next();
});
// 載入路由
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const machineRoutes = require('./routes/dashboard');
// 未登入可存取
app.use('/', authRoutes);

// 需登入可存取
app.use('/', ensureAuthenticated, indexRoutes);
app.use('/dashboard', ensureAuthenticated,machineRoutes );

app.listen(5002, () => {
  console.log('✅ Server running at frank.tsungyin.tw:5002');
});
