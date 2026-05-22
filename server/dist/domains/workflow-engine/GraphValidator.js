"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GraphValidator = void 0;
class GraphValidator {
    /**
     * Validates a list of workflow nodes.
     * Returns a list of validation errors. If empty, the graph is valid.
     */
    static validate(nodes) {
        const errors = [];
        if (!nodes || nodes.length === 0) {
            errors.push({ code: 'EMPTY_GRAPH', message: 'Workflow template must contain at least one node.' });
            return errors;
        }
        // 1. Check for duplicate node IDs
        const nodeIds = new Set();
        const nodeMap = new Map();
        for (const node of nodes) {
            if (!node.id) {
                errors.push({ code: 'MISSING_NODE_ID', message: `Node "${node.name}" is missing a unique ID.` });
                continue;
            }
            if (nodeIds.has(node.id)) {
                errors.push({ code: 'DUPLICATE_NODE_ID', message: `Duplicate node ID detected: "${node.id}".` });
            }
            nodeIds.add(node.id);
            nodeMap.set(node.id, node);
        }
        // 2. Enforce exactly one START node
        const startNodes = nodes.filter(n => n.type === 'START');
        if (startNodes.length === 0) {
            errors.push({ code: 'NO_START_NODE', message: 'Workflow template must have exactly one START node.' });
        }
        else if (startNodes.length > 1) {
            errors.push({
                code: 'MULTIPLE_START_NODES',
                message: `Workflow template cannot have multiple START nodes. Found ${startNodes.length}.`,
            });
        }
        // 3. Enforce at least one END node
        const endNodes = nodes.filter(n => n.type === 'END');
        if (endNodes.length === 0) {
            errors.push({ code: 'NO_END_NODE', message: 'Workflow template must have at least one END node.' });
        }
        // 4. Validate transitions point to existing node IDs
        for (const node of nodes) {
            const nextNodes = node.config?.nextNodes;
            if (nextNodes) {
                // nextNodes is a Map or a Record, let's normalize check
                const entries = nextNodes instanceof Map ? nextNodes.entries() : Object.entries(nextNodes);
                for (const [outcome, targetId] of entries) {
                    if (targetId && !nodeIds.has(targetId)) {
                        errors.push({
                            code: 'INVALID_TRANSITION',
                            message: `Node "${node.id}" has a transition for "${outcome}" pointing to non-existent node "${targetId}".`,
                        });
                    }
                }
            }
        }
        // If there are structural errors, cycle detection may fail or loop infinitely, return early.
        if (errors.length > 0) {
            return errors;
        }
        // 5. Detect cycles / infinite loops (DFS)
        const visited = new Set();
        const recStack = new Set();
        const startNode = startNodes[0];
        const hasCycle = (nodeId) => {
            visited.add(nodeId);
            recStack.add(nodeId);
            const node = nodeMap.get(nodeId);
            if (node && node.config?.nextNodes) {
                const nextNodesObj = node.config.nextNodes;
                const targets = nextNodesObj instanceof Map
                    ? Array.from(nextNodesObj.values())
                    : Object.values(nextNodesObj);
                for (const targetId of targets) {
                    if (targetId) {
                        if (!visited.has(targetId)) {
                            if (hasCycle(targetId))
                                return true;
                        }
                        else if (recStack.has(targetId)) {
                            return true; // Cycle detected
                        }
                    }
                }
            }
            recStack.delete(nodeId);
            return false;
        };
        if (startNode && hasCycle(startNode.id)) {
            errors.push({
                code: 'CIRCULAR_DEPENDENCY',
                message: 'Circular dependency detected. The workflow contains loops that could execute infinitely.',
            });
        }
        // 6. Ensure all nodes are reachable from the START node (orphaned node detection)
        for (const node of nodes) {
            if (!visited.has(node.id)) {
                errors.push({
                    code: 'UNREACHABLE_NODE',
                    message: `Node "${node.id}" (${node.name}) is unreachable from the START node.`,
                });
            }
        }
        return errors;
    }
}
exports.GraphValidator = GraphValidator;
