// Level cerita 1-6 dibagi ke tiga rak.
export const SHELVES = [
  { name: 'Mudah', color: '#16a34a' },
  { name: 'Lanjutan', color: '#d97706' },
  { name: 'Susah', color: '#dc2626' },
];
export const shelfOf = (level) => (level <= 2 ? 0 : level <= 4 ? 1 : 2);

// Semua gambar berkanvas 400x300. Objek utama berada di x 88-312, y 60-210 agar utuh di cover dan banner.
const SCENES = {
  story_b1: `<defs><linearGradient id="art-b1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc8f2"/><stop offset="1" stop-color="#fdf1c4"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#art-b1)"/>
    <circle cx="282" cy="88" r="50" fill="#ffd65a" opacity=".35"/><circle cx="282" cy="88" r="31" fill="#ffc83d"/>
    <g fill="#fff"><ellipse cx="125" cy="118" rx="30" ry="11"/><ellipse cx="146" cy="110" rx="20" ry="13"/><ellipse cx="226" cy="72" rx="24" ry="9"/></g>
    <path d="M0 190Q100 140 210 185T400 170V300H0Z" fill="#a4d870"/>
    <path d="M0 226Q130 190 260 222T400 208V300H0Z" fill="#6fbf5a"/>
    <rect x="100" y="150" width="50" height="50" fill="#fff3e0"/><path d="M93 152l32-28 32 28z" fill="#e8513f"/><rect x="118" y="172" width="14" height="28" fill="#8a5a33"/>
    <rect x="279" y="160" width="9" height="42" fill="#8a5a33"/><g fill="#3f9b55"><circle cx="283" cy="145" r="24"/><circle cx="268" cy="158" r="15"/><circle cx="298" cy="158" r="15"/></g>
    <path d="M183 72l15 18-15 22-15-22z" fill="#e2477b"/><path d="M183 112q2 12 8 16" stroke="#e2477b" stroke-width="2" fill="none"/>
    <path d="M191 128L208 158" stroke="#fff" stroke-width="1.5"/>
    <rect x="202" y="152" width="26" height="31" rx="8" fill="#2f6df0"/>
    <path d="M204 160l4-4" stroke="#ffd7b0" stroke-width="6" stroke-linecap="round"/>
    <path d="M226 158l7 15" stroke="#ffd7b0" stroke-width="6" stroke-linecap="round"/>
    <path d="M209 182v19M221 182v19" stroke="#33407a" stroke-width="7" stroke-linecap="round"/>
    <circle cx="215" cy="139" r="14" fill="#ffd7b0"/><path d="M201 138a14 14 0 0 1 28 0q-14-9-28 0z" fill="#33261e"/>`,
  story_b2: `<defs><linearGradient id="art-b2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a98df2"/><stop offset="1" stop-color="#fbd3e9"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#art-b2)"/>
    <rect y="210" width="400" height="90" fill="#d9c8f0"/>
    <g fill="#8f79d8"><rect x="0" y="118" width="46" height="94"/><rect x="46" y="94" width="46" height="118"/><rect x="308" y="102" width="50" height="110"/><rect x="358" y="128" width="42" height="84"/></g>
    <g fill="#ffe9a8"><rect x="12" y="132" width="10" height="12"/><rect x="58" y="110" width="10" height="12"/><rect x="72" y="136" width="10" height="12"/><rect x="58" y="162" width="10" height="12"/><rect x="322" y="118" width="10" height="12"/><rect x="338" y="146" width="10" height="12"/><rect x="370" y="144" width="10" height="12"/></g>
    <rect x="92" y="66" width="216" height="146" fill="#fff7ef"/>
    <rect x="92" y="66" width="216" height="32" fill="#7c4fe0"/>
    <text x="200" y="90" text-anchor="middle" font-size="21" font-weight="800" fill="#fff" font-family="Noto Sans SC,PingFang SC,sans-serif">商场</text>
    <g fill="#f4a3c4"><rect x="92" y="98" width="27" height="14"/><rect x="146" y="98" width="27" height="14"/><rect x="200" y="98" width="27" height="14"/><rect x="254" y="98" width="27" height="14"/></g>
    <g fill="#fff"><rect x="119" y="98" width="27" height="14"/><rect x="173" y="98" width="27" height="14"/><rect x="227" y="98" width="27" height="14"/><rect x="281" y="98" width="27" height="14"/></g>
    <rect x="104" y="124" width="60" height="62" rx="3" fill="#cfeefc"/><rect x="236" y="124" width="60" height="62" rx="3" fill="#cfeefc"/>
    <path d="M122 138l8-5h8l8 5-5 9-4-2v24h-14v-24l-4 2z" fill="#dc2626"/>
    <path d="M247 166v-12h11l9 8 15 3q3 1 3 5v3h-38z" fill="#fff" stroke="#6b5a8e" stroke-width="2"/>
    <path d="M183 142v-5M217 142v-5" stroke="none"/>
    <rect x="176" y="154" width="22" height="30" rx="7" fill="#dc2626"/>
    <rect x="207" y="154" width="22" height="30" rx="7" fill="#0ea5a4"/>
    <path d="M181 183v21M193 183v21" stroke="#33407a" stroke-width="6" stroke-linecap="round"/>
    <path d="M212 183v21M224 183v21" stroke="#5a4634" stroke-width="6" stroke-linecap="round"/>
    <circle cx="187" cy="142" r="12" fill="#ffd7b0"/><path d="M175 141a12 12 0 0 1 24 0q-12-8-24 0z" fill="#33261e"/>
    <circle cx="218" cy="142" r="12" fill="#f2c79d"/><path d="M206 146q-2-16 12-16t12 16l-3 5q0-15-9-14t-9 14z" fill="#6a3d20"/>
    <path d="M178 160l-11 18M227 160l11 18" stroke="#ffd7b0" stroke-width="5" stroke-linecap="round"/>
    <rect x="156" y="178" width="20" height="24" rx="2" fill="#f08a24"/><path d="M161 178q5-10 10 0" stroke="#7a4410" stroke-width="2" fill="none"/>
    <rect x="229" y="178" width="20" height="24" rx="2" fill="#2f6df0"/><path d="M234 178q5-10 10 0" stroke="#17378a" stroke-width="2" fill="none"/>`,
};

// Cerita baru tanpa ilustrasi khusus: pemandangan yang warnanya tetap untuk tiap cerita.
function fallbackScene(id) {
  const hue = [...String(id)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 3600, 7) * 137 % 360;
  return `<defs><linearGradient id="art-${hue}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="hsl(${hue} 62% 38%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 78% 76%)"/></linearGradient></defs>
    <rect width="400" height="300" fill="url(#art-${hue})"/>
    <circle cx="255" cy="100" r="30" fill="#fff6d8"/><g fill="#fff"><circle cx="130" cy="82" r="2.5"/><circle cx="175" cy="120" r="2"/><circle cx="205" cy="70" r="2.5"/><circle cx="300" cy="150" r="2"/></g>
    <path d="M0 215L95 110l70 72 55-52 90 82 90-60V300H0Z" fill="hsl(${hue} 45% 28%)"/>
    <path d="M0 245q110-55 215-18t185-25V300H0Z" fill="hsl(${hue} 50% 18%)"/>`;
}

export function storyArt(s, kind) {
  const box = kind === 'cover' ? '88 0 225 300' : '0 60 400 150';
  return `<svg class="story-art" viewBox="${box}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${SCENES[s.id] || fallbackScene(s.id)}</svg>`;
}
