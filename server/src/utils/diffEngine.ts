/**
 * Generates a clean JSON diff between two objects.
 * Useful for audit trails and capturing state changes.
 */
export const getJsonDiff = (oldObj: any, newObj: any, ignoreKeys: string[] = ['updatedAt', 'createdAt', '__v', 'password']) => {
  const diffs: Record<string, { old: any; new: any }> = {};

  const cleanOld = oldObj && typeof oldObj.toObject === 'function' ? oldObj.toObject() : oldObj;
  const cleanNew = newObj && typeof newObj.toObject === 'function' ? newObj.toObject() : newObj;

  if (!cleanOld || !cleanNew) return diffs;

  const allKeys = new Set([...Object.keys(cleanOld), ...Object.keys(cleanNew)]);

  for (const key of allKeys) {
    if (ignoreKeys.includes(key)) continue;

    const oldVal = cleanOld[key];
    const newVal = cleanNew[key];

    // If both are objects, recursively check diffs or stringify them to check differences
    if (oldVal !== newVal) {
      if (typeof oldVal === 'object' && typeof newVal === 'object') {
        const strOld = JSON.stringify(oldVal);
        const strNew = JSON.stringify(newVal);
        if (strOld !== strNew) {
          diffs[key] = { old: oldVal, new: newVal };
        }
      } else {
        diffs[key] = { old: oldVal, new: newVal };
      }
    }
  }

  return diffs;
};
