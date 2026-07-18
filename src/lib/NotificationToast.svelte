<script lang="ts">
  import { CircleAlert, CircleCheck, Info, X } from '@lucide/svelte';
  import { createEventDispatcher } from 'svelte';
  import { cubicOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';

  export let notification: {
    id: string;
    message: string;
    type: 'success' | 'error' | 'info';
    duration: number;
  };

  const dispatch = createEventDispatcher<{ close: string }>();

  $: accentClass = notification.type === 'success'
    ? 'border-l-success-500 text-success-300'
    : notification.type === 'error'
      ? 'border-l-error-500 text-error-300'
      : 'border-l-primary-500 text-primary-300';
</script>

<div
  class="flex max-w-sm items-start gap-2.5 rounded-md border border-l-[3px] border-surface-500/35 bg-surface-900 p-3 text-surface-200 shadow-2xl {accentClass}"
  role={notification.type === 'error' ? 'alert' : 'status'}
  in:fly={{ x: 24, duration: 180, easing: cubicOut }}
  out:fly={{ x: 24, duration: 140, easing: cubicOut }}
>
  <span class="mt-0.5 shrink-0">
    {#if notification.type === 'success'}
      <CircleCheck size={17} />
    {:else if notification.type === 'error'}
      <CircleAlert size={17} />
    {:else}
      <Info size={17} />
    {/if}
  </span>

  <p class="m-0 min-w-0 flex-1 text-xs leading-5 text-surface-200">
    {notification.message}
  </p>

  <button
    type="button"
    class="grid size-6 shrink-0 place-items-center rounded-[3px] border-0 bg-transparent p-0 text-surface-500 hover:bg-surface-800 hover:text-surface-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-400"
    onclick={() => dispatch('close', notification.id)}
    title="Dismiss notification"
  >
    <X size={14} />
  </button>
</div>
