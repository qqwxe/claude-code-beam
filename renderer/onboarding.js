const TUTORIAL_SELECTORS = [
  '.searchbar',
  '#refresh-btn',
  '.list-card',
  '#device-card',
  '#send-target-card',
  '[data-tab="receive"]',
];

let tutorialStep = 0;

function populateLangGrid(filter) {
  const grid = document.getElementById('lang-grid');
  grid.innerHTML = '';
  const f = (filter || '').trim().toLowerCase();
  const items = WORLD_LANGUAGES.filter((l) => !f || l.name.toLowerCase().includes(f) || l.code.includes(f));
  if (items.length === 0) {
    grid.innerHTML = '<div class="empty-hint">-</div>';
    return;
  }
  for (const l of items) {
    const item = document.createElement('div');
    item.className = 'lang-item';
    item.innerHTML = `<span class="fi fi-${l.flagCode} lang-flag"></span><span class="lang-name">${l.name}</span>`;
    item.addEventListener('click', () => selectLanguage(l.code));
    grid.appendChild(item);
  }
}

function selectLanguage(code) {
  localStorage.setItem('cst_lang', code);
  document.getElementById('lang-overlay').classList.add('hidden');
  applyStaticTranslations();
  if (typeof renderSessions === 'function') renderSessions();
  if (typeof pollDevices === 'function') pollDevices();
  if (!localStorage.getItem('cst_tutorial_done')) {
    setTimeout(startTutorial, 450);
  }
}

function positionSpotlight(rect) {
  const pad = 8;
  const spotlight = document.getElementById('tutorial-spotlight');
  spotlight.style.top = `${rect.top - pad}px`;
  spotlight.style.left = `${rect.left - pad}px`;
  spotlight.style.width = `${rect.width + pad * 2}px`;
  spotlight.style.height = `${rect.height + pad * 2}px`;
}

function positionDialog(rect) {
  const dialog = document.getElementById('tutorial-dialog');
  const margin = 14;
  requestAnimationFrame(() => {
    const dRect = dialog.getBoundingClientRect();
    let top = rect.bottom + margin;
    if (top + dRect.height > window.innerHeight - 20) {
      top = rect.top - margin - dRect.height;
    }
    top = Math.max(16, Math.min(top, window.innerHeight - dRect.height - 16));
    let left = rect.left + rect.width / 2 - dRect.width / 2;
    left = Math.max(16, Math.min(left, window.innerWidth - dRect.width - 16));
    dialog.style.top = `${top}px`;
    dialog.style.left = `${left}px`;
  });
}

function showTutorialStep(index) {
  const selector = TUTORIAL_SELECTORS[index];
  const target = document.querySelector(selector);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  positionSpotlight(rect);
  positionDialog(rect);

  const steps = tSteps();
  document.getElementById('tutorial-text').textContent = steps[index];
  document.getElementById('tutorial-progress').textContent = t('tutorialStepOf', index + 1, steps.length);
  document.getElementById('tutorial-next').textContent = index === steps.length - 1 ? t('tutorialDone') : t('tutorialNext');
}

function startTutorial() {
  const sendTab = document.querySelector('[data-tab="send"]');
  if (sendTab && !sendTab.classList.contains('active')) sendTab.click();
  tutorialStep = 0;
  showTutorialStep(tutorialStep);
  document.getElementById('tutorial-overlay').classList.remove('hidden');
}

function endTutorial() {
  document.getElementById('tutorial-overlay').classList.add('hidden');
  localStorage.setItem('cst_tutorial_done', '1');
}

document.getElementById('tutorial-next').addEventListener('click', () => {
  const steps = tSteps();
  if (tutorialStep >= steps.length - 1) {
    endTutorial();
    return;
  }
  tutorialStep++;
  showTutorialStep(tutorialStep);
});

document.getElementById('tutorial-skip').addEventListener('click', endTutorial);
document.getElementById('tutorial-replay-btn').addEventListener('click', startTutorial);
document.getElementById('lang-search').addEventListener('input', (e) => populateLangGrid(e.target.value));

window.addEventListener('resize', () => {
  if (!document.getElementById('tutorial-overlay').classList.contains('hidden')) {
    showTutorialStep(tutorialStep);
  }
});

function initOnboarding() {
  populateLangGrid('');
  applyStaticTranslations();
  const lang = localStorage.getItem('cst_lang');
  if (!lang) {
    document.getElementById('lang-overlay').classList.remove('hidden');
  } else if (!localStorage.getItem('cst_tutorial_done')) {
    setTimeout(startTutorial, 700);
  }
}

initOnboarding();
