<script>
  import { toastMessage, confirmState, answerConfirm } from '$lib/stores/toast.js';
</script>

{#if $toastMessage}
  <div class="toast" class:error={$toastMessage.type === 'error'}>
    {$toastMessage.text}
  </div>
{/if}

{#if $confirmState}
  <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
  <div class="confirm-bg" onclick={() => answerConfirm(false)}>
    <div class="confirm-box" onclick={(e) => e.stopPropagation()}>
      <div class="confirm-msg">{$confirmState.message}</div>
      <div class="confirm-btns">
        <button class="confirm-ok" onclick={() => answerConfirm(true)}>Confirm</button>
        <button class="confirm-cancel" onclick={() => answerConfirm(false)}>Cancel</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .toast {
    position: fixed;
    bottom: 72px;
    left: 50%;
    transform: translateX(-50%);
    background: #1b1507;
    border: 1px solid rgba(26,82,22,.5);
    color: #8fc67f;
    border-radius: 6px;
    padding: 9px 18px;
    font-family: 'DM Mono', monospace;
    font-size: .65rem;
    z-index: 99999;
    box-shadow: 0 4px 20px rgba(0,0,0,.5);
    white-space: nowrap;
    pointer-events: none;
  }
  .toast.error {
    border-color: rgba(184,53,53,.4);
    color: #e08080;
  }
  .confirm-bg {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,.5);
    z-index: 99998;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .confirm-box {
    background: #1b1507;
    border: 1px solid rgba(201,151,58,.3);
    border-radius: 8px;
    padding: 20px 24px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 240px;
    max-width: 320px;
  }
  .confirm-msg {
    font-family: 'DM Mono', monospace;
    font-size: .68rem;
    color: #f0e8d0;
    line-height: 1.5;
  }
  .confirm-btns {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
  }
  .confirm-ok {
    background: #1a5216;
    border: none;
    border-radius: 4px;
    padding: 5px 16px;
    font-family: 'DM Mono', monospace;
    font-size: .63rem;
    color: #fdf8f0;
    cursor: pointer;
    transition: opacity .13s;
  }
  .confirm-ok:hover { opacity: .85; }
  .confirm-cancel {
    background: transparent;
    border: 1px solid rgba(201,151,58,.25);
    border-radius: 4px;
    padding: 5px 16px;
    font-family: 'DM Mono', monospace;
    font-size: .63rem;
    color: #c9973a;
    cursor: pointer;
    transition: all .13s;
  }
  .confirm-cancel:hover { border-color: #c9973a; }
</style>
