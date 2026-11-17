// Korean for everything on screen (L switches language). PixSpell's pixel font is Latin only, so Korean is drawn
// with a web font at the screen's real resolution; in English every glyph is still PixSpell.
// KO: whole strings. PATTERNS: strings with numbers or names in them ($1, $2 are translated too).

export const KO = {
  // title
  'HEROES OF THE WORLD AGAINST THE FALLING HORDE': '쏟아지는 괴물 떼에 맞서는 세계의 영웅들',
  'IN A RUN: SPACE DASHES - LEVEL 5 WEAPON + ITS PASSIVE EVOLVES': '스페이스: 대시 · 5레벨 무기 + 짝이 되는 능력 = 진화',
  'ARROWS: HERO  Q/E: STAGE  T: TALL  ENTER: START': '방향키: 영웅  Q/E: 무대  T: 큰 키  엔터: 시작',
  'ARROWS: HERO   ENTER: UNLOCK THIS HERO': '방향키: 영웅   엔터: 이 영웅 해금',
  'EVERY PIXEL AND SOUND IS PIXSPELL CODE': '모든 그림과 소리는 PixSpell 코드입니다 · L: ENGLISH',
  'U: UPGRADES': 'U: 강화', 'START': '시작', 'UPGRADES': '강화', UNLOCK: '해금', TALL: '큰 키', CHIBI: '2등신', BACK: '뒤로', AGAIN: '다시', HEROES: '영웅 선택', 'GO ON': '계속', QUIT: '그만두기',
  'ARROWS: CHOOSE   ENTER: BUY   ESC: BACK': '방향키: 고르기   엔터: 사기   ESC: 뒤로',
  'MAX': '최대',
  // heroes
  SAMURAI: '사무라이', VIKING: '바이킹', 'HANBOK DANCER': '한복 무희', 'HORSE ARCHER': '기마 궁수', KENTE: '켄테 술사', LEGIONARY: '군단병',
  MUSKETEER: '총사', 'OUTBACK RANGER': '아웃백 레인저', PHARAOH: '파라오', 'JOSEON SCHOLAR': '조선 선비',
  JAPAN: '일본', SCANDINAVIA: '스칸디나비아', KOREA: '한국', MONGOLIA: '몽골', GHANA: '가나', ROME: '로마', FRANCE: '프랑스', AUSTRALIA: '호주', EGYPT: '이집트',
  'SLASHES WHAT IS IN FRONT': '가까운 적을 크게 벤다', 'SHAKES THE GROUND AROUND': '주변 땅을 내려찍는다', 'FANS OUT SEEKING PETALS': '적을 쫓는 꽃잎을 날린다',
  'SHOOTS THE NEAREST FOE': '가장 가까운 적을 쏜다', 'CALLS DOWN CHAIN LIGHTNING': '적에게 번개를 떨어뜨린다', 'A SPEAR THAT PIERCES ROWS': '한 줄을 꿰뚫는 창',
  'QUICK STABS, MANY OF THEM': '빠르게 여러 번 찌른다', 'IT ALWAYS COMES BACK': '던지면 돌아온다', 'BEAMS OF THE SUN STRIKE': '햇빛이 내리꽂힌다', 'SPELL BOOKS CIRCLE AROUND': '주문책이 주위를 돈다',
  // weapons
  KATANA: '카타나', RAPIER: '레이피어', PILUM: '필룸', 'QUAKE AXE': '지진 도끼', 'PETAL FAN': '꽃잎 부채', 'HORSE BOW': '각궁', 'STORM STAFF': '폭풍 지팡이',
  BOOMERANG: '부메랑', 'SUN BEAM': '태양 광선', 'SPELL BOOKS': '주문책', 'HOLY AURA': '성스러운 오라', 'FROST NOVA': '서리 폭발', METEOR: '운석', TORNADO: '회오리',
  'POISON FLASK': '독 플라스크', BOMBS: '폭탄', SHURIKEN: '수리검', 'DRAGON BREATH': '용의 숨결', 'VOID ORB': '공허 구슬',
  'SLASH IN FRONT': '앞을 벤다', 'FAST STABS': '빠른 찌르기', 'PIERCES A WHOLE ROW': '한 줄을 꿰뚫는다', 'SLAM AROUND YOU': '주위를 내려찍는다', 'SEEKING PETALS': '적을 쫓는 꽃잎',
  'ARROWS AT THE NEAREST': '가까운 적에게 화살', 'LIGHTNING ON FOES': '적에게 번개', 'OUT AND BACK AGAIN': '나갔다가 돌아온다', 'BEAMS FROM THE SKY': '하늘에서 광선',
  'BOOKS CIRCLE YOU': '책이 주위를 돈다', 'HURTS ALL NEAR YOU': '가까운 적 모두에게 피해', 'FREEZE A RING AROUND': '주위를 얼린다', 'A ROCK FROM THE SKY': '하늘에서 바위',
  'A WANDERING STORM': '떠도는 폭풍', 'A CLOUD THAT LINGERS': '남아 있는 독 구름', 'THROWN, THEN BOOM': '던지면 폭발', 'STARS IN ALL WAYS': '사방으로 수리검', 'FIRE IN FRONT': '앞으로 불길', 'PULLS THEM IN': '적을 끌어당긴다',
  // evolutions
  'MOON BLADE': '월광검', 'THOUSAND NEEDLES': '천 개의 바늘', PHALANX: '팔랑크스', RAGNAROK: '라그나로크', 'BLOSSOM STORM': '꽃보라', 'ARROW STORM': '화살 폭풍',
  THUNDERSTORM: '뇌우', 'STAR CHAKRAM': '별 차크람', 'EYE OF RA': '라의 눈', 'LIVING LIBRARY': '살아 있는 서고',
  'CUTS BOTH WAYS AND THROWS CRESCENTS': '앞뒤를 베고 초승달 검기를 날린다', 'THREE LONG THRUSTS AT ONCE': '긴 찌르기 세 번을 한꺼번에', 'SPEARS IN EIGHT DIRECTIONS': '여덟 방향으로 창',
  'AFTERSHOCKS AND ERUPTIONS': '여진과 분출', 'EIGHT SEEKING BLOSSOMS AT ONCE': '적을 쫓는 꽃 여덟 송이', 'FIVE ARROWS THROUGH EVERYTHING': '모두 꿰뚫는 화살 다섯 발',
  'LIGHTNING JUMPS FROM FOE TO FOE': '번개가 적에서 적으로 튄다', 'THREE WIDE BLADES BRING GEMS BACK': '큰 칼날 셋이 보석을 가져온다', 'TWO SUN RAYS SWEEP AROUND YOU': '두 줄기 햇빛이 주위를 쓴다',
  'TWO RINGS OF BOOKS SHOOT BOLTS': '두 겹의 책이 마법탄을 쏜다', 'WEAPON EVOLVED': '무기 진화',
  // passives and upgrades
  MIGHT: '힘', ARMOR: '갑옷', VIGOR: '활력', HOURGLASS: '모래시계', GRIMOIRE: '마도서', BOOTS: '장화', COMPASS: '나침반', DICE: '주사위', CROWN: '왕관', APPLE: '사과',
  '+12% DAMAGE': '피해 +12%', '-1 DAMAGE TAKEN': '받는 피해 -1', '+20 MAX HP': '최대 체력 +20', '8% FASTER WEAPONS': '무기 속도 +8%', '+12% AREA': '범위 +12%',
  '+8% MOVE SPEED': '이동 속도 +8%', '+35% PICKUP RANGE': '줍는 범위 +35%', '+6% CRITICAL HITS': '치명타 +6%', '+10% EXPERIENCE': '경험치 +10%', '+0.4 HP EACH SECOND': '초당 체력 +0.4',
  HEALTH: '체력', SPEED: '속도', MAGNET: '자석', WISDOM: '지혜', GREED: '탐욕', REROLL: '다시 뽑기', 'QUICK DASH': '빠른 대시', 'SECOND WIND': '재기',
  '+5% DAMAGE': '피해 +5%', '+10 MAX HP': '최대 체력 +10', '+3% MOVE SPEED': '이동 속도 +3%', '+15% PICKUP RANGE': '줍는 범위 +15%', '+4% EXPERIENCE': '경험치 +4%',
  '+15% GOLD': '골드 +15%', '+1 REROLL A RUN': '판마다 다시 뽑기 +1', '8% SHORTER DASH WAIT': '대시 대기 -8%', 'GET UP ONCE A RUN': '한 판에 한 번 다시 일어선다',
  // stages, bosses, elites
  'GREEN MEADOW': '푸른 초원', 'SUNKEN SANDS': '가라앉은 사막', 'FROST HOLLOW': '서리 골짜기',
  'THE STONE KING': '돌의 왕', 'THE SAND PHARAOH': '모래의 파라오', 'THE FROST KING': '서리의 왕', 'THE DRAGON KING': '용왕',
  'A BOSS IS COMING': '보스가 나타났다', 'A MIMIC!': '미믹이다!', 'CATCH IT FOR ITS GOLD': '잡으면 골드를 준다',
  SWIFT: '신속', ARMORED: '중갑', SUMMONER: '소환사', VOLATILE: '폭발성',
  // in a run
  'LEVEL UP!': '레벨 업!', 'NEW!': '새로 얻기', 'EVOLVE!': '진화!', 'EVO +': '진화 +', 'FULL HEAL': '체력 전부 회복', '+25 GOLD': '골드 +25',
  PAUSED: '일시정지', EVOLVED: '진화함', 'READY: NEXT LEVEL UP': '준비됨: 다음 레벨업에 진화',
  'ESC: GO ON   M: SOUND   P: COLORS   Q: QUIT': 'ESC: 계속   M: 소리   P: 색   Q: 그만두기',
  // the end
  'VICTORY!': '승리!', 'YOU FELL': '쓰러졌다', 'FASTEST WIN HERE YET!': '이 무대 최단 승리 기록!', 'YOUR LONGEST RUN HERE YET!': '이 무대 최장 생존 기록!',
  FOUND: '주운 골드', DEFEATED: '처치', TIME: '시간', VICTORY: '승리', GOLD: '골드',
  'ENTER: AGAIN   ESC: HEROES AND UPGRADES': '엔터: 다시   ESC: 영웅과 강화',
}

export const PATTERNS = [
  [/^LV (\d+)$/, 'Lv $1'],
  [/^R: REROLL \((\d+)\)$/, 'R: 다시 뽑기 ($1)'],
  [/^= (.+)$/, '= $1'],
  [/^(.+) OF (.+)$/, '$2의 $1'],
  [/^(.+) FALLS$/, '$1 격파!'],
  [/^(.+) {2}EVOLVED$/, '$1  (진화)'],
  [/^(.+) {2}LV (\d+)$/, '$1  Lv $2'],
  [/^LV 5 \+ (.+) = (.+)$/, '5레벨 + $1 = $2'],
  [/^(\d+) GOLD: ENTER$/, '$1 골드: 엔터'],
  [/^HP (\d+) {2}SPEED (\d+)$/, '체력 $1  속도 $2'],
  [/^(WON|BEST) (\d+:\d+)$/, (m, t) => `${m[1] === 'WON' ? '승리' : '최고'} ${m[2]}`],
  [/^LEVEL (\d+) {3}(\d+) DEFEATED$/, '레벨 $1   처치 $2'],
  [/^(\d+) RUNS {3}(\d+) WON {3}(\d+) DEFEATED$/, '$1판   $2승   처치 $3'],
  [/^(.+) {2}(\d+:\d+)$/, '$1  $2'],
  [/^(.+) (\d)$/, '$1 $2'],
]

/** The Korean for a string, or null when it has none (numbers, the logo). */
export function tr(s) {
  if (KO[s]) return KO[s]
  for (const [re, to] of PATTERNS) {
    const m = s.match(re)
    if (!m) continue
    if (typeof to === 'function') return to(m)
    return to.replace(/\$(\d)/g, (_, i) => tr(m[i]) ?? m[i])
  }
  return null
}
