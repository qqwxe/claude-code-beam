let _projectConfirmResolve = null;

function closeProjectConfirm(result) {
  document.getElementById('project-confirm-overlay').classList.add('hidden');
  if (_projectConfirmResolve) {
    _projectConfirmResolve(result);
    _projectConfirmResolve = null;
  }
}

document.getElementById('project-confirm-cancel').addEventListener('click', () => closeProjectConfirm(null));
document.getElementById('project-confirm-continue').addEventListener('click', () => {
  const checked = Array.from(document.querySelectorAll('#project-confirm-list input[type="checkbox"]:checked'));
  closeProjectConfirm(checked.map((cb) => cb.dataset.cwd));
});

function askIncludeProjects(cwdList) {
  const listEl = document.getElementById('project-confirm-list');
  listEl.innerHTML = '';

  for (const cwd of cwdList) {
    const item = document.createElement('label');
    item.className = 'project-confirm-item';
    item.innerHTML = `
      <input type="checkbox" data-cwd="${escapeHtml(cwd)}" />
      <div class="pc-meta">
        <div class="pc-path">${escapeHtml(cwd)}</div>
        <div class="pc-size">${escapeHtml(t('projectSizeLoading'))}</div>
      </div>
    `;
    listEl.appendChild(item);

    window.api.getFolderSize(cwd).then(
      (info) => {
        item.querySelector('.pc-size').textContent = t('projectSizeInfo', info.fileCount, fmtSize(info.totalBytes));
      },
      () => {
        const cb = item.querySelector('input');
        cb.checked = false;
        cb.disabled = true;
        item.querySelector('.pc-size').textContent = t('projectFolderMissing');
        item.classList.add('disabled');
      }
    );
  }

  document.getElementById('project-confirm-overlay').classList.remove('hidden');
  return new Promise((resolve) => {
    _projectConfirmResolve = resolve;
  });
}
