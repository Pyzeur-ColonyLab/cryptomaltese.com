/**
 * Utility to prevent circular links in Sankey diagrams
 * Detects and removes cycles that would cause rendering errors
 */

export interface SankeyData {
    nodes: Array<{ id: string; [key: string]: any }>;
    links: Array<{ source: string; target: string; value: number; [key: string]: any }>;
}

export interface CircularLinkPreventionResult {
    data: SankeyData;
    removedLinks: Array<{ source: string; target: string; reason: string }>;
    cycleCount: number;
    warnings: string[];
}

/**
 * Prevents circular links by detecting cycles in the graph
 * Uses depth-first search to identify and remove problematic links
 */
export function preventCircularLinks(data: SankeyData): CircularLinkPreventionResult {
    console.log('🔍 preventCircularLinks called with data:', {
        nodesCount: data.nodes.length,
        linksCount: data.links.length
    });
    
    const removedLinks: Array<{ source: string; target: string; reason: string }> = [];
    const safeLinks: typeof data.links = [];
    const nodes = new Set<string>();
    let cycleCount = 0;
    const warnings: string[] = [];

    // Build adjacency list for cycle detection
    const adjacencyList = new Map<string, string[]>();
    
    // Initialize adjacency list
    for (const link of data.links) {
        if (!adjacencyList.has(link.source)) {
            adjacencyList.set(link.source, []);
        }
        if (!adjacencyList.has(link.target)) {
            adjacencyList.set(link.target, []);
        }
        adjacencyList.get(link.source)!.push(link.target);
    }

    // Helper function to detect cycles using DFS
    function hasCycle(node: string, visited: Set<string>, path: Set<string>): boolean {
        if (path.has(node)) {
            return true; // Cycle detected
        }
        
        if (visited.has(node)) {
            return false; // Already processed, no cycle from this node
        }
        
        visited.add(node);
        path.add(node);
        
        const neighbors = adjacencyList.get(node) || [];
        for (const neighbor of neighbors) {
            if (hasCycle(neighbor, visited, new Set(path))) {
                return true;
            }
        }
        
        path.delete(node);
        return false;
    }

    // Process each link and check for cycles
    for (const link of data.links) {
        // Skip self-loops (node pointing to itself)
        if (link.source === link.target) {
            removedLinks.push({
                source: link.source,
                target: link.target,
                reason: 'Self-loop detected'
            });
            cycleCount++;
            warnings.push(`Self-loop removed: ${link.source} → ${link.target}`);
            continue;
        }

        // Check if adding this link would create a cycle
        const tempAdjacency = new Map(adjacencyList);
        if (!tempAdjacency.has(link.source)) {
            tempAdjacency.set(link.source, []);
        }
        tempAdjacency.get(link.source)!.push(link.target);
        
        // Check for cycles starting from the target node
        if (hasCycle(link.target, new Set(), new Set())) {
            removedLinks.push({
                source: link.source,
                target: link.target,
                reason: 'Would create cycle'
            });
            cycleCount++;
            warnings.push(`Circular link removed: ${link.source} → ${link.target}`);
            continue;
        }

        // Link is safe, add it
        safeLinks.push(link);
        nodes.add(link.source);
        nodes.add(link.target);
    }

    // Create safe data structure
    const safeData: SankeyData = {
        nodes: Array.from(nodes).map(id => ({ id })),
        links: safeLinks
    };
    
    console.log('🔍 preventCircularLinks result:', {
        originalLinksCount: data.links.length,
        safeLinksCount: safeLinks.length,
        removedLinksCount: removedLinks.length,
        cycleCount,
        finalNodesCount: safeData.nodes.length
    });

    return {
        data: safeData,
        removedLinks,
        cycleCount,
        warnings
    };
}

/**
 * Alternative approach: Simple cycle prevention by tracking visited addresses
 * Less aggressive but faster for large datasets
 */
export function simpleCircularLinkPrevention(data: SankeyData): CircularLinkPreventionResult {
    const removedLinks: Array<{ source: string; target: string; reason: string }> = [];
    const safeLinks: typeof data.links = [];
    const nodes = new Set<string>();
    const seenAddresses = new Set<string>();
    let cycleCount = 0;
    const warnings: string[] = [];

    // Sort links by some criteria to prioritize certain paths
    const sortedLinks = [...data.links].sort((a, b) => {
        // Prioritize links with higher values
        return (b.value || 0) - (a.value || 0);
    });

    for (const link of sortedLinks) {
        // Skip self-loops
        if (link.source === link.target) {
            removedLinks.push({
                source: link.source,
                target: link.target,
                reason: 'Self-loop detected'
            });
            cycleCount++;
            warnings.push(`Self-loop removed: ${link.source} → ${link.target}`);
            continue;
        }

        // Skip if target already seen (creates cycle)
        if (seenAddresses.has(link.target)) {
            removedLinks.push({
                source: link.source,
                target: link.target,
                reason: 'Target already visited'
            });
            cycleCount++;
            warnings.push(`Circular link removed: ${link.source} → ${link.target} (target already visited)`);
            continue;
        }

        // Link is safe
        safeLinks.push(link);
        nodes.add(link.source);
        nodes.add(link.target);
        seenAddresses.add(link.source);
        seenAddresses.add(link.target);
    }

    return {
        data: {
            nodes: Array.from(nodes).map(id => ({ id })),
            links: safeLinks
        },
        removedLinks,
        cycleCount,
        warnings
    };
}

/**
 * Enhanced cycle prevention with path tracking
 * More sophisticated but handles complex scenarios better
 */
export function enhancedCircularLinkPrevention(data: SankeyData): CircularLinkPreventionResult {
    const removedLinks: Array<{ source: string; target: string; reason: string }> = [];
    const safeLinks: typeof data.links = [];
    const nodes = new Set<string>();
    let cycleCount = 0;
    const warnings: string[] = [];

    // Build path tracking
    const pathMap = new Map<string, Set<string>>();
    
    for (const link of data.links) {
        // Skip self-loops
        if (link.source === link.target) {
            removedLinks.push({
                source: link.source,
                target: link.target,
                reason: 'Self-loop detected'
            });
            cycleCount++;
            warnings.push(`Self-loop removed: ${link.source} → ${link.target}`);
            continue;
        }

        // Check if this link would create a cycle
        const sourcePaths = pathMap.get(link.source) || new Set();
        const targetPaths = pathMap.get(link.target) || new Set();
        
        // If target can reach source, this would create a cycle
        if (targetPaths.has(link.source)) {
            removedLinks.push({
                source: link.source,
                target: link.target,
                reason: 'Would create cycle (target can reach source)'
            });
            cycleCount++;
            warnings.push(`Circular link removed: ${link.source} → ${link.target} (target can reach source)`);
            continue;
        }

        // Check if any node that can reach source can also reach target
        let wouldCreateCycle = false;
        for (const [node, paths] of pathMap.entries()) {
            if (paths.has(link.source) && paths.has(link.target)) {
                wouldCreateCycle = true;
                break;
            }
        }

        if (wouldCreateCycle) {
            removedLinks.push({
                source: link.source,
                target: link.target,
                reason: 'Would create cycle (common ancestor)'
            });
            cycleCount++;
            warnings.push(`Circular link removed: ${link.source} → ${link.target} (common ancestor)`);
            continue;
        }

        // Link is safe, add it and update path tracking
        safeLinks.push(link);
        nodes.add(link.source);
        nodes.add(link.target);

        // Update path tracking
        const newPaths = new Set([link.source, link.target]);
        for (const path of sourcePaths) {
            newPaths.add(path);
        }
        pathMap.set(link.target, newPaths);
    }

    return {
        data: {
            nodes: Array.from(nodes).map(id => ({ id })),
            links: safeLinks
        },
        removedLinks,
        cycleCount,
        warnings
    };
}

/**
 * Get prevention method based on complexity preference
 */
export function getCircularLinkPrevention(method: 'simple' | 'enhanced' | 'full' = 'enhanced') {
    switch (method) {
        case 'simple':
            return simpleCircularLinkPrevention;
        case 'enhanced':
            return enhancedCircularLinkPrevention;
        case 'full':
            return preventCircularLinks;
        default:
            return enhancedCircularLinkPrevention;
    }
}

/**
 * Validate Sankey data structure before processing
 */
export function validateSankeyData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!data) {
        errors.push('Data is null or undefined');
        return { isValid: false, errors };
    }
    
    if (!Array.isArray(data.nodes)) {
        errors.push('Nodes must be an array');
    }
    
    if (!Array.isArray(data.links)) {
        errors.push('Links must be an array');
    }
    
    if (data.nodes && data.nodes.length === 0) {
        errors.push('Nodes array is empty');
    }
    
    if (data.links && data.links.length === 0) {
        errors.push('Links array is empty');
    }
    
    // Check node structure
    if (data.nodes) {
        data.nodes.forEach((node: any, index: number) => {
            if (!node.id && !node.key) {
                errors.push(`Node at index ${index} missing id or key`);
            }
        });
    }
    
    // Check link structure
    if (data.links) {
        data.links.forEach((link: any, index: number) => {
            if (link.source === undefined || link.target === undefined) {
                errors.push(`Link at index ${index} missing source or target`);
            }
            if (link.value === undefined || link.value === null) {
                errors.push(`Link at index ${index} missing value`);
            }
        });
    }
    
    return {
        isValid: errors.length === 0,
        errors
    };
} 