<script setup>
/**
 * SectionHeader - Reusable section header with count badge
 * Used in PointPopup, ImageGallery, and other components
 */
defineProps({
  count: [Number, String],
  label: String
})
</script>

<template>
  <div class="section-header">
    <span class="count-badge">{{ count }}</span>
    <span class="section-label">{{ label }}</span>
  </div>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.count-badge {
  background: rgba(74, 222, 128, 0.2);
  color: #4ade80;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  min-width: 20px;
  text-align: center;
}

.section-label {
  font-size: 0.7rem;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
