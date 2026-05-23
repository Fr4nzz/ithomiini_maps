<script setup>
import { nextTick, ref } from 'vue'
import FallbackImage from './FallbackImage.vue'

const props = defineProps({
  groupedThumbnails: {
    type: Array,
    default: () => [],
  },
  currentItem: Object,
  collapsedSpecies: {
    type: Object,
    required: true,
  },
  collapsedSubspecies: {
    type: Object,
    required: true,
  },
  thumbUrl: {
    type: Function,
    required: true,
  },
  thumbCandidates: {
    type: Function,
    required: true,
  },
})

const emit = defineEmits([
  'toggle-species',
  'toggle-subspecies',
  'select-individual',
])

const thumbnailStripRef = ref(null)

function scrollThumbnails(direction) {
  if (!thumbnailStripRef.value) return
  thumbnailStripRef.value.scrollBy({
    left: direction * 300,
    behavior: 'smooth',
  })
}

function positionToActiveThumbnail() {
  nextTick(() => {
    const activeThumb = thumbnailStripRef.value?.querySelector('.thumbnail.active')
    if (!activeThumb || !thumbnailStripRef.value) return

    const stripRect = thumbnailStripRef.value.getBoundingClientRect()
    const thumbRect = activeThumb.getBoundingClientRect()
    const scrollLeft = thumbnailStripRef.value.scrollLeft +
      (thumbRect.left - stripRect.left) -
      (stripRect.width / 2) +
      (thumbRect.width / 2)

    thumbnailStripRef.value.scrollLeft = Math.max(0, scrollLeft)
  })
}

function groupHasCurrentItem(speciesGroup) {
  return speciesGroup.subspecies.some(group =>
    group.individuals.some(item => item.id === props.currentItem?.id)
  )
}

function subgroupKey(speciesName, subgroupName) {
  return `${speciesName}|${subgroupName}`
}

defineExpose({
  positionToActiveThumbnail,
})
</script>

<template>
  <div class="thumbnail-strip">
    <button class="scroll-arrow scroll-arrow-left" @click="scrollThumbnails(-1)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m15 18-6-6 6-6"/>
      </svg>
    </button>

    <div ref="thumbnailStripRef" class="thumbnail-scroll">
      <template v-for="speciesGroup in groupedThumbnails" :key="speciesGroup.name">
        <div
          class="species-group"
          :style="{ '--species-color': speciesGroup.color?.main, '--species-bg': speciesGroup.color?.bg, '--species-border': speciesGroup.color?.border }"
        >
          <button
            class="species-header"
            :title="speciesGroup.name"
            @click="emit('toggle-species', speciesGroup.name)"
          >
            <svg class="collapse-icon" :class="{ collapsed: collapsedSpecies.has(speciesGroup.name) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m6 9 6 6 6-6"/>
            </svg>
            <span class="species-name">{{ speciesGroup.name }}</span>
            <span class="species-count">{{ speciesGroup.totalImages }}</span>
          </button>

          <div
            v-if="collapsedSpecies.has(speciesGroup.name)"
            class="preview-container"
            @click="emit('toggle-species', speciesGroup.name)"
          >
            <button
              class="thumbnail preview-thumb"
              :class="{ active: groupHasCurrentItem(speciesGroup) }"
              :title="speciesGroup.subspecies[0]?.individuals[0]?.id || 'View'"
              @click.stop="groupHasCurrentItem(speciesGroup)
                ? emit('toggle-species', speciesGroup.name)
                : emit('select-individual', speciesGroup.subspecies[0]?.individuals[0]?.id, false)"
            >
              <FallbackImage
                v-if="speciesGroup.subspecies[0]?.individuals[0]?.image_url"
                :candidates="thumbCandidates(speciesGroup.subspecies[0].individuals[0].image_url)"
                :alt="speciesGroup.name"
                loading="lazy"
              />
              <span class="expand-badge" @click.stop="emit('toggle-species', speciesGroup.name)" title="Expand group">+</span>
            </button>
          </div>

          <div class="species-content" v-if="!collapsedSpecies.has(speciesGroup.name)">
            <template v-for="subspGroup in speciesGroup.subspecies" :key="`${speciesGroup.name}-${subspGroup.name}`">
              <div
                class="subspecies-group"
                :style="{ '--subsp-color': subspGroup.color?.main, '--subsp-bg': subspGroup.color?.bg, '--subsp-border': subspGroup.color?.border }"
              >
                <button
                  class="subspecies-header"
                  :title="subspGroup.name"
                  @click="emit('toggle-subspecies', subgroupKey(speciesGroup.name, subspGroup.name))"
                >
                  <svg class="collapse-icon" :class="{ collapsed: collapsedSubspecies.has(subgroupKey(speciesGroup.name, subspGroup.name)) }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                  <span class="subspecies-name">{{ subspGroup.name }}</span>
                  <span class="subspecies-count">{{ subspGroup.individuals.length }}</span>
                </button>

                <div
                  v-if="collapsedSubspecies.has(subgroupKey(speciesGroup.name, subspGroup.name))"
                  class="preview-container"
                  @click="emit('toggle-subspecies', subgroupKey(speciesGroup.name, subspGroup.name))"
                >
                  <button
                    class="thumbnail preview-thumb"
                    :class="{ active: subspGroup.individuals.some(item => item.id === currentItem?.id) }"
                    :title="subspGroup.individuals[0]?.id || 'View'"
                    @click.stop="subspGroup.individuals.some(item => item.id === currentItem?.id)
                      ? emit('toggle-subspecies', subgroupKey(speciesGroup.name, subspGroup.name))
                      : emit('select-individual', subspGroup.individuals[0]?.id, false)"
                  >
                    <FallbackImage
                      v-if="subspGroup.individuals[0]?.image_url"
                      :candidates="thumbCandidates(subspGroup.individuals[0].image_url)"
                      :alt="subspGroup.name"
                      loading="lazy"
                    />
                    <span class="expand-badge" @click.stop="emit('toggle-subspecies', subgroupKey(speciesGroup.name, subspGroup.name))" title="Expand group">+</span>
                  </button>
                </div>

                <div class="thumbnails-container" v-if="!collapsedSubspecies.has(subgroupKey(speciesGroup.name, subspGroup.name))">
                  <button
                    v-for="specimen in subspGroup.individuals"
                    :key="specimen.id"
                    class="thumbnail"
                    :class="{ active: currentItem?.id === specimen.id }"
                    :title="specimen.id"
                    @click="emit('select-individual', specimen.id)"
                  >
                    <FallbackImage
                      :candidates="thumbCandidates(specimen.image_url)"
                      :alt="specimen.id"
                      loading="lazy"
                    />
                  </button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>

    <button class="scroll-arrow scroll-arrow-right" @click="scrollThumbnails(1)">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="m9 18 6-6-6-6"/>
      </svg>
    </button>
  </div>
</template>

<style scoped src="./image-gallery-styles.css"></style>
