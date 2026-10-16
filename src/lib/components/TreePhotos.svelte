<script>
  import { uploadPhoto, deletePhoto, getImgs, putImgs } from '$lib/api/supabase.js';
  import { currentUser } from '$lib/stores/auth.js';
  import { showToast } from '$lib/stores/toast.js';

  let { treeId, isOnline = true, onCountChange } = $props();

  let imgs = $state([]);
  let loading = $state(true);
  let uploading = $state(false);
  let dragOver = $state(false);
  let lightboxSrc = $state('');

  $effect(() => { onCountChange?.(imgs.length); });

  $effect(() => {
    if (treeId) loadImages();
  });

  async function loadImages() {
    loading = true;
    try { imgs = await getImgs(treeId); } catch { imgs = []; }
    loading = false;
  }

  function handleFiles(files) {
    if (!$currentUser) { showToast('Sign in to upload photos.', 'error'); return; }
    if (!isOnline) { showToast('Photo uploads require a connection.', 'error'); return; }
    for (const f of files) {
      const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
      if (!allowed.includes(f.type)) { showToast('Only JPG and PNG files are allowed.', 'error'); continue; }
      if (f.size > 10 * 1024 * 1024) { showToast('Image must be under 10 MB.', 'error'); continue; }
      doUpload(f);
    }
  }

  async function doUpload(file) {
    uploading = true;
    try {
      const url = await uploadPhoto(file, treeId, $currentUser.username);
      imgs = [{ who: $currentUser.username, url, ts: Date.now() }, ...imgs];
      await putImgs(treeId, imgs);
    } catch (e) {
      showToast('Upload failed: ' + e.message, 'error');
    }
    uploading = false;
  }

  async function delImg(i) {
    if (!$currentUser || imgs[i]?.who !== $currentUser.username) return;
    const url = imgs[i].url;
    imgs = imgs.filter((_, idx) => idx !== i);
    await putImgs(treeId, imgs);
    if (url) deletePhoto(url).catch(() => {});
  }

  function onDrop(e) {
    e.preventDefault();
    dragOver = false;
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files);
  }

  function onDragOver(e) { e.preventDefault(); dragOver = true; }
  function onDragLeave() { dragOver = false; }
</script>

<div class="photos-sec">
  <div class="sec-hdr">Photos ({imgs.length})</div>

  {#if $currentUser}
    <div class="drop-zone" class:over={dragOver} class:uploading class:offline={!isOnline}
      title={isOnline ? '' : 'Photo uploads require a connection'}
      ondrop={onDrop} ondragover={onDragOver} ondragleave={onDragLeave}
      role="button" tabindex="0"
      onclick={() => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/jpeg,image/png'; inp.multiple = true; inp.onchange = () => handleFiles(inp.files); inp.click(); }}
      onkeydown={(e) => { if (e.key === 'Enter') e.currentTarget.click(); }}
    >
      {#if uploading}
        <span class="dz-text">Uploading…</span>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        <span class="dz-text">Drop photos or click to upload</span>
      {/if}
    </div>
  {/if}

  {#if loading}
    <div class="ph-loading">Loading photos…</div>
  {:else if imgs.length}
    <div class="ph-grid">
      {#each imgs as img, i}
        <div class="ph-thumb" onclick={() => { lightboxSrc = img.url; }}>
          <img src={img.url} alt="Tree photo" loading="lazy" />
          {#if $currentUser && img.who === $currentUser.username}
            <button class="ph-del" onclick={(e) => { e.stopPropagation(); delImg(i); }} title="Delete photo">✕</button>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="ph-empty">No photos yet.</div>
  {/if}
</div>

{#if lightboxSrc}
  <div class="lb" onclick={() => { lightboxSrc = ''; }}>
    <img src={lightboxSrc} alt="Full size" class="lb-img" />
    <button class="lb-close" onclick={() => { lightboxSrc = ''; }}>✕</button>
  </div>
{/if}

<style>
  .photos-sec{display:flex;flex-direction:column;gap:8px}
  .drop-zone{border:1.5px dashed rgba(201,151,58,.35);border-radius:6px;padding:14px 10px;display:flex;flex-direction:column;align-items:center;gap:5px;cursor:pointer;transition:all .15s;color:var(--gold);background:transparent}
  .drop-zone:hover,.drop-zone.over{border-color:var(--gold);background:rgba(201,151,58,.06)}
  .drop-zone.uploading{opacity:.5;pointer-events:none}
  .drop-zone.offline{opacity:.4;pointer-events:none;cursor:not-allowed}
  .dz-text{font-size:.54rem;letter-spacing:.06em}
  .ph-loading,.ph-empty{font-size:.55rem;color:var(--parch-dim);font-style:italic;padding:4px 0}
  .ph-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
  .ph-thumb{position:relative;aspect-ratio:1;border-radius:4px;overflow:hidden;cursor:pointer;border:1px solid var(--border)}
  .ph-thumb img{width:100%;height:100%;object-fit:cover}
  .ph-thumb:hover .ph-del{opacity:1}
  .ph-del{position:absolute;top:2px;right:2px;background:rgba(0,0,0,.65);color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:.5rem;cursor:pointer;opacity:0;transition:opacity .15s;display:flex;align-items:center;justify-content:center}
  .lb{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;cursor:pointer}
  .lb-img{max-width:92vw;max-height:90vh;border-radius:6px;box-shadow:0 8px 40px rgba(0,0,0,.5)}
  .lb-close{position:fixed;top:16px;right:20px;background:rgba(255,255,255,.15);border:none;color:#fff;font-size:1.2rem;width:36px;height:36px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center}
</style>
