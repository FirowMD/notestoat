<script lang="ts">
  import { notificationStore } from './stores/notification';
  import NotificationToast from './NotificationToast.svelte';
  import { flip } from 'svelte/animate';

  function handleClose(event: CustomEvent<string>) {
    notificationStore.remove(event.detail);
  }
</script>

{#if $notificationStore.notifications.length > 0}
  <div class="pointer-events-none fixed top-15 right-3 z-100 flex max-w-[calc(100vw-24px)] flex-col gap-2">
    {#each $notificationStore.notifications as notification (notification.id)}
      <div 
        class="pointer-events-auto"
        animate:flip={{ duration: 300 }}
      >
        <NotificationToast 
          {notification} 
          on:close={handleClose}
        />
      </div>
    {/each}
  </div>
{/if}
