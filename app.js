/* Plans PWA (offline) — data stored locally */

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

const HORIZONS = [
  { id: 'h1', label: '1 год' },
  { id: 'h3', label: '3 года' },
  { id: 'h5', label: '5 лет' },
  { id: 'h10', label: '10 лет' },
  { id: 'h15', label: '15 лет' },
  { id: 'h20', label: '20 лет' },
];

const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

const storageKey = 'plan_pwa_v1';

function uid(prefix='id'){
  return prefix + '_' + Math.random().toString(16).slice(2) + '_' + Date.now().toString(16);
}

function nowISO(){
  return new Date().toISOString();
}

function fmtDate(iso){
  if(!iso) return '';
  try{
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { year:'numeric', month:'short', day:'2-digit' });
  }catch{ return '' }
}

function getMonday(d=new Date()){
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Mon=0
  date.setHours(0,0,0,0);
  date.setDate(date.getDate() - day);
  return date;
}

function dayIndexForDate(d=new Date()){
  return (d.getDay() + 6) % 7; // Mon=0
}

function defaultData(){
  return {
    version: 1,
    updatedAt: nowISO(),
    selectedHorizonId: 'h1',
    goalsByHorizon: Object.fromEntries(HORIZONS.map(h => [h.id, []])),
    weekTasks: [], // {id,title,notes,dayIndex(0-6),horizonId,done,createdAt}
    today: {
      date: new Date().toDateString(),
      items: [] // {id,title,done,createdAt}
    },
    notes: [] // {id,title,body,createdAt,updatedAt}
  };
}

let data = load();

function load(){
  const raw = localStorage.getItem(storageKey);
  if(!raw) return defaultData();
  try{
    const parsed = JSON.parse(raw);
    // minimal migrations
    if(!parsed.version) return defaultData();
    const base = defaultData();
    return {
      ...base,
      ...parsed,
      goalsByHorizon: { ...base.goalsByHorizon, ...(parsed.goalsByHorizon || {}) },
    };
  } catch {
    return defaultData();
  }
}

function save(){
  data.updatedAt = nowISO();
  localStorage.setItem(storageKey, JSON.stringify(data));
  $('#lastSaved').textContent = 'Сохранено: ' + new Date(data.updatedAt).toLocaleString('ru-RU');
}

function toast(msg){
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.hidden = true, 1600);
}

// ---------- Views & navigation ----------
const sidebar = $('#sidebar');
const btnMenu = $('#btnMenu');
btnMenu.addEventListener('click', () => sidebar.classList.toggle('open'));

$$('.navitem').forEach(btn => btn.addEventListener('click', () => {
  const view = btn.dataset.view;
  switchView(view);
  $$('.navitem').forEach(b => b.classList.toggle('active', b === btn));
  sidebar.classList.remove('open');
}));

function switchView(name){
  $$('.view').forEach(v => v.hidden = true);
  $('#view-' + name).hidden = false;
  if(name === 'horizons') renderHorizons();
  if(name === 'week') renderWeek();
  if(name === 'today') renderToday();
  if(name === 'notes') renderNotes();
}

// ---------- Modal ----------
const modal = $('#modal');
const modalTitle = $('#modalTitle');
const modalSubtitle = $('#modalSubtitle');
const modalBody = $('#modalBody');
const modalFoot = $('#modalFoot');

$('#btnClose').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if(e.target === modal) closeModal(); });

document.addEventListener('keydown', (e) => {
  if(e.key === 'Escape' && !modal.hidden) closeModal();
});

function openModal({title, subtitle='', body, actions=[]}){
  modalTitle.textContent = title;
  modalSubtitle.textContent = subtitle;
  modalBody.innerHTML = '';
  modalFoot.innerHTML = '';
  modalBody.appendChild(body);
  actions.forEach(a => modalFoot.appendChild(a));
  modal.hidden = false;
}

function closeModal(){
  modal.hidden = true;
}

function mkBtn(text, {kind='btn', onClick}={}){
  const b = document.createElement('button');
  b.className = kind;
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function mkInput({placeholder='', value='', type='text'}={}){
  const i = document.createElement('input');
  i.className = 'input';
  i.placeholder = placeholder;
  i.value = value;
  i.type = type;
  return i;
}

function mkTextarea({placeholder='', value=''}={}){
  const t = document.createElement('textarea');
  t.className = 'textarea';
  t.placeholder = placeholder;
  t.value = value;
  return t;
}

function mkSelect(options, value){
  const s = document.createElement('select');
  s.className = 'select';
  options.forEach(opt => {
    const o = document.createElement('option');
    o.value = opt.value;
    o.textContent = opt.label;
    s.appendChild(o);
  });
  s.value = value;
  return s;
}

function mkCheck(done){
  const c = document.createElement('div');
  c.className = 'check';
  c.dataset.done = String(!!done);
  c.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  c.style.opacity = done ? '1' : '0.45';
  return c;
}

function mkItem({title, meta=[], done=false, onToggle, onEdit, onDelete}){
  const row = document.createElement('div');
  row.className = 'item';

  const check = mkCheck(done);
  check.addEventListener('click', () => onToggle?.());

  const main = document.createElement('div');
  main.className = 'maincol';

  const t = document.createElement('div');
  t.className = 'title';
  t.textContent = title;

  const m = document.createElement('div');
  m.className = 'meta';
  meta.filter(Boolean).forEach(x => {
    const span = document.createElement('span');
    span.textContent = x;
    m.appendChild(span);
  });

  main.appendChild(t);
  if(meta.length) main.appendChild(m);

  const actions = document.createElement('div');
  actions.className = 'actions';

  const bEdit = document.createElement('button');
  bEdit.className = 'kbd';
  bEdit.textContent = 'Править';
  bEdit.addEventListener('click', () => onEdit?.());

  const bDel = document.createElement('button');
  bDel.className = 'kbd';
  bDel.textContent = 'Удалить';
  bDel.addEventListener('click', () => onDelete?.());

  actions.appendChild(bEdit);
  actions.appendChild(bDel);

  row.appendChild(check);
  row.appendChild(main);
  row.appendChild(actions);

  return row;
}

// ---------- Horizons ----------
function renderHorizonPills(){
  const wrap = $('#horizonPills');
  wrap.innerHTML = '';
  HORIZONS.forEach(h => {
    const b = document.createElement('button');
    b.className = 'pill' + (data.selectedHorizonId === h.id ? ' active' : '');
    b.textContent = h.label;
    b.addEventListener('click', () => {
      data.selectedHorizonId = h.id;
      save();
      renderHorizons();
    });
    wrap.appendChild(b);
  });
}

function renderHorizons(){
  renderHorizonPills();
  const horizon = HORIZONS.find(h => h.id === data.selectedHorizonId) || HORIZONS[0];
  $('#horizonTitle').textContent = 'Цели • ' + horizon.label;

  const list = $('#goalsList');
  list.innerHTML = '';

  const goals = data.goalsByHorizon[horizon.id] || [];
  $('#goalsEmpty').hidden = goals.length !== 0;

  goals.forEach(g => {
    const meta = [
      g.targetDate ? 'До: ' + fmtDate(g.targetDate) : '',
      g.done ? 'Готово' : 'В процессе'
    ];
    const item = mkItem({
      title: g.title,
      meta,
      done: !!g.done,
      onToggle: () => { g.done = !g.done; save(); renderHorizons(); },
      onEdit: () => editGoal(horizon.id, g.id),
      onDelete: () => { delGoal(horizon.id, g.id); }
    });
    list.appendChild(item);
  });
}

function addGoal(){
  const horizonId = data.selectedHorizonId;
  const body = document.createElement('div');
  const title = mkInput({placeholder:'Название цели', value:''});
  const desc = mkTextarea({placeholder:'Описание / критерий успеха (опционально)'});
  const date = mkInput({type:'date'});
  body.appendChild(title);
  body.appendChild(desc);
  body.appendChild(date);

  openModal({
    title: 'Новая цель',
    subtitle: 'Горизонт: ' + (HORIZONS.find(h=>h.id===horizonId)?.label || ''),
    body,
    actions: [
      mkBtn('Отмена', {kind:'btn ghost', onClick: closeModal}),
      mkBtn('Сохранить', {onClick: () => {
        const t = title.value.trim();
        if(!t){ toast('Название пустое'); return; }
        const goal = {
          id: uid('goal'),
          title: t,
          desc: desc.value.trim(),
          targetDate: date.value ? new Date(date.value).toISOString() : null,
          done: false,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        };
        data.goalsByHorizon[horizonId] = data.goalsByHorizon[horizonId] || [];
        data.goalsByHorizon[horizonId].unshift(goal);
        save();
        closeModal();
        renderHorizons();
        toast('Цель добавлена');
      }})
    ]
  });
}

function editGoal(horizonId, goalId){
  const goals = data.goalsByHorizon[horizonId] || [];
  const g = goals.find(x => x.id === goalId);
  if(!g) return;

  const body = document.createElement('div');
  const title = mkInput({placeholder:'Название цели', value:g.title});
  const desc = mkTextarea({placeholder:'Описание', value:g.desc || ''});
  const date = mkInput({type:'date'});
  if(g.targetDate){
    const d = new Date(g.targetDate);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const dd = String(d.getDate()).padStart(2,'0');
    date.value = `${yyyy}-${mm}-${dd}`;
  }
  body.appendChild(title);
  body.appendChild(desc);
  body.appendChild(date);

  openModal({
    title: 'Правка цели',
    subtitle: 'Горизонт: ' + (HORIZONS.find(h=>h.id===horizonId)?.label || ''),
    body,
    actions: [
      mkBtn('Закрыть', {kind:'btn ghost', onClick: closeModal}),
      mkBtn('Сохранить', {onClick: () => {
        const t = title.value.trim();
        if(!t){ toast('Название пустое'); return; }
        g.title = t;
        g.desc = desc.value.trim();
        g.targetDate = date.value ? new Date(date.value).toISOString() : null;
        g.updatedAt = nowISO();
        save();
        closeModal();
        renderHorizons();
        toast('Сохранено');
      }})
    ]
  });
}

function delGoal(horizonId, goalId){
  const goals = data.goalsByHorizon[horizonId] || [];
  const idx = goals.findIndex(x => x.id === goalId);
  if(idx < 0) return;
  if(!confirm('Удалить цель?')) return;
  goals.splice(idx,1);
  save();
  renderHorizons();
  toast('Удалено');
}

$('#btnAddGoal').addEventListener('click', addGoal);

// ---------- Week ----------
function renderWeek(){
  const grid = $('#weekGrid');
  grid.innerHTML = '';

  const monday = getMonday(new Date());
  const start = monday;

  for(let i=0;i<7;i++){
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const card = document.createElement('div');
    card.className = 'card';

    const head = document.createElement('div');
    head.className = 'cardhead';

    const h = document.createElement('div');
    h.innerHTML = `<div class="h3">${DAYS[i]}</div><div class="muted">${d.toLocaleDateString('ru-RU',{month:'short', day:'2-digit'})}</div>`;

    head.appendChild(h);
    card.appendChild(head);

    const list = document.createElement('div');
    list.className = 'list';

    const tasks = data.weekTasks
      .filter(t => t.dayIndex === i)
      .sort((a,b) => Number(!!a.done) - Number(!!b.done));

    if(tasks.length === 0){
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Нет задач. Нажми “+ Задача” сверху.';
      list.appendChild(empty);
    }

    tasks.forEach(t => {
      const horizonLabel = (HORIZONS.find(h=>h.id===t.horizonId)?.label) || '—';
      const meta = [horizonLabel, t.notes ? 'Есть заметка' : ''];
      list.appendChild(mkItem({
        title: t.title,
        meta,
        done: !!t.done,
        onToggle: () => { t.done = !t.done; save(); renderWeek(); renderToday(); },
        onEdit: () => editWeekTask(t.id),
        onDelete: () => delWeekTask(t.id),
      }));
    });

    card.appendChild(list);
    grid.appendChild(card);
  }
}

function addWeekTask(){
  const body = document.createElement('div');
  const title = mkInput({placeholder:'Задача на неделю'});
  const notes = mkTextarea({placeholder:'Подробности (опционально)'});
  const day = mkSelect(DAYS.map((d,i)=>({value:String(i), label:d})), String(dayIndexForDate(new Date())));
  const horizon = mkSelect(HORIZONS.map(h=>({value:h.id, label:'Горизонт: ' + h.label})), data.selectedHorizonId);

  body.appendChild(title);
  body.appendChild(day);
  body.appendChild(horizon);
  body.appendChild(notes);

  openModal({
    title: 'Новая задача',
    subtitle: 'Раздел: Неделя',
    body,
    actions: [
      mkBtn('Отмена', {kind:'btn ghost', onClick: closeModal}),
      mkBtn('Сохранить', {onClick: () => {
        const t = title.value.trim();
        if(!t){ toast('Название пустое'); return; }
        data.weekTasks.unshift({
          id: uid('wk'),
          title: t,
          notes: notes.value.trim(),
          dayIndex: Number(day.value),
          horizonId: horizon.value,
          done: false,
          createdAt: nowISO(),
          updatedAt: nowISO(),
        });
        save();
        closeModal();
        renderWeek();
        renderToday();
        toast('Задача добавлена');
      }})
    ]
  });
}

function editWeekTask(taskId){
  const t = data.weekTasks.find(x => x.id === taskId);
  if(!t) return;

  const body = document.createElement('div');
  const title = mkInput({placeholder:'Задача', value:t.title});
  const notes = mkTextarea({placeholder:'Подробности', value:t.notes || ''});
  const day = mkSelect(DAYS.map((d,i)=>({value:String(i), label:d})), String(t.dayIndex));
  const horizon = mkSelect(HORIZONS.map(h=>({value:h.id, label:'Горизонт: ' + h.label})), t.horizonId);

  body.appendChild(title);
  body.appendChild(day);
  body.appendChild(horizon);
  body.appendChild(notes);

  openModal({
    title: 'Правка задачи',
    subtitle: 'Раздел: Неделя',
    body,
    actions: [
      mkBtn('Закрыть', {kind:'btn ghost', onClick: closeModal}),
      mkBtn('Сохранить', {onClick: () => {
        const tt = title.value.trim();
        if(!tt){ toast('Название пустое'); return; }
        t.title = tt;
        t.dayIndex = Number(day.value);
        t.horizonId = horizon.value;
        t.notes = notes.value.trim();
        t.updatedAt = nowISO();
        save();
        closeModal();
        renderWeek();
        renderToday();
        toast('Сохранено');
      }})
    ]
  });
}

function delWeekTask(taskId){
  const idx = data.weekTasks.findIndex(x => x.id === taskId);
  if(idx < 0) return;
  if(!confirm('Удалить задачу?')) return;
  data.weekTasks.splice(idx,1);
  save();
  renderWeek();
  renderToday();
  toast('Удалено');
}

$('#btnAddWeekTask').addEventListener('click', addWeekTask);

// ---------- Today ----------
function ensureToday(){
  const todayKey = new Date().toDateString();
  if(data.today.date !== todayKey){
    data.today.date = todayKey;
    // сохраняем список, но сбрасываем отметки? — не сбрасываем, чтобы не раздражать
    // однако удобно сбрасывать done -> false
    data.today.items = (data.today.items || []).map(i => ({...i, done:false}));
    save();
  }
}

function renderToday(){
  ensureToday();
  $('#todayDate').textContent = new Date().toLocaleDateString('ru-RU', {weekday:'long', year:'numeric', month:'long', day:'numeric'});

  const list = $('#todayList');
  list.innerHTML = '';
  const items = data.today.items || [];
  $('#todayEmpty').hidden = items.length !== 0;

  items.forEach(it => {
    list.appendChild(mkItem({
      title: it.title,
      meta: [],
      done: !!it.done,
      onToggle: () => { it.done = !it.done; save(); renderToday(); },
      onEdit: () => editTodayItem(it.id),
      onDelete: () => delTodayItem(it.id),
    }));
  });

  // tasks from week
  const dayIdx = dayIndexForDate(new Date());
  const weekToday = data.weekTasks
    .filter(t => t.dayIndex === dayIdx)
    .sort((a,b) => Number(!!a.done) - Number(!!b.done));

  const w = $('#todayFromWeek');
  w.innerHTML = '';
  $('#todayFromWeekEmpty').hidden = weekToday.length !== 0;

  weekToday.forEach(t => {
    const horizonLabel = (HORIZONS.find(h=>h.id===t.horizonId)?.label) || '—';
    w.appendChild(mkItem({
      title: t.title,
      meta: [horizonLabel, 'из недели'],
      done: !!t.done,
      onToggle: () => { t.done = !t.done; save(); renderWeek(); renderToday(); },
      onEdit: () => editWeekTask(t.id),
      onDelete: () => delWeekTask(t.id),
    }));
  });
}

function addTodayItem(){
  const body = document.createElement('div');
  const title = mkInput({placeholder:'Пункт чеклиста'});
  body.appendChild(title);

  openModal({
    title: 'Новый пункт',
    subtitle: 'Раздел: Сегодня',
    body,
    actions: [
      mkBtn('Отмена', {kind:'btn ghost', onClick: closeModal}),
      mkBtn('Сохранить', {onClick: () => {
        const t = title.value.trim();
        if(!t){ toast('Пусто'); return; }
        data.today.items.unshift({ id: uid('td'), title: t, done:false, createdAt: nowISO() });
        save();
        closeModal();
        renderToday();
        toast('Добавлено');
      }})
    ]
  });
}

function editTodayItem(id){
  const it = (data.today.items || []).find(x => x.id === id);
  if(!it) return;

  const body = document.createElement('div');
  const title = mkInput({placeholder:'Пункт', value: it.title});
  body.appendChild(title);

  openModal({
    title: 'Правка пункта',
    subtitle: 'Раздел: Сегодня',
    body,
    actions: [
      mkBtn('Закрыть', {kind:'btn ghost', onClick: closeModal}),
      mkBtn('Сохранить', {onClick: () => {
        const t = title.value.trim();
        if(!t){ toast('Пусто'); return; }
        it.title = t;
        save();
        closeModal();
        renderToday();
        toast('Сохранено');
      }})
    ]
  });
}

function delTodayItem(id){
  const idx = (data.today.items || []).findIndex(x => x.id === id);
  if(idx < 0) return;
  if(!confirm('Удалить пункт?')) return;
  data.today.items.splice(idx,1);
  save();
  renderToday();
  toast('Удалено');
}

$('#btnAddToday').addEventListener('click', addTodayItem);

// ---------- Notes ----------
function renderNotes(){
  const list = $('#notesList');
  list.innerHTML = '';
  const notes = data.notes || [];
  $('#notesEmpty').hidden = notes.length !== 0;

  notes.forEach(n => {
    const meta = [
      'Создано: ' + fmtDate(n.createdAt),
      n.updatedAt ? 'Изм.: ' + fmtDate(n.updatedAt) : ''
    ];
    list.appendChild(mkItem({
      title: n.title,
      meta,
      done: false,
      onToggle: () => openNote(n.id),
      onEdit: () => editNote(n.id),
      onDelete: () => delNote(n.id),
    }));
  });
}

function addNote(){
  const body = document.createElement('div');
  const title = mkInput({placeholder:'Заголовок'});
  const text = mkTextarea({placeholder:'Текст заметки'});
  body.appendChild(title);
  body.appendChild(text);

  openModal({
    title: 'Новая заметка',
    subtitle: 'Раздел: Заметки',
    body,
    actions: [
      mkBtn('Отмена', {kind:'btn ghost', onClick: closeModal}),
      mkBtn('Сохранить', {onClick: () => {
        const t = title.value.trim() || 'Без названия';
        data.notes.unshift({
          id: uid('note'),
          title: t,
          body: text.value.trim(),
          createdAt: nowISO(),
          updatedAt: nowISO(),
        });
        save();
        closeModal();
        renderNotes();
        toast('Заметка добавлена');
      }})
    ]
  });
}

function openNote(id){
  const n = (data.notes || []).find(x => x.id === id);
  if(!n) return;
  const body = document.createElement('div');
  const text = document.createElement('div');
  text.className = 'small';
  text.style.whiteSpace = 'pre-wrap';
  text.textContent = n.body || '—';
  body.appendChild(text);

  openModal({
    title: n.title,
    subtitle: 'Просмотр',
    body,
    actions: [
      mkBtn('Закрыть', {kind:'btn ghost', onClick: closeModal}),
      mkBtn('Править', {onClick: () => { closeModal(); editNote(id); }})
    ]
  });
}

function editNote(id){
  const n = (data.notes || []).find(x => x.id === id);
  if(!n) return;
  const body = document.createElement('div');
  const title = mkInput({placeholder:'Заголовок', value:n.title});
  const text = mkTextarea({placeholder:'Текст', value:n.body || ''});
  body.appendChild(title);
  body.appendChild(text);

  openModal({
    title: 'Правка заметки',
    subtitle: 'Раздел: Заметки',
    body,
    actions: [
      mkBtn('Закрыть', {kind:'btn ghost', onClick: closeModal}),
      mkBtn('Сохранить', {onClick: () => {
        n.title = title.value.trim() || 'Без названия';
        n.body = text.value;
        n.updatedAt = nowISO();
        save();
        closeModal();
        renderNotes();
        toast('Сохранено');
      }})
    ]
  });
}

function delNote(id){
  const idx = (data.notes || []).findIndex(x => x.id === id);
  if(idx < 0) return;
  if(!confirm('Удалить заметку?')) return;
  data.notes.splice(idx,1);
  save();
  renderNotes();
  toast('Удалено');
}

$('#btnAddNote').addEventListener('click', addNote);

// ---------- Export / Import ----------
function exportData(){
  const payload = JSON.stringify(data, null, 2);
  const blob = new Blob([payload], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'plans-export.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Экспорт скачан');
}

function importData(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const parsed = JSON.parse(String(reader.result || ''));
      if(!parsed || typeof parsed !== 'object') throw new Error('bad');
      // basic validation
      data = {
        ...defaultData(),
        ...parsed,
        goalsByHorizon: { ...defaultData().goalsByHorizon, ...(parsed.goalsByHorizon || {}) },
      };
      save();
      toast('Импорт выполнен');
      // rerender current view
      const active = $('.navitem.active')?.dataset.view || 'horizons';
      switchView(active);
    }catch{
      alert('Не получилось импортировать файл. Он должен быть JSON-экспортом из этого приложения.');
    }
  };
  reader.readAsText(file);
}

$('#btnExport').addEventListener('click', () => {
  switchView('settings');
  $$('.navitem').forEach(b => b.classList.toggle('active', b.dataset.view === 'settings'));
});
$('#btnExport2').addEventListener('click', exportData);
$('#importFile').addEventListener('change', (e) => {
  const f = e.target.files?.[0];
  if(f) importData(f);
  e.target.value = '';
});

// ---------- Reset ----------
$('#btnReset').addEventListener('click', () => {
  if(!confirm('Точно сбросить все данные? Это нельзя отменить.')) return;
  localStorage.removeItem(storageKey);
  data = defaultData();
  save();
  switchView('horizons');
  $$('.navitem').forEach(b => b.classList.toggle('active', b.dataset.view === 'horizons'));
  toast('Сброшено');
});

// ---------- Init ----------
function init(){
  // normalize missing horizons
  HORIZONS.forEach(h => { if(!data.goalsByHorizon[h.id]) data.goalsByHorizon[h.id] = []; });
  if(!HORIZONS.some(h => h.id === data.selectedHorizonId)) data.selectedHorizonId = 'h1';

  save();
  $('#subtitle').textContent = navigator.onLine ? 'Офлайн-режим доступен • Данные на устройстве' : 'Офлайн • Данные на устройстве';

  switchView('horizons');
  $('#todayDate').textContent = new Date().toLocaleDateString('ru-RU');

  window.addEventListener('online', () => $('#subtitle').textContent = 'Онлайн • Офлайн-режим доступен');
  window.addEventListener('offline', () => $('#subtitle').textContent = 'Офлайн • Данные на устройстве');
}

$('#btnAddGoal').addEventListener('click', addGoal);
$('#btnAddWeekTask').addEventListener('click', addWeekTask);
$('#btnAddToday').addEventListener('click', addTodayItem);
$('#btnAddNote').addEventListener('click', addNote);

init();
