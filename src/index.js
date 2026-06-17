import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwt, sign, verify } from 'hono/jwt';
import bcrypt from 'bcryptjs';

const app = new Hono();

const JWT_SECRET = 'your_j…_key';

// 允许跨域
app.use('/api/*', cors());

// JWT 验证中间件
const authMiddleware = async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: '未授权' }, 401);
  }
  const token = authHeader.slice(7);
  try {
    const payload = await verify(token, JWT_SECRET,'HS256');
    c.set('jwtPayload', payload);
    await next();
  } catch (e) {
    //return c.json({ error: '无效token' }, 401);
    return c.json({ error: `【Token诊断】验证失败原因: ${e.message}`, token_val: token }, 401);
  }
};

// 获取上海时间
function getShanghaiTime() {
  const date = new Date();
  const shanghaiTime = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Shanghai" }));
  const year = shanghaiTime.getFullYear();
  const month = String(shanghaiTime.getMonth() + 1).padStart(2, '0');
  const day = String(shanghaiTime.getDate()).padStart(2, '0');
  const hours = String(shanghaiTime.getHours()).padStart(2, '0');
  const minutes = String(shanghaiTime.getMinutes()).padStart(2, '0');
  const seconds = String(shanghaiTime.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// ---------------- TEMP FIX PWD ----------------
app.get('/api/fix-pwd', async (c) => {
  try {
    // 1. 让服务器当场生成 123456 的正确加密哈希
    const realHash = bcrypt.hashSync('123456', 10);
    
    // 2. 强行将正确的密文更新到 admin 账号里
    await c.env.DB.prepare('UPDATE users SET password = ? WHERE username = ?')
      .bind(realHash, 'admin')
      .run();
      
    // 3. 返回成功提示
    return c.json({ 
      success: true, 
      message: '真相大白！密码已强制修正为 123456', 
      realHash: realHash 
    });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});
// ---------------- USER AUTH (诊断透视版) ----------------
app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json();
  try {
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first();

    // 诊断点 1：到底是不是没查到用户？
    if (!user) {
      return c.json({ 
        error: `【诊断A】查无此人！传入的账号是:[${username}]，请检查是否有空格` 
      }, 401);
    }

    const isValid = bcrypt.compareSync(String(password), String(user.password));
    
    // 诊断点 2：到底是不是哈希比对失败？
    if (!isValid) {
      return c.json({ 
        error: '【诊断B】比对失败！请按F12看Network载荷', 
        debug_info: {
          input_pwd: password,
          db_hash: user.password
        }
      }, 401);
    }

    const lastLoginTime = user.last_login_time;
    const lastLoginIp = user.last_login_ip;

    // 获取时间（如果原作者这里有缺漏，也会暴露出来）
    const now = typeof getShanghaiTime === 'function' ? getShanghaiTime() : new Date().toISOString();
    const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';

    await c.env.DB.prepare('UPDATE users SET last_login_time = ?, last_login_ip = ? WHERE id = ?')
      .bind(now, ip, user.id)
      .run();

    const payload = {
      id: user.id,
      username: user.username,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 2 // 2h
    };
    const token = await sign(payload, JWT_SECRET,'HS256');

    return c.json({ token, lastLoginTime, lastLoginIp });
  } catch (err) {
    // 诊断点 3：万一是代码报错了，强制抛出真实报错信息！
    return c.json({ error: `【诊断C代码崩溃】${err.message}` }, 500);
  }
});
/*
// ---------------- USER AUTH ----------------
app.post('/api/login', async (c) => {
  const { username, password } = await c.req.json();
  try {
    const user = await c.env.DB.prepare('SELECT * FROM users WHERE username = ?')
      .bind(username)
      .first();

    if (!user) {
      return c.json({ error: '用户名或密码错误' }, 401);
    }

    const isValid = bcrypt.compareSync(password, user.password);
    if (!isValid) {
      return c.json({ error: '用户名或密码错误' }, 401);
    }

    const lastLoginTime = user.last_login_time;
    const lastLoginIp = user.last_login_ip;

    const now = getShanghaiTime();
    const ip = c.req.header('CF-Connecting-IP') || '127.0.0.1';

    await c.env.DB.prepare('UPDATE users SET last_login_time = ?, last_login_ip = ? WHERE id = ?')
      .bind(now, ip, user.id)
      .run();

    const payload = {
      id: user.id,
      username: user.username,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 2 // 2h
    };
    const token = await sign(payload, JWT_SECRET);

    return c.json({ token, lastLoginTime, lastLoginIp });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});
*/
// ---------------- MENUS ----------------
app.get('/api/menus', async (c) => {
  const { page, pageSize } = c.req.query();
  try {
    if (!page && !pageSize) {
      // 获取主菜单
      const { results: menus } = await c.env.DB.prepare('SELECT * FROM menus ORDER BY "order"').all();
      
      // 并发查询子菜单
      const menusWithSub = await Promise.all(menus.map(async (menu) => {
        const { results: subMenus } = await c.env.DB.prepare('SELECT * FROM sub_menus WHERE parent_id = ? ORDER BY "order"')
          .bind(menu.id)
          .all();
        return { ...menu, subMenus };
      }));
      
      return c.json(menusWithSub);
    } else {
      const pageNum = parseInt(page) || 1;
      const size = parseInt(pageSize) || 10;
      const offset = (pageNum - 1) * size;

      const totalRow = await c.env.DB.prepare('SELECT COUNT(*) as total FROM menus').first();
      const { results: menus } = await c.env.DB.prepare('SELECT * FROM menus ORDER BY "order" LIMIT ? OFFSET ?')
        .bind(size, offset)
        .all();

      return c.json({
        total: totalRow.total,
        page: pageNum,
        pageSize: size,
        data: menus
      });
    }
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.get('/api/menus/:id/submenus', async (c) => {
  const id = c.req.param('id');
  try {
    const { results } = await c.env.DB.prepare('SELECT * FROM sub_menus WHERE parent_id = ? ORDER BY "order"')
      .bind(id)
      .all();
    return c.json(results);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/menus', authMiddleware, async (c) => {
  const { name, order } = await c.req.json();
  try {
    const info = await c.env.DB.prepare('INSERT INTO menus (name, "order") VALUES (?, ?)')
      .bind(name, order || 0)
      .run();
    return c.json({ id: info.meta.last_row_id });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.put('/api/menus/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { name, order } = await c.req.json();
  try {
    const info = await c.env.DB.prepare('UPDATE menus SET name = ?, "order" = ? WHERE id = ?')
      .bind(name, order || 0, id)
      .run();
    return c.json({ changed: info.meta.changes });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/menus/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  try {
    const info = await c.env.DB.prepare('DELETE FROM menus WHERE id = ?')
      .bind(id)
      .run();
    return c.json({ deleted: info.meta.changes });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ---------------- SUBMENUS ----------------
app.post('/api/menus/:id/submenus', authMiddleware, async (c) => {
  const parentId = c.req.param('id');
  const { name, order } = await c.req.json();
  try {
    const info = await c.env.DB.prepare('INSERT INTO sub_menus (parent_id, name, "order") VALUES (?, ?, ?)')
      .bind(parentId, name, order || 0)
      .run();
    return c.json({ id: info.meta.last_row_id });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.put('/api/menus/submenus/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { name, order } = await c.req.json();
  try {
    const info = await c.env.DB.prepare('UPDATE sub_menus SET name = ?, "order" = ? WHERE id = ?')
      .bind(name, order || 0, id)
      .run();
    return c.json({ changed: info.meta.changes });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/menus/submenus/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  try {
    const info = await c.env.DB.prepare('DELETE FROM sub_menus WHERE id = ?')
      .bind(id)
      .run();
    return c.json({ deleted: info.meta.changes });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ---------------- CARDS ----------------
app.get('/api/cards/:menuId', async (c) => {
  const menuId = c.req.param('menuId');
  const subMenuId = c.req.query('subMenuId');
  try {
    let results;
    if (subMenuId) {
      const q = await c.env.DB.prepare('SELECT * FROM cards WHERE sub_menu_id = ? ORDER BY "order"').bind(subMenuId).all();
      results = q.results;
    } else {
      const q = await c.env.DB.prepare('SELECT * FROM cards WHERE menu_id = ? AND sub_menu_id IS NULL ORDER BY "order"').bind(menuId).all();
      results = q.results;
    }
    
    results.forEach(card => {
      if (!card.custom_logo_path) {
        card.display_logo = card.logo_url || (card.url.replace(/\/+$/, '') + '/favicon.ico');
      } else {
        card.display_logo = card.custom_logo_path;
      }
    });
    return c.json(results);
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/cards', authMiddleware, async (c) => {
  const { menu_id, sub_menu_id, title, url, logo_url, custom_logo_path, desc, order } = await c.req.json();
  try {
    const info = await c.env.DB.prepare('INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, custom_logo_path, desc, "order") VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(menu_id, sub_menu_id || null, title, url, logo_url || '', custom_logo_path || '', desc || '', order || 0)
      .run();
    return c.json({ id: info.meta.last_row_id });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.put('/api/cards/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { menu_id, sub_menu_id, title, url, logo_url, custom_logo_path, desc, order } = await c.req.json();
  try {
    const info = await c.env.DB.prepare('UPDATE cards SET menu_id=?, sub_menu_id=?, title=?, url=?, logo_url=?, custom_logo_path=?, desc=?, "order"=? WHERE id=?')
      .bind(menu_id, sub_menu_id || null, title, url, logo_url || '', custom_logo_path || '', desc || '', order || 0, id)
      .run();
    return c.json({ changed: info.meta.changes });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/cards/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  try {
    const info = await c.env.DB.prepare('DELETE FROM cards WHERE id = ?').bind(id).run();
    return c.json({ deleted: info.meta.changes });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ---------------- UPLOAD (转为 Base64) ----------------
app.post('/api/upload', authMiddleware, async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body['logo'];
    if (!file || typeof file === 'string') {
      return c.json({ error: 'No file uploaded' }, 400);
    }
    const buffer = await file.arrayBuffer();
    const base64 = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );
    const mimeType = file.type || 'image/png';
    const dataUri = `data:${mimeType};base64,${base64}`;
    
    return c.json({ filename: file.name, url: dataUri });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ---------------- ADS ----------------
app.get('/api/ads', async (c) => {
  const { page, pageSize } = c.req.query();
  try {
    if (!page && !pageSize) {
      const { results } = await c.env.DB.prepare('SELECT * FROM ads').all();
      return c.json(results);
    } else {
      const pageNum = parseInt(page) || 1;
      const size = parseInt(pageSize) || 10;
      const offset = (pageNum - 1) * size;
      const totalRow = await c.env.DB.prepare('SELECT COUNT(*) as total FROM ads').first();
      const { results } = await c.env.DB.prepare('SELECT * FROM ads LIMIT ? OFFSET ?').bind(size, offset).all();
      return c.json({
        total: totalRow.total,
        page: pageNum,
        pageSize: size,
        data: results
      });
    }
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/ads', authMiddleware, async (c) => {
  const { position, img, url } = await c.req.json();
  try {
    const info = await c.env.DB.prepare('INSERT INTO ads (position, img, url) VALUES (?, ?, ?)')
      .bind(position, img, url)
      .run();
    return c.json({ id: info.meta.last_row_id });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.put('/api/ads/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { img, url } = await c.req.json();
  try {
    const info = await c.env.DB.prepare('UPDATE ads SET img = ?, url = ? WHERE id = ?')
      .bind(img, url, id)
      .run();
    return c.json({ changed: info.meta.changes });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/ads/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  try {
    const info = await c.env.DB.prepare('DELETE FROM ads WHERE id = ?').bind(id).run();
    return c.json({ deleted: info.meta.changes });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ---------------- FRIENDS ----------------
app.get('/api/friends', async (c) => {
  const { page, pageSize } = c.req.query();
  try {
    if (!page && !pageSize) {
      const { results } = await c.env.DB.prepare('SELECT * FROM friends').all();
      return c.json(results);
    } else {
      const pageNum = parseInt(page) || 1;
      const size = parseInt(pageSize) || 10;
      const offset = (pageNum - 1) * size;
      const totalRow = await c.env.DB.prepare('SELECT COUNT(*) as total FROM friends').first();
      const { results } = await c.env.DB.prepare('SELECT * FROM friends LIMIT ? OFFSET ?').bind(size, offset).all();
      return c.json({
        total: totalRow.total,
        page: pageNum,
        pageSize: size,
        data: results
      });
    }
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.post('/api/friends', authMiddleware, async (c) => {
  const { title, url, logo } = await c.req.json();
  try {
    const info = await c.env.DB.prepare('INSERT INTO friends (title, url, logo) VALUES (?, ?, ?)')
      .bind(title, url, logo)
      .run();
    return c.json({ id: info.meta.last_row_id });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.put('/api/friends/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  const { title, url, logo } = await c.req.json();
  try {
    const info = await c.env.DB.prepare('UPDATE friends SET title = ?, url = ?, logo = ? WHERE id = ?')
      .bind(title, url, logo, id)
      .run();
    return c.json({ changed: info.meta.changes });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

app.delete('/api/friends/:id', authMiddleware, async (c) => {
  const id = c.req.param('id');
  try {
    const info = await c.env.DB.prepare('DELETE FROM friends WHERE id = ?').bind(id).run();
    return c.json({ deleted: info.meta.changes });
  } catch (err) {
    return c.json({ error: err.message }, 500);
  }
});

// ---------------- USERS (PROFILE & PASSWORD) ----------------
app.get('/api/users/profile', authMiddleware, async (c) => {
  const userPayload = c.get('jwtPayload');
  try {
    const user = await c.env.DB.prepare('SELECT id, username FROM users WHERE id = ?')
      .bind(userPayload.id)
      .first();
    if (!user) {
      return c.json({ message: '用户不存在' }, 404);
    }
    return c.json({ data: user });
  } catch (err) {
    return c.json({ message: '服务器错误' }, 500);
  }
});

app.get('/api/users/me', authMiddleware, async (c) => {
  const userPayload = c.get('jwtPayload');
  try {
    const user = await c.env.DB.prepare('SELECT id, username, last_login_time, last_login_ip FROM users WHERE id = ?')
      .bind(userPayload.id)
      .first();
    if (!user) {
      return c.json({ message: '用户不存在' }, 404);
    }
    return c.json({
      last_login_time: user.last_login_time,
      last_login_ip: user.last_login_ip
    });
  } catch (err) {
    return c.json({ message: '服务器错误' }, 500);
  }
});

app.put('/api/users/password', authMiddleware, async (c) => {
  const userPayload = c.get('jwtPayload');
  const { oldPassword, newPassword } = await c.req.json();

  if (!oldPassword || !newPassword) {
    return c.json({ message: '请提供旧密码和新密码' }, 400);
  }

  if (newPassword.length < 6) {
    return c.json({ message: '新密码长度至少6位' }, 400);
  }

  try {
    const user = await c.env.DB.prepare('SELECT password FROM users WHERE id = ?')
      .bind(userPayload.id)
      .first();
    if (!user) {
      return c.json({ message: '用户不存在' }, 404);
    }

    const isValid = bcrypt.compareSync(oldPassword, user.password);
    if (!isValid) {
      return c.json({ message: '旧密码错误' }, 400);
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    await c.env.DB.prepare('UPDATE users SET password = ? WHERE id = ?')
      .bind(newHash, userPayload.id)
      .run();

    return c.json({ message: '密码修改成功' });
  } catch (err) {
    return c.json({ message: '服务器错误' }, 500);
  }
});

app.get('/api/users', authMiddleware, async (c) => {
  const { page, pageSize } = c.req.query();
  try {
    if (!page && !pageSize) {
      const { results } = await c.env.DB.prepare('SELECT id, username FROM users').all();
      return c.json({ data: results });
    } else {
      const pageNum = parseInt(page) || 1;
      const size = parseInt(pageSize) || 10;
      const offset = (pageNum - 1) * size;
      const totalRow = await c.env.DB.prepare('SELECT COUNT(*) as total FROM users').first();
      const { results } = await c.env.DB.prepare('SELECT id, username FROM users LIMIT ? OFFSET ?').bind(size, offset).all();
      return c.json({
        total: totalRow.total,
        page: pageNum,
        pageSize: size,
        data: results
      });
    }
  } catch (err) {
    return c.json({ message: '服务器错误' }, 500);
  }
});

// 移除了 app.all('*') 中导致 1042 fetch ASSETS 死锁的代码。
// 仅处理 API。静态文件直接交给 Cloudflare Workers Assets 机制在边缘完成智能无损托管。
// ---------------- SPA 路由兜底 ----------------
// 放在所有 API 路由的最下面！
app.get('*', async (c) => {
  // 1. 如果请求的不是后端的 /api 接口
  if (!c.req.path.startsWith('/api')) {
    // 2. 构建一个强行指向根目录 (/) 的请求
    const indexUrl = new URL(c.req.url);
    indexUrl.pathname = '/';
    // 3. 从 Cloudflare 的静态资源(ASSETS)中抓取 index.html 返回给用户
    return await c.env.ASSETS.fetch(new Request(indexUrl));
  }
  
  // 4. 如果真的是某个瞎写的 API 接口，返回标准的接口 404
  return c.json({ error: 'API Not Found' }, 404);
});

// 这个应该是你文件原本最后一行
export default app;
