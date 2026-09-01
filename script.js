(function () {
  const editor = document.getElementById('editor');
  const caret = document.getElementById('caret');
  const editorWrap = document.getElementById('editor-wrap');
  const titleInput = document.getElementById('title-input');
  const wordCountEl = document.getElementById('word-count');
  const saveStatusEl = document.getElementById('save-status');
  const fileInput = document.getElementById('file-input');

  const STORAGE_KEY = 'chilling-typing:draft';
  const THEME_KEY = 'chilling-typing:theme';

  /* ========== THEME + VIEW TRANSITION ========== */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  document.getElementById('btn-theme').addEventListener('click', (e) => {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    document.documentElement.style.setProperty('--reveal-x', x + 'px');
    document.documentElement.style.setProperty('--reveal-y', y + 'px');

    if (document.startViewTransition) {
      document.startViewTransition(() => applyTheme(next));
    } else {
      applyTheme(next);
    }
  });

  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');

  /* ========== DYNAMIC CARET ========== */
  let isTyping = false;
  let typingTimer = null;
  let lastCaretPos = { left: 0, top: 0, height: 20 };

  function setCaretBlink(blink) {
    if (blink) caret.classList.add('blink');
    else caret.classList.remove('blink');
  }

  editor.addEventListener('keydown', () => {
    isTyping = true;
    clearTimeout(typingTimer);
    setCaretBlink(false);
  });

  editor.addEventListener('keyup', () => {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => {
      isTyping = false;
      setCaretBlink(true);
    }, 300);
  });

  editor.addEventListener('focus', () => {
    if (!isTyping) setCaretBlink(true);
    scheduleCaretUpdate();
  });
  editor.addEventListener('blur', () => {
    setCaretBlink(false);
    caret.classList.add('hidden');
  });

  function getCaretRect() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0).cloneRange();
    range.collapse(true);

    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    range.insertNode(marker);
    const rect = marker.getBoundingClientRect();
    const parent = marker.parentNode;
    parent.removeChild(marker);
    parent.normalize();

    if (!rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0)) {
      return null;
    }
    return rect;
  }

  function scrollToBottom() {
    editorWrap.scrollTop = editorWrap.scrollHeight;
  }

  function updateCaret() {
    if (document.activeElement !== editor) {
      caret.classList.add('hidden');
      return;
    }
    const rect = getCaretRect();
    if (!rect) {
      if (lastCaretPos.left === 0 && lastCaretPos.top === 0) {
        caret.classList.add('hidden');
      }
      return;
    }
    caret.classList.remove('hidden');
    const height = Math.max(rect.height, 20);
    caret.style.left = rect.left + 'px';
    caret.style.top = rect.top + 'px';
    caret.style.height = height + 'px';
    lastCaretPos = { left: rect.left, top: rect.top, height: height };

    scrollToBottom();
  }

  let caretRaf = null;
  function scheduleCaretUpdate() {
    if (caretRaf) cancelAnimationFrame(caretRaf);
    caretRaf = requestAnimationFrame(updateCaret);
  }

  document.addEventListener('selectionchange', () => {
    if (document.activeElement === editor) scheduleCaretUpdate();
  });
  editor.addEventListener('input', scheduleCaretUpdate);
  editor.addEventListener('click', scheduleCaretUpdate);
  editorWrap.addEventListener('scroll', scheduleCaretUpdate);
  window.addEventListener('resize', scheduleCaretUpdate);

  /* ========== CLEAR ALL (Tạo mới) ========== */
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('Bạn có chắc muốn xóa toàn bộ nội dung? (không thể khôi phục)')) {
      editor.innerHTML = '';
      titleInput.value = '';
      localStorage.removeItem(STORAGE_KEY);
      updateWordCount();
      editor.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      scheduleCaretUpdate();
      editorWrap.scrollTop = 0;
      saveStatusEl.textContent = 'Đã tạo mới';
      setTimeout(() => { saveStatusEl.textContent = ''; }, 1500);
    }
  });

  /* ========== WORD COUNT ========== */
  function countWords(text) {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).length;
  }

  function updateWordCount() {
    const text = editor.innerText || '';
    const n = countWords(text);
    wordCountEl.textContent = n + (n === 1 ? ' từ' : ' từ');
  }

  /* ========== AUTOSAVE ========== */
  let saveTimer = null;
  function scheduleAutosave() {
    clearTimeout(saveTimer);
    saveStatusEl.textContent = '';
    saveTimer = setTimeout(() => {
      const data = { title: titleInput.value, content: editor.innerHTML };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        saveStatusEl.textContent = 'Đã lưu';
        setTimeout(() => { saveStatusEl.textContent = ''; }, 1400);
      } catch (err) {
        saveStatusEl.textContent = 'Không thể lưu tạm';
      }
    }, 500);
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.title) titleInput.value = data.title;
      if (data.content) editor.innerHTML = data.content;
    } catch (err) { /* ignore */ }
  }

  editor.addEventListener('input', () => { updateWordCount(); scheduleAutosave(); });
  titleInput.addEventListener('input', scheduleAutosave);

  loadDraft();
  updateWordCount();

  /* ========== DOWNLOAD / UPLOAD .chill ========== */
  document.getElementById('btn-download').addEventListener('click', () => {
    const title = titleInput.value.trim() || 'untitled';
    const data = { title: title, content: editor.innerHTML };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title.replace(/[\\/:*?"<>|]/g, '_') + '.chill';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  document.getElementById('btn-upload').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        titleInput.value = data.title || '';
        editor.innerHTML = data.content || '';
        updateWordCount();
        scheduleAutosave();
        editorWrap.scrollTop = 0;
        scheduleCaretUpdate();
      } catch (err) {
        alert('File .chill không hợp lệ.');
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  /* ========== AUTOFOCUS ========== */
  editor.addEventListener('click', () => editor.focus());
  window.addEventListener('load', () => {
    editor.focus();
    setCaretBlink(true);
    scheduleCaretUpdate();
    if (editor.innerHTML.trim().length > 0) {
      editorWrap.scrollTop = editorWrap.scrollHeight;
    }
  });

  /* ========== PASTE PLAIN TEXT ========== */
  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain');
    document.execCommand('insertText', false, text);
  });
})();