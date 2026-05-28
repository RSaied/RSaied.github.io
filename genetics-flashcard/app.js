// ============================================================
// STATE
// ============================================================
const STATE = {
  chapters: TERMS_DATA,
  currentChapter: null,
  currentTermIndex: 0,
  currentTerms: [],
  sessionStats: { known: 0, unknown: 0, total: 0 },
  selectedDifficulty: null,
  isFlipped: false,
  // Quiz state
  quizQuestions: [],
  quizIndex: 0,
  quizCorrect: 0,
  quizWrong: 0,
  quizAnswered: false,
};

const STORAGE_KEY = 'genetics_flashcard_progress';
const APP_VERSION = '1.0.2';

// ============================================================
// LOCAL STORAGE
// ============================================================
function loadProgress() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) { try { return JSON.parse(stored); } catch { return {}; } }
  return {};
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// ============================================================
// TAB NAVIGATION
// ============================================================
function switchTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.toggle('active', t.id === 'tab-' + tabId));
  if (tabId === 'smart') loadSmartReview();
  if (tabId === 'list') renderTermsList();
  if (tabId === 'stats') renderStats();
  if (tabId === 'quiz') {
    const qv = document.getElementById('quiz-view');
    if (qv.style.display !== 'flex') resetQuiz();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Redirect to versioned URL to trigger WebAPK update on Android
  const verParam = '?v=' + APP_VERSION;
  if (!window.location.search.includes('v=' + APP_VERSION)) {
    window.location.replace(window.location.pathname + verParam);
    return;
  }
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  initFlashcard();
  populateSelects();
  updateQuizStart();
  document.getElementById('app-version').textContent = APP_VERSION;
  registerSW();
});

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const newSW = reg.installing;
      newSW.addEventListener('statechange', () => {
        if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
          showToast('🔄 نسخة جديدة متاحة! اضغط للتحديث', () => {
            newSW.postMessage('SKIP_WAITING');
            navigator.serviceWorker.addEventListener('controllerchange', () => {
              window.location.reload();
            }, { once: true });
          }, 0);
        }
      });
    });
  }).catch(() => {});
}



function populateSelects() {
  ['smart-chapter', 'quiz-chapter', 'list-chapter'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="all">جميع الفصول</option>';
    STATE.chapters.forEach((ch, i) => {
      sel.innerHTML += `<option value="${i}">${ch.id} - ${ch.title}</option>`;
    });
  });
}

// ============================================================
// FLASHCARD SECTION
// ============================================================
function initFlashcard() {
  renderChapterGrid();
  document.getElementById('flashcard').addEventListener('click', (e) => {
    if (!e.target.closest('.controls')) flipCard();
  });
  document.addEventListener('keydown', (e) => {
    // Don't handle shortcuts when settings modal is open
    if (document.getElementById('settings-modal').classList.contains('visible')) return;
    const flashActive = document.getElementById('tab-flashcard').classList.contains('active');
    const smartActive = document.getElementById('tab-smart').classList.contains('active');
    if (flashActive) {
    if (e.key === ' ') { e.preventDefault(); flipCard(); }
    if (e.key === 'Enter') { e.preventDefault(); markKnown(); }
    if (e.key === '1') selectDifficulty('easy');
    if (e.key === '2') selectDifficulty('medium');
    if (e.key === '3') selectDifficulty('hard');
    if (e.key === 'k' || e.key === 'K') markKnown();
    if (e.key === 'd' || e.key === 'D') markUnknown();
    if (e.key === 'Escape' && STATE.currentChapter !== null) goBack();
    }
    if (smartActive) {
      if (e.key === ' ') { e.preventDefault(); document.getElementById('smart-flashcard').classList.toggle('flipped'); SMART.isFlipped = !SMART.isFlipped; }
      if (e.key === '1') smartSelect('easy');
      if (e.key === '2') smartSelect('medium');
      if (e.key === '3') smartSelect('hard');
      if (e.key === 'k' || e.key === 'K') smartMark('known');
      if (e.key === 'd' || e.key === 'D') smartMark('unknown');
    }
    if (document.getElementById('tab-quiz').classList.contains('active')) {
      if (e.key === 'Enter' && !STATE.quizAnswered && document.getElementById('quiz-view').style.display !== 'none') {
        const opts = document.querySelectorAll('.quiz-option:not(:disabled)');
        if (opts.length > 0) opts[0].click();
      }
    }
  });
}

function getDueTerms(chapterIndex) {
  const chapter = STATE.chapters[chapterIndex];
  const progress = loadProgress();
  const now = Date.now();
  const due = [], newTerms = [];
  chapter.terms.forEach((term, idx) => {
    const key = chapterIndex + '-' + idx;
    const record = progress[key];
    if (!record) { newTerms.push({ term, index: idx, key, isNew: true }); }
    else if (record.nextReview && now >= record.nextReview) { due.push({ term, index: idx, key, isNew: false, record }); }
  });
  return [...newTerms, ...due];
}

function startChapter(chapterIndex) {
  STATE.currentChapter = chapterIndex;
  const due = getDueTerms(chapterIndex);
  if (due.length === 0) {
    // No due terms - show all terms for review anyway
    const chapter = STATE.chapters[chapterIndex];
    const all = chapter.terms.map((term, idx) => {
      const key = chapterIndex + '-' + idx;
      return { term, index: idx, key, isNew: false, record: null };
    });
    STATE.currentTerms = all;
    STATE.sessionStats = { known: 0, unknown: 0, total: all.length };
  } else {
    STATE.currentTerms = due;
    STATE.sessionStats = { known: 0, unknown: 0, total: due.length };
  }
  STATE.currentTermIndex = 0;
  STATE.selectedDifficulty = null;
  STATE.isFlipped = false;
  showFlashcardView();
  renderFlashcard();
}

function renderFlashcard() {
  const data = STATE.currentTerms[STATE.currentTermIndex];
  if (!data) { showCompletion(); return; }
  document.getElementById('flashcard').classList.remove('flipped');
  STATE.isFlipped = false;
  document.getElementById('card-term-en').textContent = data.term.en;
  document.getElementById('card-term-ar').textContent = data.term.ar;
  const p = STATE.currentTermIndex + 1, t = STATE.currentTerms.length;
  document.getElementById('flashcard-progress').textContent = p + ' / ' + t;
  document.querySelectorAll('.diff-dot').forEach(d => d.classList.remove('active'));
  const record = loadProgress()[data.key];
  if (record && record.difficulty) {
    const m = { easy: 0, medium: 1, hard: 2 };
    const idx = m[record.difficulty];
    if (idx !== undefined) document.querySelectorAll('.diff-dot')[idx].classList.add('active');
  }
  STATE.selectedDifficulty = null;
  document.querySelectorAll('.btn-difficulty').forEach(b => b.classList.remove('selected'));
  document.getElementById('btn-know').disabled = false;
  document.getElementById('btn-dont-know').disabled = false;
}

function flipCard() {
  document.getElementById('flashcard').classList.toggle('flipped');
  STATE.isFlipped = !STATE.isFlipped;
}

function selectDifficulty(level) {
  STATE.selectedDifficulty = level;
  document.querySelectorAll('.btn-difficulty').forEach(b => {
    b.classList.toggle('selected', b.dataset.difficulty === level);
  });
}

function markKnown() {
  if (!STATE.isFlipped) {
    flipCard();
    if (!STATE.selectedDifficulty) { showToast('اختر مستوى الصعوبة أولاً'); return; }
    // Difficulty already selected, proceed immediately
  } else if (!STATE.selectedDifficulty) {
    showToast('يرجى اختيار مستوى الصعوبة أولاً');
    return;
  }
  const data = STATE.currentTerms[STATE.currentTermIndex];
  const progress = loadProgress();
  const intervals = { easy: 604800000, medium: 172800000, hard: 86400000 };
  progress[data.key] = {
    difficulty: STATE.selectedDifficulty,
    nextReview: Date.now() + intervals[STATE.selectedDifficulty],
    lastReviewed: Date.now(),
    timesReviewed: (progress[data.key]?.timesReviewed || 0) + 1,
    known: true,
  };
  saveProgress(progress);
  STATE.sessionStats.known++;
  const d = STATE.selectedDifficulty;
  showToast('أحسنت! سيعاد المصطلح بعد ' + (d === 'hard' ? 'يوم' : d === 'medium' ? 'يومين' : 'أسبوع'));
  nextTerm();
}

function markUnknown() {
  if (!STATE.isFlipped) {
    flipCard();
    if (!STATE.selectedDifficulty) { showToast('اختر مستوى الصعوبة أولاً'); return; }
  } else if (!STATE.selectedDifficulty) {
    showToast('يرجى اختيار مستوى الصعوبة أولاً');
    return;
  }
  const data = STATE.currentTerms[STATE.currentTermIndex];
  const progress = loadProgress();
  const intervals = { easy: 604800000, medium: 172800000, hard: 86400000 };
  progress[data.key] = {
    difficulty: STATE.selectedDifficulty,
    nextReview: Date.now() + intervals[STATE.selectedDifficulty],
    lastReviewed: Date.now(),
    timesReviewed: progress[data.key]?.timesReviewed || 0,
    known: false,
  };
  saveProgress(progress);
  STATE.sessionStats.unknown++;
  const d = STATE.selectedDifficulty;
  showToast('سيعاد المصطلح بعد ' + (d === 'hard' ? 'يوم' : d === 'medium' ? 'يومين' : 'أسبوع'));
  nextTerm();
}

function nextTerm() {
  STATE.currentTermIndex++;
  if (STATE.currentTermIndex >= STATE.currentTerms.length) showCompletion();
  else {
    STATE.selectedDifficulty = null;
    STATE.isFlipped = false;
    renderFlashcard();
  }
}

function showCompletion() {
  let totalDue = 0;
  STATE.chapters.forEach((ch, idx) => { totalDue += getDueTerms(idx).length; });
  document.getElementById('completion-known').textContent = STATE.sessionStats.known;
  document.getElementById('completion-unknown').textContent = STATE.sessionStats.unknown;
  document.getElementById('completion-total').textContent = STATE.sessionStats.total;
  document.getElementById('completion-extra').textContent =
    totalDue === 0 ? '🎉 كل البطاقات مكتملة! عد غداً لمراجعة جديدة' : '';
  document.getElementById('flashcard-view').classList.remove('active');
  document.getElementById('completion-view').classList.add('active');
}

function showFlashcardView() {
  document.getElementById('chapter-grid').style.display = 'none';
  document.getElementById('flashcard-view').classList.add('active');
  document.getElementById('completion-view').classList.remove('active');
}

function goBack() {
  STATE.currentChapter = null;
  document.getElementById('chapter-grid').style.display = 'grid';
  document.getElementById('flashcard-view').classList.remove('active');
  document.getElementById('completion-view').classList.remove('active');
  renderChapterGrid();
}

function renderChapterGrid() {
  updateGlobalStats();
  const grid = document.getElementById('chapter-grid');
  grid.innerHTML = '';
  const progress = loadProgress();
  const now = Date.now();
  STATE.chapters.forEach((chapter, index) => {
    const total = chapter.terms.length;
    let reviewed = 0, due = 0;
    chapter.terms.forEach((term, idx) => {
      const key = index + '-' + idx;
      const record = progress[key];
      if (record && record.known) reviewed++;
      if (!record || (record.nextReview && now >= record.nextReview)) due++;
    });
    const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;
    const card = document.createElement('div');
    card.className = 'chapter-card';
    card.innerHTML =
      '<div class="chapter-number">' + chapter.id + '</div>' +
      '<div class="chapter-title">' + chapter.title + '</div>' +
      '<div class="chapter-progress">' +
      '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="chapter-count">' + reviewed + '/' + total + '</span>' +
      (due > 0 ? '<span class="due-badge">' + due + '</span>' : '') +
      '</div>';
    card.addEventListener('click', () => startChapter(index));
    grid.appendChild(card);
  });
}

// ============================================================
// GLOBAL STATS
// ============================================================
function updateGlobalStats() {
  const progress = loadProgress();
  const now = Date.now();
  let reviewed = 0, due = 0;
  STATE.chapters.forEach((ch, i) => {
    ch.terms.forEach((t, j) => {
      const key = i + '-' + j;
      const r = progress[key];
      if (r && r.known) reviewed++;
      if (!r || (r && r.nextReview && now >= r.nextReview)) due++;
    });
  });
}

// ============================================================
// SMART REVIEW
// ============================================================
const SMART = { items: [], index: 0, diff: null, isFlipped: false };

function loadSmartReview() {
  const chVal = document.getElementById('smart-chapter').value;
  const progress = loadProgress();
  const now = Date.now();
  SMART.items = [];

  STATE.chapters.forEach((ch, i) => {
    if (chVal !== 'all' && parseInt(chVal) !== i) return;
    ch.terms.forEach((term, j) => {
      const key = i + '-' + j;
      const record = progress[key];
      const isDue = !record || (record.nextReview && now >= record.nextReview);
      if (isDue) SMART.items.push({ term, chapter: ch.id, chapterIdx: i, termIdx: j, key, record });
    });
  });

  document.getElementById('smart-count').textContent = SMART.items.length;

  if (SMART.items.length === 0) {
    document.getElementById('smart-card-view').style.display = 'none';
    document.getElementById('smart-empty').style.display = 'block';
    return;
  }

  document.getElementById('smart-card-view').style.display = 'flex';
  document.getElementById('smart-empty').style.display = 'none';
  SMART.index = 0;
  SMART.diff = null;
  SMART.isFlipped = false;
  renderSmartCard();
}

function renderSmartCard() {
  if (SMART.index >= SMART.items.length) {
    document.getElementById('smart-card-view').style.display = 'none';
    document.getElementById('smart-empty').style.display = 'block';
    document.getElementById('smart-empty').textContent = '🎉 انتهت المراجعة الذكية لهذا اليوم!';
    return;
  }

  const item = SMART.items[SMART.index];
  const card = document.getElementById('smart-flashcard');
  card.classList.remove('flipped');
  SMART.isFlipped = false;
  SMART.diff = null;

  document.getElementById('smart-term-en').textContent = item.term.en;
  document.getElementById('smart-term-ar').textContent = item.term.ar;
  document.getElementById('smart-progress').textContent = (SMART.index + 1) + ' / ' + SMART.items.length;

  // Meta info
  const meta = document.getElementById('smart-meta');
  let html = '<span style="color:var(--accent-2);font-size:0.8rem">' + item.chapter + '</span>';
  if (item.record && item.record.difficulty) {
    const d = item.record.difficulty;
    html += '<span class="smart-badge ' + d + '">' +
      (d === 'easy' ? '🟢 سهل' : d === 'medium' ? '🟡 متوسط' : '🔴 صعب') + ' سابقاً</span>';
  } else {
    html += '<span class="smart-badge" style="background:rgba(255,255,255,0.08);color:var(--text-muted)">🆕 جديد</span>';
  }
  if (item.record && item.record.known !== undefined) {
    html += '<span style="color:' + (item.record.known ? 'var(--success)' : 'var(--danger)') + ';font-size:0.75rem">' +
      (item.record.known ? '✅ كان معروفاً' : '❌ كان غير معروف') + '</span>';
  }
  meta.innerHTML = html;

  // Reset difficulty
  document.querySelectorAll('#tab-smart .btn-difficulty').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('#tab-smart .diff-dot').forEach(d => d.classList.remove('active'));

  // Show previous difficulty on dots
  if (item.record && item.record.difficulty) {
    const m = { easy: 0, medium: 1, hard: 2 };
    const idx = m[item.record.difficulty];
    if (idx !== undefined) {
      const dots = document.querySelectorAll('#tab-smart .diff-dot');
      dots[idx].classList.add('active');
    }
  }
}

// Flip smart card
document.addEventListener('DOMContentLoaded', function() {
  const sc = document.getElementById('smart-flashcard');
  if (sc) {
    sc.addEventListener('click', function() {
      sc.classList.toggle('flipped');
      SMART.isFlipped = !SMART.isFlipped;
    });
  }
});

function smartSelect(level) {
  SMART.diff = level;
  document.querySelectorAll('#tab-smart .btn-difficulty').forEach(b => {
    b.classList.toggle('selected', b.dataset.difficulty === level);
  });
}

function smartMark(type) {
  if (!SMART.isFlipped) {
    document.getElementById('smart-flashcard').classList.add('flipped');
    SMART.isFlipped = true;
    if (!SMART.diff) { showToast('اختر مستوى الصعوبة أولاً'); return; }
  } else if (!SMART.diff) {
    showToast('يرجى اختيار مستوى الصعوبة أولاً');
    return;
  }

  const item = SMART.items[SMART.index];
  const progress = loadProgress();
  const intervals = { easy: 604800000, medium: 172800000, hard: 86400000 };

  progress[item.key] = {
    difficulty: SMART.diff,
    nextReview: Date.now() + intervals[SMART.diff],
    lastReviewed: Date.now(),
    timesReviewed: (progress[item.key]?.timesReviewed || 0) + 1,
    known: type === 'known',
  };
  saveProgress(progress);

  const d = SMART.diff;
  showToast(type === 'known'
    ? '✅ تم! سيعاد بعد ' + (d === 'hard' ? 'يوم' : d === 'medium' ? 'يومين' : 'أسبوع')
    : '❌ تم! سيعاد بعد ' + (d === 'hard' ? 'يوم' : d === 'medium' ? 'يومين' : 'أسبوع'));

  SMART.index++;
  renderSmartCard();
}

// ============================================================
// QUIZ SECTION
// ============================================================
function updateQuizStart() {
  const chVal = document.getElementById('quiz-chapter').value;
  let total = 0;
  STATE.chapters.forEach((ch, i) => {
    if (chVal !== 'all' && parseInt(chVal) !== i) return;
    total += ch.terms.length;
  });
  const sel = document.getElementById('quiz-count');
  sel.innerHTML = '<option value="all">جميع الأسئلة (' + total + ')</option>';
  const steps = [5, 10, 20];
  for (const s of steps) {
    if (s < total) sel.innerHTML += '<option value="' + s + '">' + s + ' سؤال</option>';
  }
  for (let s = 30; s < total; s += 10) {
    sel.innerHTML += '<option value="' + s + '">' + s + ' سؤال</option>';
  }
}

function startQuiz() {
  const chVal = document.getElementById('quiz-chapter').value;
  const countOpt = document.getElementById('quiz-count').value;
  let pool = [];

  STATE.chapters.forEach((ch, i) => {
    if (chVal !== 'all' && parseInt(chVal) !== i) return;
    ch.terms.forEach((term, j) => {
      pool.push({ term, chapterIdx: i, termIdx: j });
    });
  });

  if (pool.length < 4) { showToast('عدد المصطلحات قليل جداً للاختبار'); return; }

  const count = countOpt === 'all' ? pool.length : parseInt(countOpt);

  // Shuffle and pick
  pool = shuffle(pool);
  STATE.quizQuestions = pool.slice(0, Math.min(count, pool.length));
  STATE.quizIndex = 0;
  STATE.quizCorrect = 0;
  STATE.quizWrong = 0;
  STATE.quizAnswered = false;

  document.getElementById('quiz-controls').style.display = 'none';
  document.getElementById('quiz-view').style.display = 'flex';
  document.getElementById('quiz-result').style.display = 'none';
  renderQuizQuestion();
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function renderQuizQuestion() {
  if (STATE.quizIndex >= STATE.quizQuestions.length) { endQuiz(); return; }
  const q = STATE.quizQuestions[STATE.quizIndex];
  STATE.quizAnswered = false;
  document.getElementById('quiz-progress').textContent = (STATE.quizIndex + 1) + ' / ' + STATE.quizQuestions.length;
  document.getElementById('quiz-score').textContent = '✅ ' + STATE.quizCorrect + ' | ❌ ' + STATE.quizWrong;
  document.getElementById('quiz-term').textContent = q.term.en;
  document.getElementById('quiz-feedback').className = 'quiz-feedback';
  document.getElementById('quiz-feedback').style.display = 'none';

  // Generate options: 1 correct + 3 wrong
  let wrongPool = [];
  STATE.chapters.forEach((ch, i) => {
    ch.terms.forEach((term, j) => {
      if (i === q.chapterIdx && j === q.termIdx) return;
      wrongPool.push(term.ar);
    });
  });
  wrongPool = shuffle(wrongPool).slice(0, 3);
  const options = shuffle([q.term.ar, ...wrongPool]);

  const optsDiv = document.getElementById('quiz-options');
  optsDiv.innerHTML = '';
  options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'quiz-option';
    btn.textContent = opt;
    btn.onclick = function() {
      if (STATE.quizAnswered) return;
      STATE.quizAnswered = true;
      document.querySelectorAll('.quiz-option').forEach(b => b.disabled = true);
      if (opt === q.term.ar) {
        btn.classList.add('correct');
        STATE.quizCorrect++;
        document.getElementById('quiz-feedback').className = 'quiz-feedback correct';
        document.getElementById('quiz-feedback').textContent = '✅ إجابة صحيحة!';
      } else {
        btn.classList.add('wrong');
        STATE.quizWrong++;
        document.getElementById('quiz-feedback').className = 'quiz-feedback wrong';
        document.getElementById('quiz-feedback').textContent = '❌ إجابة خاطئة. الصحيح: ' + q.term.ar;
        document.querySelectorAll('.quiz-option').forEach(b => {
          if (b.textContent === q.term.ar) b.classList.add('correct');
        });
      }
      document.getElementById('quiz-feedback').style.display = 'block';
      setTimeout(function() {
        STATE.quizIndex++;
        renderQuizQuestion();
      }, 1000);
    };
    optsDiv.appendChild(btn);
  });
}

function endQuiz() {
  document.getElementById('quiz-view').style.display = 'none';
  document.getElementById('quiz-result').style.display = 'flex';
  const total = STATE.quizCorrect + STATE.quizWrong;
  const pct = total > 0 ? Math.round((STATE.quizCorrect / total) * 100) : 0;
  document.getElementById('result-correct').textContent = STATE.quizCorrect;
  document.getElementById('result-wrong').textContent = STATE.quizWrong;
  document.getElementById('result-pct').textContent = pct + '%';
  document.getElementById('result-title').textContent = pct >= 80 ? '🎉 ممتاز!' : pct >= 50 ? '👍 جيد!' : '📚 يحتاج مراجعة!';
}

function resetQuiz() {
  document.getElementById('quiz-controls').style.display = 'flex';
  document.getElementById('quiz-view').style.display = 'none';
  document.getElementById('quiz-result').style.display = 'none';
}

// ============================================================
// TERMS LIST SECTION
// ============================================================
function renderTermsList() {
  const chVal = document.getElementById('list-chapter').value;
  const search = document.getElementById('list-search').value.trim().toLowerCase();
  const list = document.getElementById('terms-list');
  list.innerHTML = '';
  let count = 0;

  STATE.chapters.forEach((ch, i) => {
    if (chVal !== 'all' && parseInt(chVal) !== i) return;
    ch.terms.forEach((term, j) => {
      const en = term.en.toLowerCase();
      const ar = term.ar.toLowerCase();
      if (search && !en.includes(search) && !ar.includes(search)) return;
      count++;
      const div = document.createElement('div');
      div.className = 'terms-list-item';
      div.innerHTML =
        '<span class="terms-list-chapter">' + ch.id + '</span>' +
        '<span class="terms-list-ar">' + term.ar + '</span>' +
        '<span class="terms-list-en">' + term.en + '</span>';
      list.appendChild(div);
    });
  });

  if (count === 0) {
    list.innerHTML = '<div class="terms-empty">لا توجد نتائج للبحث</div>';
  }
}

// ============================================================
// STATS SECTION
// ============================================================
function renderStats() {
  const progress = loadProgress();
  const now = Date.now();
  let totalTerms = 0, totalReviewed = 0, totalKnown = 0, totalUnknown = 0, totalDue = 0;
  const chapterStats = [];

  STATE.chapters.forEach((ch, i) => {
    let rev = 0, known = 0, unknown = 0, due = 0;
    ch.terms.forEach((term, j) => {
      totalTerms++;
      const key = i + '-' + j;
      const r = progress[key];
      if (r) {
        rev++;
        totalReviewed++;
        if (r.known) { known++; totalKnown++; }
        else { unknown++; totalUnknown++; }
        if (r.nextReview && now >= r.nextReview) { due++; totalDue++; }
      } else {
        due++;
        totalDue++;
      }
    });
    chapterStats.push({ id: ch.id, title: ch.title, total: ch.terms.length, reviewed: rev, known, unknown, due });
  });

  const mastery = totalReviewed > 0 ? Math.round((totalKnown / totalReviewed) * 100) : 0;
  const overallPct = totalTerms > 0 ? Math.round((totalReviewed / totalTerms) * 100) : 0;

  const grid = document.getElementById('stats-grid');
  grid.innerHTML =
    '<div class="stats-card"><div class="stats-card-icon">📚</div><div class="stats-card-value">' + totalTerms + '</div><div class="stats-card-label">إجمالي المصطلحات</div></div>' +
    '<div class="stats-card"><div class="stats-card-icon">✅</div><div class="stats-card-value">' + totalKnown + '</div><div class="stats-card-label">أعرفها</div></div>' +
    '<div class="stats-card"><div class="stats-card-icon">❌</div><div class="stats-card-value">' + totalUnknown + '</div><div class="stats-card-label">لا أعرفها</div></div>' +
    '<div class="stats-card"><div class="stats-card-icon">⏰</div><div class="stats-card-value">' + totalDue + '</div><div class="stats-card-label">للمراجعة</div></div>' +
    '<div class="stats-card"><div class="stats-card-icon">📊</div><div class="stats-card-value">' + overallPct + '%</div><div class="stats-card-label">نسبة التقدم</div></div>' +
    '<div class="stats-card"><div class="stats-card-icon">🎯</div><div class="stats-card-value">' + mastery + '%</div><div class="stats-card-label">نسبة الإتقان</div></div>';

  const chDiv = document.getElementById('stats-chapters');
  chDiv.innerHTML = '<h3 style="font-size:1rem;margin:16px 0;color:var(--text-secondary)">📈 تفاصيل الفصول</h3>';
  chapterStats.forEach(ch => {
    const pct = ch.total > 0 ? Math.round((ch.reviewed / ch.total) * 100) : 0;
    const item = document.createElement('div');
    item.className = 'stats-chapter-item';
    item.innerHTML =
      '<span class="stats-chapter-name">' + ch.id + '</span>' +
      '<div class="stats-chapter-bar"><div class="stats-chapter-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="stats-chapter-pct">' + pct + '%</span>';
    chDiv.appendChild(item);
  });
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg, onClick, duration) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.onclick = onClick || null;
  toast.style.cursor = onClick ? 'pointer' : 'default';
  toast.classList.add('show');
  clearTimeout(toast._timeout);
  if (duration !== 0) {
    toast._timeout = setTimeout(() => toast.classList.remove('show'), duration || 2500);
  }
}

// ============================================================
// SETTINGS: THEME & USER NAME
// ============================================================
function loadSettings() {
  const theme = localStorage.getItem('genetics_theme') || 'night';
  setTheme(theme);
  const name = localStorage.getItem('genetics_username');
  if (name) {
    document.getElementById('welcome-msg').textContent = 'أهلاً بك ' + name + ' 👋';
    document.getElementById('user-name-input').value = name;
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('genetics_theme', theme);
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === theme);
  });
}

function toggleSettings() {
  const modal = document.getElementById('settings-modal');
  const overlay = document.getElementById('settings-overlay');
  const opening = !modal.classList.contains('visible');
  modal.classList.toggle('visible');
  overlay.classList.toggle('visible');
  if (opening) {
    setTimeout(() => document.getElementById('user-name-input').focus(), 100);
  }
}

function resetAllProgress() {
  if (confirm('هل أنت متأكد من مسح جميع النتائج؟ سيتم فقدان كل التقدم ولن يمكن التراجع.')) {
    localStorage.removeItem(STORAGE_KEY);
    STATE.sessionStats = { known: 0, unknown: 0, total: 0 };
    showToast('✅ تم مسح جميع النتائج');
    if (document.getElementById('tab-stats').classList.contains('active')) renderStats();
    if (document.getElementById('tab-flashcard').classList.contains('active')) initFlashcard();
  }
}

function saveUserName() {
  const name = document.getElementById('user-name-input').value.trim();
  if (name) {
    localStorage.setItem('genetics_username', name);
    document.getElementById('welcome-msg').textContent = 'أهلاً بك ' + name + ' 👋';
    showToast('✅ تم حفظ الاسم');
    toggleSettings();
  } else {
    showToast('يرجى إدخال اسم');
  }
}

// Enter key in name input saves
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('user-name-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      saveUserName();
    }
  });
});

// Load settings on init
document.addEventListener('DOMContentLoaded', function() {
  loadSettings();
});
