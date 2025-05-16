const express = require('express');
const router = express.Router();
const { authenticate } = require('ldap-authentication');
adminPassword: process.env.LDAP_ADMIN_PASSWORD,
router.get('/login', (req, res) => {
  res.render('login'); // 顯示登入畫面
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  const options = {
    ldapOpts: {
      url: 'ldap://tek.tsungyin.tw',
    },
    adminDn: 'cn=admin,dc=tsungyin,dc=tw',
    adminPassword: process.env.LDAP_ADMIN_PASSWORD, // ⚠️ 建議改用 process.env.LDAP_ADMIN_PASSWORD
    userSearchBase: 'ou=People,dc=tsungyin,dc=tw',
    usernameAttribute: 'cn',
    username: username,
    userPassword: password,
    //查詢群組
    groupSearchBase: 'ou=Group,dc=tsungyin,dc=tw',
    groupClass:'groupOfNames',
    groupMemberAttribute: 'member',
  };
  

  try {
    const user = await authenticate(options);
     req.session.user = {
      cn: user.cn,
      dn: user.dn,
      groups: user.groups || [],
    };
    req.flash('success_msg', `歡迎 ${user.cn} 登入成功！`);
    res.redirect('/');
  } catch (err) {
    console.error('LDAP 驗證失敗:', err.message);
    req.flash('error_msg', '登入失敗：帳號或密碼錯誤');
    res.redirect('/login');
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
