(function () {
  const editor = document.getElementById('editor');
  const caret = document.getElementById('caret');
  const editorWrap = document.getElementById('editor-wrap');
  const titleInput = document.getElementById('title-input');
  const wordCountEl = document.getElementById('word-count');
  const saveStatusEl = document.getElementById('save-status');
  const fileInput = document.getElementById('file-input');

  const modal = document.getElementById('confirm-modal');
  const modalConfirm = document.getElementById('modal-confirm');
  const modalCancel = document.getElementById('modal-cancel');

  const fadeOverlay = document.getElementById('fade-overlay');

  const STORAGE_KEY = 'chilling-typing:draft';
  const THEME_KEY = 'chilling-typing:theme';

  /* ========== THEME + VIEW TRANSITION ========== */
  const MOON_ICON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  const SUN_ICON = '<circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22"/><line x1="4.22" y1="4.22" x2="5.94" y2="5.94"/><line x1="18.06" y1="18.06" x2="19.78" y2="19.78"/><line x1="2" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22" y2="12"/><line x1="4.22" y1="19.78" x2="5.94" y2="18.06"/><line x1="18.06" y1="5.94" x2="19.78" y2="4.22"/>';

  function updateThemeIcon(theme) {
    const iconEl = document.getElementById('theme-icon');
    if (iconEl) iconEl.innerHTML = theme === 'dark' ? MOON_ICON : SUN_ICON;
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeIcon(theme);
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
  let isComposing = false;
  let isFalling = false;

  // Khi gõ tiếng Việt qua bộ gõ hệ thống (Telex/VNI), trình duyệt có thể phát
  // sự kiện composition. Nếu ta chèn/xoá node đánh dấu (marker) để đo vị trí
  // con trỏ ngay trong lúc đang composing, nó có thể làm hỏng quá trình gõ
  // dấu. Vì vậy tạm dừng cập nhật con trỏ ảo cho tới khi composition kết thúc.
  editor.addEventListener('compositionstart', () => { isComposing = true; });
  editor.addEventListener('compositionend', () => {
    isComposing = false;
    scheduleCaretUpdate();
  });

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

  function getEmptyEditorCaretRect() {
    // Editor không có node con thật nào — nếu chèn marker vào đây để đo, nó
    // sẽ nằm SAU nội dung placeholder (::before luôn render trước mọi node
    // con thật), khiến con trỏ ảo bị tính lệch ra sau chữ "Bắt đầu gõ...".
    // Vì vậy tự suy ra điểm bắt đầu của vùng nội dung từ padding/border của
    // chính editor, không cần chèn gì vào DOM cả.
    const box = editor.getBoundingClientRect();
    const cs = getComputedStyle(editor);
    const left = box.left + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.paddingLeft) || 0);
    const top = box.top + (parseFloat(cs.borderTopWidth) || 0) + (parseFloat(cs.paddingTop) || 0);
    const lineHeight = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.2;
    return { left: left, top: top, width: 0, height: lineHeight };
  }

  function getCaretRect() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;

    if (editor.textContent.length === 0) {
      return getEmptyEditorCaretRect();
    }

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
    if (isComposing || isFalling) return;
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

    if (isTyping) {
      scrollToBottom();
    }
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

  /* ========== MODAL ========== */
  let pendingClear = false;

  function openModal() {
    document.body.classList.add('modal-open');
    modal.classList.add('active');
    caret.classList.add('hidden');
  }

  function closeModal() {
    document.body.classList.remove('modal-open');
    modal.classList.remove('active');

    // Nếu người dùng vừa bấm "Xóa" (xác nhận), fallDown()/performClear() sẽ
    // tự tắt cờ isFalling và focus lại editor sau hiệu ứng rơi chữ — không
    // cần làm ở đây nữa.
    if (pendingClear) {
      pendingClear = false;
      return;
    }

    // Người dùng huỷ (Hủy / bấm ra ngoài / Esc): huỷ cờ ẩn caret và focus
    // lại editor để caret hiện lại như trước khi mở modal.
    isFalling = false;

    // Bấm nút mở modal (icon-btn) luôn kéo focus khỏi editor trước đó, nên
    // "document.activeElement === editor" gần như không bao giờ đúng ở đây.
    // Vì vậy luôn chủ động focus lại editor khi đóng modal (Hủy / bấm ra
    // ngoài / Esc), để con trỏ ảo và khả năng gõ tiếp quay lại ngay.
    setTimeout(() => {
      editor.focus();
      caret.classList.remove('hidden');
      if (!isTyping) setCaretBlink(true);
      scheduleCaretUpdate();
    }, 350);
  }

  /* ========== HIỆU ỨNG RƠI: lấy vị trí từng từ ========== */
  const appEl = document.getElementById('app');

  function waitForAppSettle(callback) {
    let done = false;
    function finish() {
      if (done) return;
      done = true;
      appEl.removeEventListener('transitionend', onTransitionEnd);
      callback();
    }
    function onTransitionEnd(e) {
      if (e.target === appEl && e.propertyName === 'transform') finish();
    }
    appEl.addEventListener('transitionend', onTransitionEnd);
    // Lưới an toàn: nếu vì lý do gì đó transitionend không bắn ra (ví dụ
    // #app không thực sự đổi transform), vẫn chạy hiệu ứng sau một khoảng
    // dự phòng thay vì treo vô thời hạn.
    setTimeout(finish, 500);
  }

  function fallDown() {
    // Caret đã được ẩn từ lúc bấm icon xoá (xem listener btn-clear); ở đây
    // chỉ tái khẳng định cho chắc, phòng khi có gì đó lỡ hiện lại trong
    // lúc chờ #app settle.
    isFalling = true;
    if (caretRaf) { cancelAnimationFrame(caretRaf); caretRaf = null; }
    caret.classList.add('hidden');

    const content = editor.innerHTML.trim();
    if (!content) {
      isFalling = false;
      performClear();
      return;
    }

    // Lấy tất cả text nodes trong editor
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, null, false);
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    if (textNodes.length === 0) {
      isFalling = false;
      performClear();
      return;
    }

    const screenHeight = window.innerHeight;
    const editorScrollHeight = editor.scrollHeight;

    // Tạo các span cho từng từ
    const words = [];
    for (const textNode of textNodes) {
      const text = textNode.textContent;
      // Tách từ bằng regex (giữ dấu câu)
      const tokens = text.match(/\S+|\s+/g) || [];
      let charIndex = 0;
      for (const token of tokens) {
        if (token.trim().length === 0) {
          // Khoảng trắng: bỏ qua
          charIndex += token.length;
          continue;
        }
        const start = charIndex;
        const end = start + token.length;
        const range = document.createRange();
        range.setStart(textNode, start);
        range.setEnd(textNode, end);
        const rect = range.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          words.push({
            text: token,
            rect: rect,
          });
        }
        charIndex = end;
      }
    }

    if (words.length === 0) {
      isFalling = false;
      performClear();
      return;
    }

    // Xóa overlay cũ
    fadeOverlay.innerHTML = '';
    fadeOverlay.classList.add('active');

    const computedStyle = getComputedStyle(editor);
    const fontSize = computedStyle.fontSize;
    const fontWeight = computedStyle.fontWeight;
    const color = computedStyle.color;
    const fontFamily = computedStyle.fontFamily;

    // Tạo span cho từng từ và thêm animation
    for (const word of words) {
      const span = document.createElement('span');
      span.className = 'word';
      span.textContent = word.text;
      span.style.left = word.rect.left + 'px';
      span.style.top = word.rect.top + 'px';
      span.style.fontSize = fontSize;
      span.style.fontWeight = fontWeight;
      span.style.color = color;
      span.style.fontFamily = fontFamily;
      // Không copy line-height lớn của editor sang đây: toạ độ `top` được
      // đo bằng range.getBoundingClientRect() là mép sát chữ, không tính
      // phần đệm dòng (leading). Nếu span có line-height lớn, trình duyệt
      // sẽ tự chèn thêm đệm phía trên để canh giữa dòng theo chiều dọc,
      // đẩy chữ lệch xuống dưới so với vị trí chữ gốc. line-height: 1 giữ
      // chữ sát đúng vị trí đã đo.
      span.style.lineHeight = '1';

      const delay = Math.random() * 0.5;
      const duration = 0.8 + Math.random() * 0.6;
      const tx = (Math.random() - 0.5) * 200;
      const ty = screenHeight + editorScrollHeight + 200 + Math.random() * 200;
      const rot = (Math.random() - 0.5) * 50;

      span.style.animation = `fall-down ${duration}s ease-in ${delay}s forwards`;
      span.style.setProperty('--tx', tx + 'px');
      span.style.setProperty('--ty', ty + 'px');
      span.style.setProperty('--rot', rot + 'deg');

      fadeOverlay.appendChild(span);
    }

    // Ẩn editor
    editor.style.opacity = '0';
    editor.style.transition = 'opacity 0.15s ease';

    const maxDuration = 500 + 1400 + 100;
    setTimeout(() => {
      fadeOverlay.classList.remove('active');
      fadeOverlay.innerHTML = '';
      editor.style.opacity = '1';
      isFalling = false;
      performClear();
    }, maxDuration);
  }

  /* ========== CLEAR ALL ========== */
  function performClear() {
    editor.innerHTML = '';
    titleInput.value = '';
    localStorage.removeItem(STORAGE_KEY);
    updateWordCount();
    updateEmptyState();

    // Tắt transition của caret
    caret.style.transition = 'none';

    editor.focus();
    const textNode = document.createTextNode('');
    editor.appendChild(textNode);
    const range = document.createRange();
    range.setStart(textNode, 0);
    range.collapse(true);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    updateCaret();

    requestAnimationFrame(() => {
      caret.style.transition = '';
    });

    editorWrap.scrollTop = 0;

    saveStatusEl.textContent = 'Đã tạo mới';
    setTimeout(() => { saveStatusEl.textContent = ''; }, 1500);
  }

  document.getElementById('btn-clear').addEventListener('click', () => {
    // Ẩn caret ngay từ lúc bấm icon xoá, không đợi tới khi bấm xác nhận —
    // để không còn khoảng hở nào (lúc modal đang mở, đang chờ #app settle,
    // hay lúc chữ đang rơi) mà một sự kiện nào đó có thể làm caret hiện
    // lại giữa chừng.
    isFalling = true;
    if (caretRaf) { cancelAnimationFrame(caretRaf); caretRaf = null; }
    caret.classList.add('hidden');
    openModal();
  });

  modalConfirm.addEventListener('click', () => {
    pendingClear = true;
    closeModal();
    // #app đang bị scale(0.96)+blur do modal (xem CSS `body.modal-open #app`).
    // Khi đóng modal, nó animate quay lại kích thước gốc trong 0.35s. Nếu ta
    // đo vị trí từng chữ (fallDown) trước khi transition này thực sự kết
    // thúc, toạ độ đo được sẽ ứng với lúc #app còn đang scale dở — khiến
    // các chữ "rơi" bị lệch khỏi vị trí chữ gốc. Đợi đúng transitionend của
    // transform thay vì đoán một khoảng thời gian cố định.
    waitForAppSettle(fallDown);
  });

  modalCancel.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
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
    wordCountEl.textContent = n + ' từ';
  }

  // CSS `:empty` chỉ đúng khi editor không còn bất kỳ node con nào — nhưng
  // contenteditable thường để sót lại một text node rỗng hoặc một thẻ <br>
  // sau khi xoá hết chữ (kể cả text node rỗng mà performClear() tự tạo để
  // đặt con trỏ). Khi đó :empty sai, và dòng chữ mờ "Bắt đầu gõ..." không
  // hiện lại nữa dù nhìn vào thì editor trống trơn. Dùng textContent để
  // kiểm tra chính xác, và bật/tắt bằng class thay vì chỉ dựa vào :empty.
  function updateEmptyState() {
    const isEmpty = editor.textContent.trim().length === 0;
    editor.classList.toggle('is-empty', isEmpty);
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

  function refreshDerivedState() {
    updateWordCount();
    updateEmptyState();
  }

  editor.addEventListener('input', () => { refreshDerivedState(); scheduleAutosave(); });
  titleInput.addEventListener('input', scheduleAutosave);

  loadDraft();
  refreshDerivedState();

  /* ========== DOWNLOAD / UPLOAD ========== */
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
        refreshDerivedState();
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
    setTimeout(() => { scrollToBottom(); }, 50);
  });
})();