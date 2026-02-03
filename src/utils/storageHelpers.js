import { usePersistenceStore } from '../stores/persistence'

export const getStorage = (key, defaultValue) => {
  const persistenceStore = usePersistenceStore()
  return persistenceStore.get(key, defaultValue)
}

export const setStorage = (key, value) => {
  const persistenceStore = usePersistenceStore()
  persistenceStore.set(key, value)
}
