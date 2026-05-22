export interface PolicyRule {
  attribute: string; // e.g., 'resource.departmentId' or 'resource.ownerId'
  operator: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN' | 'CONTAINS';
  value: string; // e.g., 'user.departmentId' or 'user.id' or static string 'HR'
}

/**
 * Safely evaluates a structured JSON policy against user and resource context.
 * This completely mitigates arbitrary JavaScript execution (RCE) via `new Function()`.
 */
export const evaluatePolicy = (policies: PolicyRule[][], user: any, resource: any): boolean => {
  if (!policies || policies.length === 0) return true;

  const resolveValue = (path: string, context: { user: any, resource: any }) => {
    if (!path.includes('.')) {
      // It might be a static value, but if it matches a context key we return it. Otherwise treat as static string.
      return path;
    }

    const parts = path.split('.');
    let current: any = context;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }
    
    // Convert objectIds to strings for accurate comparison
    if (current && typeof current.toString === 'function' && current.constructor.name === 'ObjectId') {
      return current.toString();
    }
    
    return current;
  };

  // Policies are grouped as an array of rules arrays (OR between outer, AND within inner array)
  // For now, if we pass a single array of rules, we treat it as AND.
  // We'll map each permission's policy block to an AND block.
  // The outer loop checks if ANY permission's policy block passes (OR).
  
  return policies.some(policyBlock => {
    if (!policyBlock || !Array.isArray(policyBlock) || policyBlock.length === 0) return true;

    return policyBlock.every(rule => {
      const leftVal = resolveValue(rule.attribute, { user, resource });
      const rightVal = resolveValue(rule.value, { user, resource });

      const lStr = String(leftVal);
      const rStr = String(rightVal);

      switch (rule.operator) {
        case 'EQUALS':
          return lStr === rStr;
        case 'NOT_EQUALS':
          return lStr !== rStr;
        case 'IN':
          if (Array.isArray(rightVal)) return rightVal.map(String).includes(lStr);
          return false;
        case 'NOT_IN':
          if (Array.isArray(rightVal)) return !rightVal.map(String).includes(lStr);
          return false;
        case 'CONTAINS':
          if (Array.isArray(leftVal)) return leftVal.map(String).includes(rStr);
          return false;
        default:
          return false;
      }
    });
  });
};
