document.getElementById('win-minimize').addEventListener('click', () => window.api.windowMinimize());
document.getElementById('win-close').addEventListener('click', () => window.api.windowClose());

const maximizeBtn = document.getElementById('win-maximize');
maximizeBtn.addEventListener('click', () => window.api.windowMaximizeToggle());

function setMaximizedIcon(isMax) {
  maximizeBtn.innerHTML = isMax
    ? '<svg viewBox="0 0 12 12" width="11" height="11"><rect x="2.6" y="1.2" width="8.2" height="8.2" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="1.2" y="2.6" width="8.2" height="8.2" rx="1" fill="var(--bg)" stroke="currentColor" stroke-width="1.2"/></svg>'
    : '<svg viewBox="0 0 12 12" width="11" height="11"><rect x="1.2" y="1.2" width="9.6" height="9.6" rx="1" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>';
}

window.api.windowIsMaximized().then(setMaximizedIcon);
window.api.onWindowMaximizedChanged(setMaximizedIcon);
