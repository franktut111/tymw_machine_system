/**
 * @fileoverview Main entry point for the Express application.
 * Sets up middleware, session handling, routing, and starts the server.
 */
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const flash = require('connect-flash');
const session = require('express-session');
const expressLayouts = require('express-ejs-layouts');
const ensureAuthenticated = require('./middleware/auth');
const app = express();
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

// 設定視圖引擎 20250429
/**
 * Configure EJS view engine and layouts
 * @description Sets the view engine to EJS and uses layout templates
 */
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// 靜態資源與解析 body
/**
 * Configure static file serving and body parsing
 * @description Serve static assets from 'public' and parse URL-encoded bodies
 */
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));

// session 與 flash 訊息
/**
 * Setup session management and flash messages
 * @description Enables sessions and stores flash messages for temporary feedback
 */
app.use(session({
  secret: process.env.SESSION_SECRET || 'defaultSecret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60, // 1 小時
    sameSite: 'lax',        // important for local testing
    secure: false           // 若是 HTTP，請設 false；若是 HTTPS，請設 true
  } // 設定 session 時效
}));

/**
 * Flash message middleware
 * @description Makes flash messages and user info available in views
 */
app.use(flash());
app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.user = req.session.user; // 如果你有登入系統
  next();
});


// ping 用於刷新 session（避免閒置過期）
/**
 * Ping route to refresh session
 * @route GET /ping
 * @description Refreshes session to prevent expiration during idle
 */
app.get('/ping', (req, res) => {
  if (req.session) {
    req.session._garbage = Date();
    req.session.touch();
  }
  res.sendStatus(200);
});


// 確保 user 資料在每個請求中都可用
/**
 * Middleware to ensure user info is available in views
 */
app.use((req, res, next) => {
  res.locals.user = req.user || null;  // 如果有用戶，設置 user；否則設為 null
  next();
});
// 載入路由

/**
 * Import route modules
 */
const authRoutes = require('./routes/auth');
const indexRoutes = require('./routes/index');
const machineRoutes = require('./routes/dashboard');
// 未登入可存取
/**
 * Register public routes (accessible without login)
 */
app.use('/', authRoutes);

// 需登入可存取
/**
 * Register protected routes (requires authentication)
 */
app.use('/', ensureAuthenticated, indexRoutes);
app.use('/dashboard', ensureAuthenticated,machineRoutes );

/**
 * Start the Express server
 * @description Launches the application on port 5002
 */
app.listen(5002, () => {
  console.log('✅ Server running at frank.tsungyin.tw:5002');
});
