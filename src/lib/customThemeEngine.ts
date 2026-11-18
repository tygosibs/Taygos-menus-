import { AppLang } from '../data/translations';
import { Category, MenuItem, Restaurant } from '../types/menu';

function safeJsonForInlineScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export const TEMPLATE_VARIABLE_DOCS = [
  {
    token: '{{RESTAURANT_JSON}}',
    label: 'بيانات المطعم (JSON)',
    label_en: 'Restaurant Object (JSON)',
    hint: 'يحتوي على name, name_en, tagline, tagline_en, logoUrl, primaryColor, currency',
    hint_en: 'Includes name, name_en, tagline, tagline_en, logoUrl, primaryColor, currency',
  },
  {
    token: '{{CATEGORIES_JSON}}',
    label: 'مصفوفة الأقسام (JSON)',
    label_en: 'Categories Array (JSON)',
    hint: 'قائمة الأقسام بالترتيب (id, parentId, name, name_en, imageUrl)',
    hint_en: 'Sorted categories array (id, parentId, name, name_en, imageUrl)',
  },
  {
    token: '{{ITEMS_JSON}}',
    label: 'مصفوفة الوجبات (JSON)',
    label_en: 'Menu Items Array (JSON)',
    hint: 'الأصناف المتاحة مع name, name_en, description, description_en, sizes, addons',
    hint_en: 'Available items with name, name_en, description, description_en, sizes, addons',
  },
  {
    token: '{{CURRENT_LANG}}',
    label: 'اللغة الحالية (ar | en)',
    label_en: 'Current Language (ar | en)',
    hint: 'قيمة اللغة المختارة حالياً من قبل العميل ("ar" أو "en")',
    hint_en: 'Active guest language code ("ar" or "en")',
  },
  {
    token: 'window.MENU_DATA',
    label: 'كائن البيانات الشامل (JS)',
    label_en: 'Global Data Object (JS)',
    hint: 'يحتوي تلقائياً على { restaurant, categories, items, currentLang } داخل الجافاسكربت',
    hint_en: 'Auto-populated { restaurant, categories, items, currentLang } in JS runtime',
  },
  {
    token: "window.parent.postMessage({ type: 'OPEN_ITEM_MODAL', itemId }, '*')",
    label: 'جسر فتح تفاصيل الصنف',
    label_en: 'Open Dish Modal Bridge',
    hint: 'فتح نافذة اختيار الأحجام والإضافات الأصلية للمنصة',
    hint_en: 'Triggers native platform modal for portion sizes & add-ons',
  },
];

export const STARTER_CUSTOM_HTML = `<div class="app-shell">
  <header class="hero">
    <div class="hero-brand">
      <img id="rest-logo" class="rest-logo" alt="logo" />
      <div>
        <h1 id="rest-name"></h1>
        <p id="rest-tagline"></p>
      </div>
    </div>
    <div class="search-wrap">
      <input id="search-input" type="search" placeholder="ابحث عن وجبتك المفضلة..." />
    </div>
  </header>

  <nav id="cat-bar" class="cat-bar"></nav>
  <nav id="subcat-bar" class="subcat-bar" style="display:none"></nav>
  <main id="items-grid" class="items-grid"></main>
</div>`;

export const STARTER_CUSTOM_CSS = `:root {
  --accent: #A61C1C;
  --bg: #0f1115;
  --surface: #181b22;
  --text: #f8fafc;
  --muted: #94a3b8;
}

body {
  margin: 0;
  font-family: 'Cairo', 'Tajawal', system-ui, sans-serif;
  background: var(--bg);
  color: var(--text);
  padding-bottom: 92px;
}

.app-shell {
  max-width: 1024px;
  margin: 0 auto;
  padding: 20px 16px;
}

.hero {
  background: linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  padding: 18px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.hero-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rest-logo {
  width: 54px;
  height: 54px;
  border-radius: 14px;
  object-fit: cover;
  border: 2px solid var(--accent);
}

.hero h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 800;
}

.hero p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}

.search-wrap input {
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.12);
  color: var(--text);
  padding: 10px 14px;
  border-radius: 12px;
  font-size: 13px;
  min-width: 220px;
  outline: none;
}

.cat-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 16px 0 8px;
}

.subcat-bar {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 4px 0 14px;
}

.cat-btn {
  border: 1px solid rgba(255,255,255,0.12);
  background: var(--surface);
  color: var(--muted);
  padding: 8px 16px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.cat-btn.active {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.sub-btn {
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  color: var(--muted);
  padding: 6px 14px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.sub-btn.active {
  border-color: var(--accent);
  color: #fff;
  background: rgba(255,255,255,0.12);
}

.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  margin-top: 8px;
}

.card {
  background: var(--surface);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card img {
  width: 100%;
  height: 165px;
  object-fit: cover;
  cursor: pointer;
}

.card-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.card-title {
  margin: 0;
  font-size: 15px;
  font-weight: 800;
  cursor: pointer;
}

.card-desc {
  margin: 0;
  font-size: 12px;
  color: var(--muted);
  line-height: 1.5;
}

.card-footer {
  padding: 12px 14px;
  border-top: 1px solid rgba(255,255,255,0.06);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.price {
  font-size: 14px;
  font-weight: 800;
  color: #fbbf24;
}

.actions {
  display: flex;
  gap: 6px;
}

.btn-detail {
  background: rgba(255,255,255,0.08);
  color: #fff;
  border: none;
  padding: 8px 10px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.btn-add {
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}`;

export const STARTER_CUSTOM_JS = `const restaurant = {{RESTAURANT_JSON}};
const categories = {{CATEGORIES_JSON}};
const items = {{ITEMS_JSON}};
const lang = (window.MENU_DATA && window.MENU_DATA.currentLang) || 'ar';
const isEn = lang === 'en';
const locText = (ar, en) => (isEn ? (en || ar || '') : (ar || en || ''));

if (restaurant && restaurant.primaryColor) {
  document.documentElement.style.setProperty('--accent', restaurant.primaryColor);
}

const logoEl = document.getElementById('rest-logo');
if (logoEl) {
  if (restaurant.logoUrl) {
    logoEl.src = restaurant.logoUrl;
  } else {
    logoEl.style.display = 'none';
  }
}

document.getElementById('rest-name').textContent = locText(restaurant.name, restaurant.name_en) || (isEn ? 'Digital Menu' : 'قائمة الطعام');
document.getElementById('rest-tagline').textContent = locText(restaurant.tagline, restaurant.tagline_en);
const searchEl = document.getElementById('search-input');
if (searchEl) {
  searchEl.placeholder = isEn ? 'Search your favorite dish...' : 'ابحث عن وجبتك المفضلة...';
}

const catById = new Map(categories.map((c) => [c.id, c]));
const mainCategories = categories.filter((c) => !c.parentId || !catById.has(c.parentId));
const subsByParent = new Map();
categories.forEach((c) => {
  if (c.parentId && catById.has(c.parentId)) {
    const arr = subsByParent.get(c.parentId) || [];
    arr.push(c);
    subsByParent.set(c.parentId, arr);
  }
});

let selectedMainCat = 'all';
let selectedSubCat = 'all';
let query = '';

function renderCategories() {
  const bar = document.getElementById('cat-bar');
  const subBar = document.getElementById('subcat-bar');

  const allBtn = document.createElement('button');
  allBtn.className = 'cat-btn ' + (selectedMainCat === 'all' ? 'active' : '');
  allBtn.textContent = (isEn ? 'All' : 'الكل') + ' (' + items.length + ')';
  allBtn.onclick = () => { selectedMainCat = 'all'; selectedSubCat = 'all'; renderCategories(); renderItems(); };
  bar.innerHTML = '';
  bar.appendChild(allBtn);

  mainCategories.forEach((cat) => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn ' + (selectedMainCat === cat.id ? 'active' : '');
    btn.textContent = locText(cat.name, cat.name_en);
    btn.onclick = () => { selectedMainCat = cat.id; selectedSubCat = 'all'; renderCategories(); renderItems(); };
    bar.appendChild(btn);
  });

  const activeSubs = selectedMainCat === 'all' ? [] : (subsByParent.get(selectedMainCat) || []);
  if (activeSubs.length === 0) {
    subBar.style.display = 'none';
    subBar.innerHTML = '';
  } else {
    subBar.style.display = 'flex';
    subBar.innerHTML = '';
    const allSubBtn = document.createElement('button');
    allSubBtn.className = 'sub-btn ' + (selectedSubCat === 'all' ? 'active' : '');
    allSubBtn.textContent = isEn ? 'All Sections' : 'كل الأقسام';
    allSubBtn.onclick = () => { selectedSubCat = 'all'; renderCategories(); renderItems(); };
    subBar.appendChild(allSubBtn);

    activeSubs.forEach((sub) => {
      const btn = document.createElement('button');
      btn.className = 'sub-btn ' + (selectedSubCat === sub.id ? 'active' : '');
      btn.textContent = locText(sub.name, sub.name_en);
      btn.onclick = () => { selectedSubCat = sub.id; renderCategories(); renderItems(); };
      subBar.appendChild(btn);
    });
  }
}

function renderItems() {
  const grid = document.getElementById('items-grid');
  grid.innerHTML = '';
  const childIds = selectedMainCat === 'all' ? [] : (subsByParent.get(selectedMainCat) || []).map((s) => s.id);
  const list = items.filter((item) => {
    let catOk = true;
    if (selectedMainCat !== 'all') {
      catOk = selectedSubCat !== 'all'
        ? item.categoryId === selectedSubCat
        : item.categoryId === selectedMainCat || childIds.includes(item.categoryId);
    }
    const displayTitle = locText(item.name, item.name_en).toLowerCase();
    const displayDesc = locText(item.description, item.description_en).toLowerCase();
    const textOk = !query || displayTitle.includes(query) || displayDesc.includes(query);
    return catOk && textOk;
  });

  const curr = isEn && restaurant.currency === 'ج.م' ? 'EGP' : (restaurant.currency || (isEn ? 'EGP' : 'ج.م'));

  list.forEach((item) => {
    const itemName = locText(item.name, item.name_en);
    const itemDesc = locText(item.description, item.description_en);
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = \`
      <div>
        \${item.imageUrl ? \`<img src="\${item.imageUrl}" alt="\${itemName}" class="js-open" />\` : ''}
        <div class="card-body">
          <h3 class="card-title js-open">\${itemName}</h3>
          <p class="card-desc">\${itemDesc}</p>
        </div>
      </div>
      <div class="card-footer">
        <span class="price">\${item.basePrice} \${curr}</span>
        <div class="actions">
          <button type="button" class="btn-detail js-open">\${isEn ? 'Details' : 'التفاصيل'}</button>
          <button type="button" class="btn-add js-add">\${isEn ? '+ Cart' : '+ سلة'}</button>
        </div>
      </div>
    \`;
    card.querySelectorAll('.js-open').forEach((el) => {
      el.addEventListener('click', () => {
        window.parent.postMessage({ type: 'OPEN_ITEM_MODAL', itemId: item.id }, '*');
      });
    });
    card.querySelector('.js-add').addEventListener('click', () => {
      window.parent.postMessage({ type: 'ADD_TO_CART', itemId: item.id, quantity: 1 }, '*');
    });
    grid.appendChild(card);
  });
}

document.getElementById('search-input').addEventListener('input', (e) => {
  query = (e.target.value || '').trim().toLowerCase();
  renderItems();
});

renderCategories();
renderItems();`;

export function buildCustomThemeSrcDoc(params: {
  htmlCode: string;
  cssCode: string;
  jsCode: string;
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
  currentLang?: AppLang;
}): string {
  const currentLang: AppLang = params.currentLang || 'ar';
  const dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  const availableItems = params.items.filter((i) => i.isAvailable !== false);
  const restJson = safeJsonForInlineScript(params.restaurant);
  const catsJson = safeJsonForInlineScript(params.categories);
  const itemsJson = safeJsonForInlineScript(availableItems);

  const applyTokens = (source: string) =>
    (source || '')
      .replace(/\{\{RESTAURANT_JSON\}\}/g, restJson)
      .replace(/\{\{CATEGORIES_JSON\}\}/g, catsJson)
      .replace(/\{\{ITEMS_JSON\}\}/g, itemsJson)
      .replace(/\{\{CURRENT_LANG\}\}/g, currentLang);

  const compiledHtml = applyTokens(params.htmlCode);
  const compiledCss = applyTokens(params.cssCode);
  const compiledJs = applyTokens(params.jsCode);

  return `<!doctype html>
<html lang="${currentLang}" dir="${dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Tajawal:wght@400;500;700;800&display=swap" rel="stylesheet" />
    <style>
      *, *::before, *::after { box-sizing: border-box; }
      ${compiledCss}
    </style>
  </head>
  <body>
    ${compiledHtml}
    <script>
      window.MENU_DATA = {
        restaurant: ${restJson},
        categories: ${catsJson},
        items: ${itemsJson},
        currentLang: "${currentLang}"
      };
      window.openItemModal = function(itemOrId) {
        var itemId = typeof itemOrId === 'string' ? itemOrId : (itemOrId && itemOrId.id);
        window.parent.postMessage({ type: 'OPEN_ITEM_MODAL', itemId: itemId }, '*');
      };
      window.addToCart = function(itemOrId, quantity) {
        var itemId = typeof itemOrId === 'string' ? itemOrId : (itemOrId && itemOrId.id);
        window.parent.postMessage({ type: 'ADD_TO_CART', itemId: itemId, quantity: quantity || 1 }, '*');
      };
      window.openCart = function() {
        window.parent.postMessage({ type: 'OPEN_CART' }, '*');
      };
      try {
        ${compiledJs}
      } catch (err) {
        console.error('Custom Theme Runtime Error:', err);
      }
    </script>
  </body>
</html>`;
}
