(function () {
  const editor = document.getElementById('editor');
  const caret = document.getElementById('caret');
  const editorWrap = document.getElementById('editor-wrap');
  const titleInput = document.getElementById('title-input');
  const wordCountEl = document.getElementById('word-count');
  const saveStatusEl = document.getElementById('save-status');
  const musicPanel = document.getElementById('music-panel');
  const musicUrlInput = document.getElementById('music-url');
  const musicDrop = document.getElementById('music-drop');
  const musicFileInput = document.getElementById('music-file');
  const musicPlayerArea = document.getElementById('music-player-area');
  const playlistContainer = document.getElementById('playlist-container');
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

  /* ========== DYNAMIC CARET - cải tiến mượt mà ========== */
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
    // Cuộn xuống cuối vùng soạn thảo
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

    // Tự động cuộn xuống khi viết
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
      // Xóa nội dung editor
      editor.innerHTML = '';
      // Xóa tiêu đề
      titleInput.value = '';
      // Xóa lưu tạm
      localStorage.removeItem(STORAGE_KEY);
      // Cập nhật số từ
      updateWordCount();
      // Đưa con trỏ về đầu
      editor.focus();
      // Đặt caret ở đầu
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      // Cập nhật caret và cuộn lên đầu
      scheduleCaretUpdate();
      editorWrap.scrollTop = 0;
      // Hiển thị thông báo
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
        // Cuộn lên đầu sau khi tải
        editorWrap.scrollTop = 0;
        scheduleCaretUpdate();
      } catch (err) {
        alert('File .chill không hợp lệ.');
      }
    };
    reader.readAsText(file);
    fileInput.value = '';
  });

  /* ========== MUSIC PLAYER - nâng cao + playlist ========== */
  let playlist = [];
  let currentAudio = null;
  let currentIndex = -1;
  let isPlaying = false;

  const playlistEl = playlistContainer;

  function renderPlaylist() {
    playlistEl.innerHTML = '';
    playlist.forEach((item, idx) => {
      const div = document.createElement('div');
      div.className = 'playlist-item' + (idx === currentIndex ? ' active' : '');
      div.innerHTML = `
        <span>${item.label || item.name || 'Bài hát'}</span>
        <button class="pl-remove" data-index="${idx}">✕</button>
      `;
      div.addEventListener('click', (e) => {
        if (e.target.classList.contains('pl-remove')) return;
        playItem(idx);
      });
      div.querySelector('.pl-remove').addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(e.target.dataset.index);
        removeFromPlaylist(index);
      });
      playlistEl.appendChild(div);
    });
  }

  function addToPlaylist(item) {
    playlist.push(item);
    renderPlaylist();
    if (currentIndex === -1) {
      playItem(playlist.length - 1);
    }
  }

  function removeFromPlaylist(index) {
    if (index === currentIndex) {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.src = '';
        currentAudio = null;
      }
      isPlaying = false;
      currentIndex = -1;
      musicPlayerArea.innerHTML = '';
    } else if (index < currentIndex) {
      currentIndex--;
    }
    playlist.splice(index, 1);
    renderPlaylist();
    if (playlist.length === 0) {
      musicPlayerArea.innerHTML = '';
      currentIndex = -1;
    } else if (currentIndex === -1 && playlist.length > 0) {
      playItem(0);
    }
  }

  function playItem(index) {
    if (index < 0 || index >= playlist.length) return;
    const item = playlist[index];
    currentIndex = index;
    renderPlaylist();

    if (item.type === 'iframe') {
      musicPlayerArea.innerHTML = `
        <div class="custom-player">
          <div class="track-info">
            <span>${item.label || 'YouTube / SoundCloud'}</span>
            <button class="remove-btn" id="stop-iframe-btn">✕ Dừng</button>
          </div>
          <iframe src="${item.src}" 
                  style="width:100%; height:80px; border:none; border-radius:8px;" 
                  allow="autoplay; encrypted-media" 
                  sandbox="allow-scripts allow-same-origin allow-forms"
                  loading="lazy">
          </iframe>
        </div>
      `;
      document.getElementById('stop-iframe-btn').addEventListener('click', () => {
        musicPlayerArea.innerHTML = '';
        currentIndex = -1;
        renderPlaylist();
      });
      return;
    }

    const audio = new Audio(item.src);
    currentAudio = audio;
    isPlaying = false;

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-player';
    wrapper.innerHTML = `
      <div class="track-info">
        <span>${item.label || item.name || 'Bài hát'}</span>
        <button class="remove-btn" id="stop-audio-btn">✕ Dừng</button>
      </div>
      <div class="controls">
        <button id="play-pause-btn">▶</button>
        <span class="time-display" id="time-display">0:00 / 0:00</span>
        <input type="range" id="progress-slider" min="0" max="1000" value="0" />
      </div>
    `;
    musicPlayerArea.innerHTML = '';
    musicPlayerArea.appendChild(wrapper);

    const playPauseBtn = document.getElementById('play-pause-btn');
    const timeDisplay = document.getElementById('time-display');
    const progressSlider = document.getElementById('progress-slider');

    audio.addEventListener('loadedmetadata', () => {
      timeDisplay.textContent = `0:00 / ${formatTime(audio.duration)}`;
      progressSlider.max = 1000;
    });

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 1000;
        progressSlider.value = percent;
        timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
      }
    });

    audio.addEventListener('ended', () => {
      isPlaying = false;
      playPauseBtn.textContent = '▶';
      const nextIndex = currentIndex + 1;
      if (nextIndex < playlist.length) {
        playItem(nextIndex);
      } else {
        musicPlayerArea.innerHTML = '';
        currentIndex = -1;
        renderPlaylist();
      }
    });

    playPauseBtn.addEventListener('click', () => {
      if (isPlaying) {
        audio.pause();
        isPlaying = false;
        playPauseBtn.textContent = '▶';
      } else {
        audio.play().catch(() => {});
        isPlaying = true;
        playPauseBtn.textContent = '⏸';
      }
    });

    progressSlider.addEventListener('input', () => {
      if (audio.duration) {
        const percent = progressSlider.value / 1000;
        audio.currentTime = percent * audio.duration;
      }
    });

    document.getElementById('stop-audio-btn').addEventListener('click', () => {
      audio.pause();
      audio.src = '';
      currentAudio = null;
      isPlaying = false;
      musicPlayerArea.innerHTML = '';
      currentIndex = -1;
      renderPlaylist();
    });

    audio.play().then(() => {
      isPlaying = true;
      playPauseBtn.textContent = '⏸';
    }).catch(() => {});
  }

  function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function handleUrl(rawUrl) {
    try {
      const url = new URL(rawUrl.trim());
      let embedSrc = null;
      let label = '';

      if (url.hostname.includes('youtube.com') || url.hostname === 'youtu.be') {
        let videoId = null;
        if (url.hostname === 'youtu.be') {
          videoId = url.pathname.slice(1);
        } else if (url.searchParams.get('v')) {
          videoId = url.searchParams.get('v');
        } else if (url.pathname.startsWith('/embed/')) {
          videoId = url.pathname.split('/embed/')[1];
        }
        if (videoId) {
          embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1&showinfo=0&controls=1&iv_load_policy=3`;
          label = 'YouTube: ' + videoId;
        }
      } else if (url.hostname.includes('soundcloud.com')) {
        embedSrc = 'https://w.soundcloud.com/player/?url=' + encodeURIComponent(url.href) + '&color=%23a9e0c9&auto_play=false&show_comments=false';
        label = 'SoundCloud';
      }

      if (embedSrc) {
        addToPlaylist({ type: 'iframe', src: embedSrc, label: label });
        musicUrlInput.value = '';
        return true;
      } else {
        alert('Chỉ hỗ trợ link YouTube hoặc SoundCloud.');
        return false;
      }
    } catch (err) {
      alert('Link không hợp lệ.');
      return false;
    }
  }

  musicUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleUrl(musicUrlInput.value);
  });

  function handleAudioFiles(files) {
    for (const file of files) {
      if (!file.type.startsWith('audio/')) continue;
      const url = URL.createObjectURL(file);
      addToPlaylist({ type: 'audio', src: url, label: file.name, name: file.name });
    }
    musicFileInput.value = '';
  }

  musicDrop.addEventListener('click', () => musicFileInput.click());
  musicFileInput.addEventListener('change', () => handleAudioFiles(musicFileInput.files));

  musicDrop.addEventListener('dragover', (e) => { e.preventDefault(); musicDrop.classList.add('dragover'); });
  musicDrop.addEventListener('dragleave', () => musicDrop.classList.remove('dragover'));
  musicDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    musicDrop.classList.remove('dragover');
    handleAudioFiles(e.dataTransfer.files);
  });

  /* ========== TOGGLE MUSIC PANEL ========== */
  document.getElementById('btn-music').addEventListener('click', () => {
    musicPanel.classList.toggle('open');
  });

  document.addEventListener('click', (e) => {
    if (musicPanel.classList.contains('open') &&
        !musicPanel.contains(e.target) &&
        e.target.id !== 'btn-music' &&
        !e.target.closest('#btn-music')) {
      musicPanel.classList.remove('open');
    }
  });

  /* ========== AUTOFOCUS ========== */
  editor.addEventListener('click', () => editor.focus());
  window.addEventListener('load', () => {
    editor.focus();
    setCaretBlink(true);
    scheduleCaretUpdate();
    // Cuộn xuống cuối nếu có nội dung
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