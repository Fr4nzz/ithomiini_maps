<script setup>
import { ref } from 'vue'
import config from '../config'

const showUpdateDatabase = ref(false)
const updateSanger = ref(true)
const updateGbif = ref(false)
const updatePassword = ref('')
const updateStatus = ref('')
const updateMessage = ref('')

const triggerDatabaseUpdate = async () => {
  if (!config.workerUrl) {
    updateStatus.value = 'error'
    updateMessage.value = 'Database update is not configured (missing worker URL).'
    return
  }

  if (!updateSanger.value && !updateGbif.value) {
    updateStatus.value = 'error'
    updateMessage.value = 'Please select at least one data source'
    return
  }

  updateStatus.value = 'loading'
  updateMessage.value = 'Contacting server...'

  try {
    const response = await fetch(config.workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: updatePassword.value,
        update_sanger: updateSanger.value,
        update_gbif: updateGbif.value,
        owner: config.githubOwner,
        repo: config.githubRepo
      })
    })

    if (response.ok) {
      updateStatus.value = 'success'
      const estimatedTime = updateGbif.value ? '15-20 minutes' : '2-3 minutes'
      updateMessage.value = `Update started on ${config.githubOwner}/${config.githubRepo}! The database will refresh in approximately ${estimatedTime}. Check back later.`
    } else {
      const error = await response.text()
      updateStatus.value = 'error'
      updateMessage.value = `Update failed: ${error}`
    }
  } catch (err) {
    updateStatus.value = 'error'
    updateMessage.value = `Network error: ${err.message}. Please try again.`
  }
}
</script>

<template>
  <div class="update-database-section">
    <button
      class="collapse-toggle update-toggle"
      @click="showUpdateDatabase = !showUpdateDatabase"
      :class="{ expanded: showUpdateDatabase }"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/>
      </svg>
      Update Database
      <svg class="chevron" :class="{ rotated: showUpdateDatabase }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <Transition name="slide">
      <div v-if="showUpdateDatabase" class="update-content">
        <p class="filter-hint">
          Refresh data from external sources. GBIF updates take ~15 minutes.
        </p>

        <div class="update-sources">
          <label class="update-checkbox">
            <input type="checkbox" v-model="updateSanger" />
            <span>Sanger Institute</span>
          </label>
          <label class="update-checkbox">
            <input type="checkbox" v-model="updateGbif" />
            <span>GBIF (includes iNaturalist)</span>
          </label>
        </div>

        <div class="update-password">
          <input
            type="password"
            v-model="updatePassword"
            placeholder="Enter password"
            :disabled="updateStatus === 'loading'"
            @keyup.enter="triggerDatabaseUpdate"
          />
        </div>

        <button
          class="update-btn"
          @click="triggerDatabaseUpdate"
          :disabled="updateStatus === 'loading'"
        >
          <svg v-if="updateStatus !== 'loading'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 0 1-9 9"/>
            <path d="M21 3v6h-6"/>
            <path d="M3 12a9 9 0 0 1 9-9"/>
            <path d="M3 21v-6h6"/>
          </svg>
          <svg v-else class="spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="62" stroke-dashoffset="20"/>
          </svg>
          {{ updateStatus === 'loading' ? 'Updating...' : 'Start Update' }}
        </button>

        <div
          v-if="updateMessage"
          class="update-message"
          :class="{ success: updateStatus === 'success', error: updateStatus === 'error' }"
        >
          {{ updateMessage }}
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.filter-hint {
  font-size: 0.7rem;
  color: var(--color-text-muted, #666);
  font-style: italic;
  margin-top: 8px;
}

.collapse-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: var(--color-bg-tertiary, #2d2d4a);
  border: none;
  color: var(--color-text-secondary, #aaa);
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.collapse-toggle:hover {
  background: #353558;
  color: var(--color-text-primary, #e0e0e0);
}

.collapse-toggle svg {
  width: 16px;
  height: 16px;
  transition: transform 0.2s;
}

.collapse-toggle.expanded svg {
  transform: rotate(90deg);
}

.update-database-section {
  padding: 0 20px 16px;
  border-top: 1px solid var(--color-border, #3d3d5c);
}

.update-toggle {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
  background: none;
  border: none;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s;
}

.update-toggle:hover {
  color: var(--color-accent, #4ade80);
}

.update-toggle svg:first-child {
  width: 18px;
  height: 18px;
  color: var(--color-accent, #4ade80);
}

.update-toggle .chevron {
  width: 16px;
  height: 16px;
  margin-left: auto;
  transition: transform 0.2s;
}

.update-toggle .chevron.rotated {
  transform: rotate(180deg);
}

.update-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.update-sources {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.update-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--color-text-secondary, #b0b0b0);
}

.update-checkbox input {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent, #4ade80);
  cursor: pointer;
}

.update-checkbox:hover {
  color: var(--color-text-primary, #e0e0e0);
}

.update-password input {
  width: 100%;
  padding: 10px 12px;
  background: var(--color-bg-primary, #1a1a2e);
  border: 1px solid var(--color-border, #3d3d5c);
  border-radius: 6px;
  color: var(--color-text-primary, #e0e0e0);
  font-size: 0.85rem;
}

.update-password input:focus {
  outline: none;
  border-color: var(--color-accent, #4ade80);
  box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.15);
}

.update-password input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.update-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px 16px;
  background: var(--color-accent, #4ade80);
  border: none;
  border-radius: 6px;
  color: #1a1a2e;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.update-btn:hover:not(:disabled) {
  background: #3fcd73;
  transform: translateY(-1px);
}

.update-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.update-btn svg {
  width: 18px;
  height: 18px;
}

.update-btn .spinner {
  animation: spin 1s linear infinite;
}

.update-message {
  padding: 10px 12px;
  border-radius: 6px;
  font-size: 0.8rem;
  line-height: 1.4;
}

.update-message.success {
  background: rgba(74, 222, 128, 0.15);
  border: 1px solid rgba(74, 222, 128, 0.3);
  color: #4ade80;
}

.update-message.error {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}
</style>
