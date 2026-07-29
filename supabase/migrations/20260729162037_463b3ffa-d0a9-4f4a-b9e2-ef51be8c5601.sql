-- ============ WORDS ============
CREATE TABLE public.words (
  id BIGSERIAL PRIMARY KEY,
  word TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  difficulty TEXT GENERATED ALWAYS AS (
    CASE WHEN char_length(word) <= 2 THEN '简单'
         WHEN char_length(word) = 3 THEN '中等'
         ELSE '困难' END
  ) STORED
);
GRANT SELECT ON public.words TO anon, authenticated;
GRANT ALL ON public.words TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.words_id_seq TO service_role;
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "words_public_read" ON public.words FOR SELECT TO anon, authenticated USING (true);

-- ============ ROOMS ============
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_id UUID,
  status TEXT NOT NULL DEFAULT 'waiting',
  total_rounds INT NOT NULL DEFAULT 3,
  draw_seconds INT NOT NULL DEFAULT 80,
  difficulty TEXT NOT NULL DEFAULT '全部',
  current_round INT NOT NULL DEFAULT 0,
  turn_index INT NOT NULL DEFAULT 0,
  drawer_id UUID,
  masked_word TEXT,
  word_length INT,
  revealed_word TEXT,
  round_started_at TIMESTAMPTZ,
  round_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rooms TO anon, authenticated;
GRANT ALL ON public.rooms TO service_role;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_public_read" ON public.rooms FOR SELECT TO anon, authenticated USING (true);

-- ============ ROOM SECRETS (server only) ============
CREATE TABLE public.room_secrets (
  room_id UUID NOT NULL PRIMARY KEY REFERENCES public.rooms(id) ON DELETE CASCADE,
  word TEXT,
  choices JSONB NOT NULL DEFAULT '[]'::jsonb,
  drawer_id UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.room_secrets TO service_role;
ALTER TABLE public.room_secrets ENABLE ROW LEVEL SECURITY;

-- ============ PLAYERS ============
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  score INT NOT NULL DEFAULT 0,
  round_score INT NOT NULL DEFAULT 0,
  has_guessed BOOLEAN NOT NULL DEFAULT false,
  is_host BOOLEAN NOT NULL DEFAULT false,
  avatar INT NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX players_room_idx ON public.players(room_id, joined_at);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_public_read" ON public.players FOR SELECT TO anon, authenticated USING (true);

-- ============ PLAYER TOKENS (server only) ============
CREATE TABLE public.player_tokens (
  player_id UUID NOT NULL PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  token TEXT NOT NULL
);
GRANT ALL ON public.player_tokens TO service_role;
ALTER TABLE public.player_tokens ENABLE ROW LEVEL SECURITY;

-- ============ GUESSES / CHAT ============
CREATE TABLE public.guesses (
  id BIGSERIAL PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round INT NOT NULL DEFAULT 0,
  player_id UUID,
  player_name TEXT,
  text TEXT,
  kind TEXT NOT NULL DEFAULT 'guess',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX guesses_room_idx ON public.guesses(room_id, id);
GRANT SELECT ON public.guesses TO anon, authenticated;
GRANT ALL ON public.guesses TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.guesses_id_seq TO service_role;
ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "guesses_public_read" ON public.guesses FOR SELECT TO anon, authenticated USING (true);

-- ============ STROKES ============
CREATE TABLE public.strokes (
  id BIGSERIAL PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round INT NOT NULL DEFAULT 0,
  turn_index INT NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX strokes_room_idx ON public.strokes(room_id, turn_index, id);
GRANT SELECT ON public.strokes TO anon, authenticated;
GRANT ALL ON public.strokes TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.strokes_id_seq TO service_role;
ALTER TABLE public.strokes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strokes_public_read" ON public.strokes FOR SELECT TO anon, authenticated USING (true);

-- ============ REALTIME ============
ALTER TABLE public.rooms REPLICA IDENTITY FULL;
ALTER TABLE public.players REPLICA IDENTITY FULL;
ALTER TABLE public.guesses REPLICA IDENTITY FULL;
ALTER TABLE public.strokes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guesses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.strokes;

-- ============ WORD LIBRARY SEED (300) ============
INSERT INTO public.words (word, category) VALUES
('熊猫','动物'),('老虎','动物'),('大象','动物'),('长颈鹿','动物'),('猴子','动物'),
('兔子','动物'),('乌龟','动物'),('企鹅','动物'),('鲨鱼','动物'),('蝴蝶','动物'),
('蜜蜂','动物'),('螃蟹','动物'),('孔雀','动物'),('骆驼','动物'),('刺猬','动物'),
('松鼠','动物'),('袋鼠','动物'),('海豚','动物'),('章鱼','动物'),('蜘蛛','动物'),
('青蛙','动物'),('鳄鱼','动物'),('狮子','动物'),('斑马','动物'),('猫头鹰','动物'),
('蝙蝠','动物'),('鲸鱼','动物'),('蜗牛','动物'),('蚂蚁','动物'),('公鸡','动物'),
('绵羊','动物'),('狐狸','动物'),('野狼','动物'),('鸭子','动物'),('鹦鹉','动物'),
('海星','动物'),('水母','动物'),('恐龙','动物'),('蜻蜓','动物'),('瓢虫','动物'),
('犀牛','动物'),('河马','动物'),('考拉','动物'),('树懒','动物'),('龙虾','动物'),
('金鱼','动物'),('蚯蚓','动物'),('天鹅','动物'),('火烈鸟','动物'),('壁虎','动物'),
('饺子','食物'),('包子','食物'),('火锅','食物'),('米饭','食物'),('面条','食物'),
('馒头','食物'),('汤圆','食物'),('粽子','食物'),('月饼','食物'),('烤鸭','食物'),
('麻辣烫','食物'),('炒饭','食物'),('春卷','食物'),('豆腐','食物'),('油条','食物'),
('豆浆','食物'),('珍珠奶茶','食物'),('冰淇淋','食物'),('蛋糕','食物'),('巧克力','食物'),
('汉堡','食物'),('披萨','食物'),('薯条','食物'),('三明治','食物'),('寿司','食物'),
('面包','食物'),('鸡蛋','食物'),('西瓜','食物'),('苹果','食物'),('香蕉','食物'),
('葡萄','食物'),('草莓','食物'),('菠萝','食物'),('芒果','食物'),('橘子','食物'),
('榴莲','食物'),('辣椒','食物'),('胡萝卜','食物'),('西红柿','食物'),('土豆','食物'),
('玉米','食物'),('蘑菇','食物'),('白菜','食物'),('黄瓜','食物'),('花生','食物'),
('爆米花','食物'),('棒棒糖','食物'),('蜂蜜','食物'),('咖啡','食物'),('糖葫芦','食物'),
('雨伞','物品'),('眼镜','物品'),('手机','物品'),('电脑','物品'),('钥匙','物品'),
('剪刀','物品'),('牙刷','物品'),('梳子','物品'),('闹钟','物品'),('书包','物品'),
('铅笔','物品'),('橡皮','物品'),('尺子','物品'),('相机','物品'),('吉他','物品'),
('钢琴','物品'),('鼓','物品'),('风筝','物品'),('气球','物品'),('灯笼','物品'),
('扇子','物品'),('筷子','物品'),('碗','物品'),('勺子','物品'),('炒锅','物品'),
('冰箱','物品'),('洗衣机','物品'),('电视','物品'),('沙发','物品'),('床','物品'),
('椅子','物品'),('桌子','物品'),('镜子','物品'),('枕头','物品'),('毛巾','物品'),
('帽子','物品'),('手套','物品'),('围巾','物品'),('袜子','物品'),('鞋子','物品'),
('裙子','物品'),('口罩','物品'),('戒指','物品'),('项链','物品'),('手表','物品'),
('钱包','物品'),('信封','物品'),('邮票','物品'),('地图','物品'),('望远镜','物品'),
('显微镜','物品'),('灭火器','物品'),('轮椅','物品'),('滑板','物品'),('自行车','物品'),
('跑步','动作'),('游泳','动作'),('睡觉','动作'),('唱歌','动作'),('跳舞','动作'),
('画画','动作'),('读书','动作'),('写字','动作'),('做饭','动作'),('洗澡','动作'),
('刷牙','动作'),('打喷嚏','动作'),('哭泣','动作'),('大笑','动作'),('拥抱','动作'),
('握手','动作'),('跳绳','动作'),('爬山','动作'),('钓鱼','动作'),('打篮球','动作'),
('踢足球','动作'),('打乒乓球','动作'),('滑雪','动作'),('冲浪','动作'),('骑马','动作'),
('举重','动作'),('拍照','动作'),('打电话','动作'),('购物','动作'),('排队','动作'),
('打针','动作'),('理发','动作'),('浇花','动作'),('扫地','动作'),('洗碗','动作'),
('搬家','动作'),('迟到','动作'),('加班','动作'),('堵车','动作'),('放风筝','动作'),
('打呼噜','动作'),('摔倒','动作'),('许愿','动作'),('吹蜡烛','动作'),('敲门','动作'),
('学校','地点'),('医院','地点'),('银行','地点'),('机场','地点'),('火车站','地点'),
('公园','地点'),('图书馆','地点'),('电影院','地点'),('超市','地点'),('动物园','地点'),
('游乐园','地点'),('博物馆','地点'),('餐厅','地点'),('咖啡馆','地点'),('理发店','地点'),
('加油站','地点'),('停车场','地点'),('大桥','地点'),('隧道','地点'),('灯塔','地点'),
('城堡','地点'),('长城','地点'),('故宫','地点'),('天安门','地点'),('兵马俑','地点'),
('铁塔','地点'),('金字塔','地点'),('教堂','地点'),('寺庙','地点'),('摩天大楼','地点'),
('农场','地点'),('沙滩','地点'),('游泳池','地点'),('体育场','地点'),('邮局','地点'),
('消防站','地点'),('警察局','地点'),('洗手间','地点'),('电梯','地点'),('楼梯','地点'),
('阳台','地点'),('厨房','地点'),('卧室','地点'),('教室','地点'),('实验室','地点'),
('迷宫','地点'),('山洞','地点'),('集市','地点'),('车库','地点'),('屋顶','地点'),
('太阳','自然'),('月亮','自然'),('星星','自然'),('彩虹','自然'),('闪电','自然'),
('打雷','自然'),('下雨','自然'),('雪花','自然'),('台风','自然'),('龙卷风','自然'),
('火山','自然'),('地震','自然'),('海浪','自然'),('瀑布','自然'),('河流','自然'),
('湖泊','自然'),('沙漠','自然'),('森林','自然'),('草原','自然'),('冰山','自然'),
('白云','自然'),('浓雾','自然'),('露珠','自然'),('树叶','自然'),('花朵','自然'),
('玫瑰','自然'),('向日葵','自然'),('仙人掌','自然'),('蘑菇云','自然'),('竹子','自然'),
('柳树','自然'),('松树','自然'),('枫叶','自然'),('种子','自然'),('树根','自然'),
('岛屿','自然'),('峡谷','自然'),('温泉','自然'),('沼泽','自然'),('珊瑚','自然'),
('贝壳','自然'),('石头','自然'),('泥土','自然'),('火焰','自然'),('影子','自然'),
('日落','自然'),('银河','自然'),('流星','自然'),('黑洞','自然'),('极光','自然');
