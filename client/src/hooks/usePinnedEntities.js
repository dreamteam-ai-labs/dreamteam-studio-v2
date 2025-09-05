import { useState, useCallback, useEffect } from 'react';

/**
 * Custom hook for managing pinned entities in tables
 * @param {string} storageKey - Unique key for localStorage (e.g., 'pinned-solutions', 'pinned-problems')
 * @returns {Object} - Pinning state and functions
 */
export function usePinnedEntities(storageKey) {
  // Load pinned entities from localStorage
  const [pinnedIds, setPinnedIds] = useState(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Save to localStorage whenever pinnedIds changes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(pinnedIds));
    } catch (error) {
      console.error('Failed to save pinned entities:', error);
    }
  }, [pinnedIds, storageKey]);

  // Pin an entity
  const pin = useCallback((entityId) => {
    setPinnedIds(prev => {
      if (prev.includes(entityId)) return prev;
      return [entityId, ...prev]; // Add to beginning
    });
  }, []);

  // Unpin an entity
  const unpin = useCallback((entityId) => {
    setPinnedIds(prev => prev.filter(id => id !== entityId));
  }, []);

  // Toggle pin state
  const togglePin = useCallback((entityId) => {
    setPinnedIds(prev => {
      if (prev.includes(entityId)) {
        return prev.filter(id => id !== entityId);
      }
      return [entityId, ...prev];
    });
  }, []);

  // Check if entity is pinned
  const isPinned = useCallback((entityId) => {
    return pinnedIds.includes(entityId);
  }, [pinnedIds]);

  // Clear all pins
  const clearAll = useCallback(() => {
    setPinnedIds([]);
  }, []);

  // Pin multiple entities at once
  const pinMultiple = useCallback((entityIds) => {
    setPinnedIds(prev => {
      const newIds = entityIds.filter(id => !prev.includes(id));
      return [...newIds, ...prev];
    });
  }, []);

  // Reorder pinned entities
  const reorderPins = useCallback((fromIndex, toIndex) => {
    setPinnedIds(prev => {
      const newPins = [...prev];
      const [removed] = newPins.splice(fromIndex, 1);
      newPins.splice(toIndex, 0, removed);
      return newPins;
    });
  }, []);

  // Separate and sort entities into pinned and unpinned
  const separateEntities = useCallback((entities) => {
    const pinned = [];
    const unpinned = [];
    
    // First, collect pinned entities in the order they were pinned
    pinnedIds.forEach(pinnedId => {
      const entity = entities.find(e => e.id === pinnedId);
      if (entity) {
        pinned.push(entity);
      }
    });
    
    // Then collect unpinned entities
    entities.forEach(entity => {
      if (!pinnedIds.includes(entity.id)) {
        unpinned.push(entity);
      }
    });
    
    return { pinned, unpinned };
  }, [pinnedIds]);

  return {
    pinnedIds,
    pin,
    unpin,
    togglePin,
    isPinned,
    clearAll,
    pinMultiple,
    reorderPins,
    separateEntities,
    pinnedCount: pinnedIds.length
  };
}