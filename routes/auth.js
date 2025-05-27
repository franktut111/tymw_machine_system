const ldap = require('ldapjs');
const { authenticate } = require('ldap-authentication');
const express = require('express');
const router = express.Router();

/**
 * @swagger
 * /login:
 *   get:
 *     tags:
 *       - 使用者登入
 *     summary: 顯示登入頁面
 *     description: 顯示使用者輸入帳號與密碼的登入畫面。
 *     responses:
 *       200:
 *         description: 成功載入登入畫面
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */

router.get('/login', (req, res) => {
  res.render('login'); // 顯示登入畫面
});

/**
 * @swagger
 * /login:
 *   post:
 *     tags:
 *       - 使用者登入
 *     summary: 使用 LDAP 驗證進行登入
 *     description: 使用者輸入帳號密碼後，透過 LDAP 驗證並建立 session，同時檢查是否為主管（chief 群組）。
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: 使用者帳號
 *               password:
 *                 type: string
 *                 description: 使用者密碼
 *     responses:
 *       302:
 *         description: 登入成功或失敗後導向頁面，並顯示 flash 訊息
 *       401:
 *         description: 認證失敗（帳號或密碼錯誤）
 *       500:
 *         description: LDAP 伺服器錯誤
 */

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const options = {
    ldapOpts: {
      url: 'ldap://tek.tsungyin.tw',
    },
    adminDn: 'cn=admin,dc=tsungyin,dc=tw',
    adminPassword: process.env.LDAP_ADMIN_PASSWORD,
    userSearchBase: 'ou=People,dc=tsungyin,dc=tw',
    usernameAttribute: 'cn',
    username: username,
    userPassword: password,
  };

  try {
    // 驗證帳密
    const user = await authenticate(options);//登入成功

    //取得uid
    const userUid = user.uid;
    const userCn = user.cn;

    // 建立 LDAP client 查詢是否為 chief 群組成員
    const client = ldap.createClient({ url: 'ldap://tek.tsungyin.tw' });

    await new Promise((resolve, reject) => {
      client.bind(options.adminDn, options.adminPassword, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const opts = {
      filter: `(&(objectClass=posixGroup)(gidNumber=20010)(memberUid=${userUid}))`,
      scope: 'sub',
      attributes: ['cn'],
    };

    const isChief = await new Promise((resolve, reject) => {
      client.search('ou=groups,dc=tsungyin,dc=tw', opts, (err, res) => {
        if (err) return reject(err);
        let found = false;
        res.on('searchEntry', () => {
          found = true;
        });
        res.on('end', () => resolve(found));
      });
    });

    client.unbind();

    // 將資訊寫入 session
    req.session.user = {
      cn: userCn,
      uid: userUid,
      dn: user.dn,
      isChief: isChief,
    };

    req.flash('success_msg', `歡迎 ${user.uid} 登入成功！`);
    console.log('登入成功使用者:', {
    cn: user.cn,
    isChief: isChief,
    });
    res.redirect('/');
  } catch (err) {
    console.error('LDAP 驗證失敗:', err.message);
    req.flash('error_msg', '登入失敗：帳號或密碼錯誤');
    res.redirect('/login');
  }
});

/**
 * @swagger
 * /logout:
 *   get:
 *     tags:
 *       - 使用者登入
 *     summary: 使用者登出
 *     description: 清除 session 並重新導向至登入頁面。
 *     responses:
 *       302:
 *         description: 登出成功，重新導向至 /login
 */

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
