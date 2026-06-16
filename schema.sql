DROP TABLE IF EXISTS menus;
CREATE TABLE menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_menus_order ON menus("order");

DROP TABLE IF EXISTS sub_menus;
CREATE TABLE sub_menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  "order" INTEGER DEFAULT 0,
  FOREIGN KEY(parent_id) REFERENCES menus(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sub_menus_parent_id ON sub_menus(parent_id);
CREATE INDEX IF NOT EXISTS idx_sub_menus_order ON sub_menus("order");

DROP TABLE IF EXISTS cards;
CREATE TABLE cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  menu_id INTEGER,
  sub_menu_id INTEGER,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  logo_url TEXT,
  custom_logo_path TEXT, -- 在CF版本中我们可以直接存图片的Base64
  "desc" TEXT, --desc加""
  "order" INTEGER DEFAULT 0,
  FOREIGN KEY(menu_id) REFERENCES menus(id) ON DELETE CASCADE,
  FOREIGN KEY(sub_menu_id) REFERENCES sub_menus(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cards_menu_id ON cards(menu_id);
CREATE INDEX IF NOT EXISTS idx_cards_sub_menu_id ON cards(sub_menu_id);
CREATE INDEX IF NOT EXISTS idx_cards_order ON cards("order");

DROP TABLE IF EXISTS users;
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  last_login_time TEXT,
  last_login_ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

DROP TABLE IF EXISTS ads;
CREATE TABLE ads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  position TEXT NOT NULL,
  img TEXT NOT NULL,
  url TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ads_position ON ads(position);

DROP TABLE IF EXISTS friends;
CREATE TABLE friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  logo TEXT
);
CREATE INDEX IF NOT EXISTS idx_friends_title ON friends(title);

-- 插入默认数据
INSERT INTO menus (name, "order") VALUES ('Home', 1);
INSERT INTO menus (name, "order") VALUES ('Ai Stuff', 2);
INSERT INTO menus (name, "order") VALUES ('Cloud', 3);
INSERT INTO menus (name, "order") VALUES ('Software', 4);
INSERT INTO menus (name, "order") VALUES ('Tools', 5);
INSERT INTO menus (name, "order") VALUES ('Other', 6);

INSERT INTO sub_menus (parent_id, name, "order") VALUES (2, 'AI chat', 1);
INSERT INTO sub_menus (parent_id, name, "order") VALUES (2, 'AI tools', 2);
INSERT INTO sub_menus (parent_id, name, "order") VALUES (5, 'Dev Tools', 1);
INSERT INTO sub_menus (parent_id, name, "order") VALUES (4, 'Mac', 1);
INSERT INTO sub_menus (parent_id, name, "order") VALUES (4, 'iOS', 2);
INSERT INTO sub_menus (parent_id, name, "order") VALUES (4, 'Android', 3);
INSERT INTO sub_menus (parent_id, name, "order") VALUES (4, 'Windows', 4);

-- 默认卡片 (Home, ID 1)
INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, "desc", "order") VALUES (1, NULL, 'Baidu', 'https://www.baidu.com', '', '全球最大的中文搜索引擎', 1);
INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, "desc", "order") VALUES (1, NULL, 'Youtube', 'https://www.youtube.com', 'https://img.icons8.com/ios-filled/100/ff1d06/youtube-play.png', '全球最大的视频社区', 2);
INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, "desc", "order") VALUES (1, NULL, 'GitHub', 'https://github.com', '', '全球最大的代码托管平台', 3);
INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, "desc", "order") VALUES (1, NULL, 'Cloudflare', 'https://dash.cloudflare.com', '', '全球最大的cdn服务商', 4);

-- 默认卡片 (AI chat, ID 1)
INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, "desc", "order") VALUES (2, NULL, 'ChatGPT', 'https://chat.openai.com', 'https://cdn.oaistatic.com/assets/favicon-eex17e9e.ico', 'OpenAI官方AI对话', 1);
INSERT INTO cards (menu_id, sub_menu_id, title, url, logo_url, "desc", "order") VALUES (2, NULL, 'Deepseek', 'https://www.deepseek.com', 'https://cdn.deepseek.com/chat/icon.png', 'Deepseek AI搜索', 2);

-- 默认管理员账号密码：admin / 123456 (注意：密码哈希值通过 bcrypt 预计算写入)
-- $2a$10$Y145r/73j8D1lB1V/Z/Lle1yK8Uj27X.a7t65K2oG2PkWz.6Wp1Pq 是 123456 的 bcrypt 哈希值
INSERT INTO users (username, password) VALUES ('admin', '$2a$10$Y145r/73j8D1lB1V/Z/Lle1yK8Uj27X.a7t65K2oG2PkWz.6Wp1Pq');

-- 默认友链
INSERT INTO friends (title, url, logo) VALUES ('Noodseek图床', 'https://www.nodeimage.com', 'https://www.no""desc""ek.com/static/image/favicon/favicon-32x32.png');
INSERT INTO friends (title, url, logo) VALUES ('Font Awesome', 'https://fontawesome.com', 'https://fontawesome.com/favicon.ico');
