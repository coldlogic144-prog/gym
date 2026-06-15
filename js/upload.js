// ── GYMBROS Upload System ──
// Uploads files to GitHub via the Contents API

const REPO_OWNER = 'YOUR_GITHUB_USERNAME';   // ← Change this
const REPO_NAME  = 'gymbros';                // ← Change this if needed

let selectedFiles = [];

// File input change
document.getElementById('file-input').addEventListener('change', (e) => {
  addFiles(Array.from(e.target.files));
});

// Drag and drop
const dropZone = document.getElementById('drop-zone');

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  addFiles(Array.from(e.dataTransfer.files));
});

function addFiles(files) {
  const mediaType = document.getElementById('media-type').value;
  const accept = mediaType === 'videos'
    ? ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']
    : ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

  files.forEach(f => {
    if (accept.includes(f.type) || accept.some(a => f.type.startsWith(a.split('/')[0]))) {
      if (!selectedFiles.find(sf => sf.name === f.name && sf.size === f.size)) {
        selectedFiles.push(f);
      }
    }
  });
  renderChips();
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  renderChips();
}

function renderChips() {
  const container = document.getElementById('selected-files');
  container.innerHTML = '';
  selectedFiles.forEach((f, i) => {
    const chip = document.createElement('div');
    chip.className = 'file-chip';
    chip.innerHTML = `
      <span>${f.name} <small style="color:#555">(${formatSize(f.size)})</small></span>
      <span class="remove" onclick="removeFile(${i})">×</span>
    `;
    container.appendChild(chip);
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Convert file to base64
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Main upload function
async function uploadFiles() {
  const token = document.getElementById('gh-token').value.trim();
  const bro   = document.getElementById('bro-select').value;
  const type  = document.getElementById('media-type').value;

  const statusEl   = document.getElementById('upload-status');
  const progressBar= document.getElementById('progress-bar');
  const progressFill=document.getElementById('progress-fill');

  // Validate
  if (!token) {
    setStatus('error', '⚠ Please enter your GitHub Personal Access Token.');
    return;
  }
  if (!bro) {
    setStatus('error', '⚠ Please choose a crew member.');
    return;
  }
  if (selectedFiles.length === 0) {
    setStatus('error', '⚠ No files selected. Drop some files first!');
    return;
  }

  progressBar.style.display = 'block';
  progressFill.style.width = '0%';
  setStatus('loading', `⏳ Uploading ${selectedFiles.length} file(s)...`);

  let uploaded = 0;
  let failed   = 0;
  const errors = [];

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i];

    try {
      // Build unique filename with timestamp
      const ext  = file.name.split('.').pop().toLowerCase();
      const base = file.name.replace(`.${ext}`, '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const ts   = Date.now();
      const path = `photos/${bro}/${type === 'videos' ? '../videos/' + bro + '_' : ''}${base}_${ts}.${ext}`;
      // Simpler path:
      const filePath = type === 'videos'
        ? `videos/${bro}_${base}_${ts}.${ext}`
        : `photos/${bro}/${base}_${ts}.${ext}`;

      const content = await toBase64(file);

      const res = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github+json',
          },
          body: JSON.stringify({
            message: `Add ${type === 'videos' ? 'video' : 'photo'} for ${bro}: ${file.name}`,
            content: content,
          })
        }
      );

      if (res.ok) {
        uploaded++;
      } else {
        const err = await res.json();
        failed++;
        errors.push(`${file.name}: ${err.message || res.statusText}`);
      }
    } catch (err) {
      failed++;
      errors.push(`${file.name}: ${err.message}`);
    }

    // Update progress
    const pct = Math.round(((i + 1) / selectedFiles.length) * 100);
    progressFill.style.width = pct + '%';
    setStatus('loading', `⏳ Uploading ${i + 1}/${selectedFiles.length}...`);
  }

  // Done
  if (uploaded > 0 && failed === 0) {
    setStatus('success', `✅ ${uploaded} file(s) uploaded to ${bro}'s folder! Reload the profile to see them.`);
    selectedFiles = [];
    renderChips();
  } else if (uploaded > 0 && failed > 0) {
    setStatus('success', `⚠ ${uploaded} uploaded, ${failed} failed: ${errors.join(' | ')}`);
  } else {
    setStatus('error', `❌ Upload failed: ${errors.join(' | ')}`);
  }
}

function setStatus(type, msg) {
  const el = document.getElementById('upload-status');
  el.className = `upload-status ${type}`;
  el.textContent = msg;
}

// Update icon based on media type
document.getElementById('media-type').addEventListener('change', (e) => {
  const icon = document.querySelector('.drop-zone-icon');
  icon.textContent = e.target.value === 'videos' ? '🎥' : '📸';
  selectedFiles = [];
  renderChips();
});
