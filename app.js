const { useState, useEffect, useCallback, useRef, useMemo } = React;

// B-Tree Node class
class BTreeNode {
  constructor(isLeaf = true) {
    this.keys = [];
    this.children = [];
    this.isLeaf = isLeaf;
  }
  
  clone() {
    const newNode = new BTreeNode(this.isLeaf);
    newNode.keys = [...this.keys];
    newNode.children = this.children.map(c => c.clone());
    return newNode;
  }
}

// B-Tree class with detailed step tracking (using maxDegree)
class BTree {
  constructor(maxDegree = 3) {
    if (maxDegree < 3) {
      throw new Error('maxDegree must be at least 3');
    }
    this.root = new BTreeNode(true);
    this.maxDegree = maxDegree;
    this.steps = [];
    this.insertedKeys = []; // Track all inserted keys for rebuild
  }

  getMaxDegree() { return this.maxDegree; }
  getMaxKeys() { return this.maxDegree - 1; }
  getMinChildren() { return Math.ceil(this.maxDegree / 2); }
  getMinKeys() { return this.getMinChildren() - 1; }

  isFull(node) {
    return node.keys.length === this.getMaxKeys();
  }

  addStep(icon, message, highlightKeys = []) {
    this.steps.push({
      icon,
      message,
      highlightKeys,
      tree: this.cloneTree()
    });
  }
  
  cloneTree() {
    return this.root.clone();
  }

  insert(key) {
    if (this.search(this.root, key)) {
      this.addStep('⚠️', `Key ${key} already exists (duplicate ignored)`);
      return;
    }

    this.insertedKeys.push(key);
    this.addStep('🔵', `Insert ${key}`, [key]);
    
    const root = this.root;
    
    if (this.isFull(root)) {
      this.addStep('🔀', `Root is full (${root.keys.length} keys, max ${this.getMaxKeys()})`);      
      const newRoot = new BTreeNode(false);
      newRoot.children.push(this.root);
      this.splitChild(newRoot, 0, key);
      this.root = newRoot;
      this.insertNonFull(newRoot, key);
    } else {
      this.insertNonFull(root, key);
    }
    
    this.addStep('✅', `Insertion of ${key} complete`);
  }

  search(node, key) {
    let i = 0;
    while (i < node.keys.length && key > node.keys[i]) {
      i++;
    }
    
    if (i < node.keys.length && key === node.keys[i]) {
      return true;
    }
    
    if (node.isLeaf) {
      return false;
    }
    
    return this.search(node.children[i], key);
  }

  insertNonFull(node, key) {
    let i = node.keys.length - 1;

    if (node.isLeaf) {
      node.keys.push(null);
      while (i >= 0 && key < node.keys[i]) {
        node.keys[i + 1] = node.keys[i];
        i--;
      }
      node.keys[i + 1] = key;
      this.addStep('📍', `Inserted ${key} into leaf node [${node.keys.join(', ')}]`, [key]);
    } else {
      while (i >= 0 && key < node.keys[i]) {
        i--;
      }
      i++;

      if (this.isFull(node.children[i])) {
        this.addStep('⚠️', `Child node is full, splitting...`);
        this.splitChild(node, i);
        if (key > node.keys[i]) {
          i++;
        }
      }
      this.insertNonFull(node.children[i], key);
    }
  }

  splitChild(parent, childIndex) {
    const fullChild = parent.children[childIndex];
    const newChild = new BTreeNode(fullChild.isLeaf);

    const minChildren = this.getMinChildren();
    const midIdx = minChildren - 1;
    const midKey = fullChild.keys[midIdx];

    this.addStep('🔀', `Splitting node [${fullChild.keys.join(' | ')}]`);
    this.addStep('↑', `Promote ${midKey} to parent`, [midKey]);

    // Split: upper half to new child
    newChild.keys = fullChild.keys.splice(midIdx + 1);
    if (!fullChild.isLeaf) {
      newChild.children = fullChild.children.splice(minChildren);
    }
    fullChild.keys.pop(); // Remove the middle key from fullChild

    // Insert middle key into parent
    parent.keys.splice(childIndex, 0, midKey);
    parent.children.splice(childIndex + 1, 0, newChild);

    this.addStep('✅', `Split complete: left [${fullChild.keys.join(', ')}], promoted ${midKey}, right [${newChild.keys.join(', ')}]`);
  }

  delete(key) {
    if (!this.search(this.root, key)) {
      this.addStep('⚠️', `Key ${key} not found (cannot delete)`);
      return;
    }

    this.addStep('🔵', `Delete ${key}`, [key]);
    this.deleteFromNode(this.root, key);
    
    // Remove from tracking
    const idx = this.insertedKeys.indexOf(key);
    if (idx > -1) {
      this.insertedKeys.splice(idx, 1);
    }
    
    // Handle root becoming empty
    if (this.root.keys.length === 0 && !this.root.isLeaf) {
      this.addStep('🔽', `Root is empty, promote child to root`);
      this.root = this.root.children[0];
    }
    
    this.addStep('✅', `Deletion of ${key} complete`);
  }

  deleteFromNode(node, key) {
    const idx = node.keys.findIndex(k => k === key);
    
    if (idx !== -1) {
      // Key found in this node
      if (node.isLeaf) {
        // Case 1: Key in leaf - just remove it
        this.addStep('🔍', `Found ${key} in leaf [${node.keys.join(', ')}]`, [key]);
        node.keys.splice(idx, 1);
        this.addStep('❌', `Removed ${key} from leaf`, [key]);
      } else {
        // Case 2: Key in internal node - replace with predecessor
        this.addStep('🔍', `Found ${key} in internal node`, [key]);
        const predecessor = this.getPredecessor(node.children[idx]);
        this.addStep('🔄', `Replace ${key} with predecessor ${predecessor}`, [predecessor]);
        node.keys[idx] = predecessor;
        this.deleteFromNode(node.children[idx], predecessor);
      }
    } else {
      // Key not in this node - find which child to descend into
      if (node.isLeaf) {
        this.addStep('⚠️', `Key ${key} not found`);
        return;
      }
      
      let childIdx = 0;
      while (childIdx < node.keys.length && key > node.keys[childIdx]) {
        childIdx++;
      }
      
      const child = node.children[childIdx];
      const needsFixing = child.keys.length === this.getMinKeys();
      
      if (needsFixing) {
        this.addStep('⚠️', `Child may underflow (${child.keys.length} keys), preparing...`);
        this.ensureChildHasEnoughKeys(node, childIdx);
        
        // After fixing, key might have moved - find correct child again
        childIdx = 0;
        while (childIdx < node.keys.length && key > node.keys[childIdx]) {
          childIdx++;
        }
      }
      
      this.deleteFromNode(node.children[childIdx], key);
    }
  }

  ensureChildHasEnoughKeys(parent, childIdx) {
    const child = parent.children[childIdx];
    
    // Try to borrow from left sibling
    if (childIdx > 0 && parent.children[childIdx - 1].keys.length > this.getMinKeys()) {
      this.borrowFromLeft(parent, childIdx);
      return;
    }
    
    // Try to borrow from right sibling
    if (childIdx < parent.children.length - 1 && parent.children[childIdx + 1].keys.length > this.getMinKeys()) {
      this.borrowFromRight(parent, childIdx);
      return;
    }
    
    // Must merge
    if (childIdx > 0) {
      this.mergeWithSibling(parent, childIdx - 1);
    } else {
      this.mergeWithSibling(parent, childIdx);
    }
  }

  borrowFromLeft(parent, childIdx) {
    const child = parent.children[childIdx];
    const leftSibling = parent.children[childIdx - 1];
    
    this.addStep('⬅️', `Borrow from left sibling [${leftSibling.keys.join(', ')}]`);
    
    // Move parent key down to child
    child.keys.unshift(parent.keys[childIdx - 1]);
    
    // Move left sibling's last key up to parent
    parent.keys[childIdx - 1] = leftSibling.keys.pop();
    
    // If not leaf, move child pointer too
    if (!child.isLeaf) {
      child.children.unshift(leftSibling.children.pop());
    }
    
    this.addStep('✅', `Borrowed ${parent.keys[childIdx - 1]}, child now [${child.keys.join(', ')}]`);
  }

  borrowFromRight(parent, childIdx) {
    const child = parent.children[childIdx];
    const rightSibling = parent.children[childIdx + 1];
    
    this.addStep('➡️', `Borrow from right sibling [${rightSibling.keys.join(', ')}]`);
    
    // Move parent key down to child
    child.keys.push(parent.keys[childIdx]);
    
    // Move right sibling's first key up to parent
    parent.keys[childIdx] = rightSibling.keys.shift();
    
    // If not leaf, move child pointer too
    if (!child.isLeaf) {
      child.children.push(rightSibling.children.shift());
    }
    
    this.addStep('✅', `Borrowed ${parent.keys[childIdx]}, child now [${child.keys.join(', ')}]`);
  }

  mergeWithSibling(parent, leftChildIdx) {
    const leftChild = parent.children[leftChildIdx];
    const rightChild = parent.children[leftChildIdx + 1];
    
    this.addStep('🔗', `Merge [${leftChild.keys.join(', ')}] and [${rightChild.keys.join(', ')}]`);
    
    // Pull parent key down and merge with right child
    leftChild.keys.push(parent.keys[leftChildIdx]);
    leftChild.keys.push(...rightChild.keys);
    
    // Merge children if not leaf
    if (!leftChild.isLeaf) {
      leftChild.children.push(...rightChild.children);
    }
    
    // Remove the parent key and right child pointer
    parent.keys.splice(leftChildIdx, 1);
    parent.children.splice(leftChildIdx + 1, 1);
    
    this.addStep('✅', `Merged into [${leftChild.keys.join(', ')}]`);
  }

  getPredecessor(node) {
    // Get the rightmost key in the subtree
    while (!node.isLeaf) {
      node = node.children[node.children.length - 1];
    }
    return node.keys[node.keys.length - 1];
  }

  getSuccessor(node) {
    // Get the leftmost key in the subtree
    while (!node.isLeaf) {
      node = node.children[0];
    }
    return node.keys[0];
  }

  getSteps() {
    return this.steps;
  }

  getInsertedKeys() {
    return [...this.insertedKeys];
  }

  rebuildWithNewMaxDegree(newMaxDegree) {
    const keysToReinsert = this.getInsertedKeys();
    const newTree = new BTree(newMaxDegree);
    
    if (keysToReinsert.length > 0) {
      newTree.addStep('🔧', `Rebuilding tree with maxDegree=${newMaxDegree}...`);
      keysToReinsert.forEach(key => {
        newTree.insert(key, true);
      });
      newTree.addStep('✅', `Rebuild complete with ${keysToReinsert.length} keys`);
    }
    
    return newTree;
  }
}

// Main App Component
function BTreeVisualizer() {
  const [maxDegree, setMaxDegree] = useState(3);
  const [inputValue, setInputValue] = useState('');
  const [deleteValue, setDeleteValue] = useState('');
  const [tree, setTree] = useState(() => new BTree(3));
  const [allSteps, setAllSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const [tempDegree, setTempDegree] = useState('3');
  const [showModal, setShowModal] = useState(false);
  const [pendingMaxDegree, setPendingMaxDegree] = useState(null);
  
  const playIntervalRef = useRef(null);
  
  const currentTree = useMemo(() => {
    if (currentStep < 0 || allSteps.length === 0) {
      return new BTreeNode(true);
    }
    return allSteps[currentStep].tree;
  }, [currentStep, allSteps]);

  // SVG tree rendering
  const renderTree = useCallback((rootNode) => {
    if (!rootNode || rootNode.keys.length === 0) {
      return null;
    }

    const positions = new Map();
    const edges = [];
    
    function calculatePositions(node, level = 0, leftBound = 0, rightBound = 900) {
      const x = (leftBound + rightBound) / 2;
      const y = 60 + level * 120;
      
      positions.set(node, { x, y });

      if (!node.isLeaf && node.children.length > 0) {
        const childWidth = (rightBound - leftBound) / node.children.length;
        node.children.forEach((child, i) => {
          const childLeft = leftBound + i * childWidth;
          const childRight = leftBound + (i + 1) * childWidth;
          calculatePositions(child, level + 1, childLeft, childRight);
          
          const parentPos = positions.get(node);
          const childPos = positions.get(child);
          edges.push({
            x1: parentPos.x,
            y1: parentPos.y + 25,
            x2: childPos.x,
            y2: childPos.y - 25
          });
        });
      }
    }

    calculatePositions(rootNode);
    
    const highlightKeys = currentStep >= 0 && currentStep < allSteps.length 
      ? allSteps[currentStep].highlightKeys 
      : [];

    const nodeElements = [];
    positions.forEach((pos, node) => {
      const numKeys = node.keys.length;
      const nodeWidth = Math.max(80, 50 + numKeys * 35);
      const nodeHeight = 50;
      const x = pos.x - nodeWidth / 2;
      const y = pos.y - nodeHeight / 2;
      
      const hasHighlight = node.keys.some(k => highlightKeys.includes(k));

      const nodeGroup = React.createElement('g', {
        key: `node-${pos.x}-${pos.y}`,
        className: `tree-node ${node.isLeaf ? 'node-leaf' : 'node-internal'} ${hasHighlight ? 'highlight' : ''}`
      },
        React.createElement('rect', {
          x,
          y,
          width: nodeWidth,
          height: nodeHeight,
          rx: 6
        }),
        ...node.keys.map((key, i) => {
          const keyBoxWidth = nodeWidth / numKeys;
          const keyBoxX = x + i * keyBoxWidth;
          const keyBoxCenterX = keyBoxX + keyBoxWidth / 2;
          const nodeCenterY = y + nodeHeight / 2;
          
          return React.createElement('g', { key: `key-${i}` },
            i > 0 && React.createElement('line', {
              x1: keyBoxX,
              y1: y + 5,
              x2: keyBoxX,
              y2: y + nodeHeight - 5,
              stroke: '#e2e8f0',
              strokeWidth: 1
            }),
            React.createElement('text', {
              x: keyBoxCenterX,
              y: nodeCenterY,
              textAnchor: 'middle',
              dominantBaseline: 'middle',
              fontSize: '13',
              fontWeight: 'bold',
              fill: '#0f172a',
              fontFamily: 'monospace',
              pointerEvents: 'none'
            }, key)
          );
        })
      );
      
      nodeElements.push(nodeGroup);
    });

    const edgeElements = edges.map((edge, i) => {
      const cx1 = edge.x1;
      const cy1 = edge.y1 + 20;
      const cx2 = edge.x2;
      const cy2 = edge.y2 - 20;
      
      return React.createElement('path', {
        key: `edge-${i}`,
        className: 'tree-edge',
        d: `M ${edge.x1} ${edge.y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${edge.x2} ${edge.y2}`
      });
    });

    return React.createElement('svg', {
      className: 'tree-svg',
      viewBox: '0 0 900 700',
      style: { width: '100%', height: '100%' }
    },
      React.createElement('title', null, 'B-Tree Visualization'),
      React.createElement('desc', null, 'Interactive B-Tree structure showing nodes and keys'),
      ...edgeElements,
      ...nodeElements
    );
  }, [currentStep, allSteps]);

  // Handle insert
  const handleInsert = useCallback(() => {
    if (!inputValue.trim()) return;

    const keys = inputValue.split(',').map(k => k.trim()).filter(k => k !== '');
    const validKeys = [];

    for (const k of keys) {
      const num = parseInt(k, 10);
      if (!isNaN(num)) {
        validKeys.push(num);
      }
    }

    if (validKeys.length === 0) return;

    // Clear previous steps and insert all keys
    tree.steps = [];
    validKeys.forEach(key => {
      tree.insert(key);
    });

    const newSteps = tree.getSteps();
    setAllSteps(newSteps);
    setCurrentStep(newSteps.length - 1);
    setTree(tree);
    setInputValue('');
  }, [inputValue, tree]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (!deleteValue.trim()) return;

    const keys = deleteValue.split(',').map(k => k.trim()).filter(k => k !== '');
    const validKeys = [];

    for (const k of keys) {
      const num = parseInt(k, 10);
      if (!isNaN(num)) {
        validKeys.push(num);
      }
    }

    if (validKeys.length === 0) return;

    // Clear previous steps and delete all keys
    tree.steps = [];
    validKeys.forEach(key => {
      tree.delete(key);
    });

    const newSteps = tree.getSteps();
    setAllSteps(newSteps);
    setCurrentStep(newSteps.length - 1);
    setTree(tree);
    setDeleteValue('');
  }, [deleteValue, tree]);

  // Handle degree change - show modal if tree has keys
  const handleDegreeChange = useCallback(() => {
    const degree = parseInt(tempDegree, 10);
    if (isNaN(degree) || degree < 3) return;

    if (tree.getInsertedKeys().length > 0) {
      setPendingMaxDegree(degree);
      setShowModal(true);
    } else {
      setMaxDegree(degree);
      const newTree = new BTree(degree);
      setTree(newTree);
      setAllSteps([]);
      setCurrentStep(-1);
      setIsPlaying(false);
    }
  }, [tempDegree, tree]);

  // Confirm degree change and rebuild
  const confirmDegreeChange = useCallback(() => {
    if (pendingMaxDegree === null) return;

    setIsPlaying(false);
    const newTree = tree.rebuildWithNewMaxDegree(pendingMaxDegree);
    const newSteps = newTree.getSteps();
    
    setMaxDegree(pendingMaxDegree);
    setTree(newTree);
    setAllSteps(newSteps);
    setCurrentStep(newSteps.length - 1);
    setShowModal(false);
    setPendingMaxDegree(null);
  }, [pendingMaxDegree, tree]);

  // Cancel degree change
  const cancelDegreeChange = useCallback(() => {
    setTempDegree(String(maxDegree));
    setShowModal(false);
    setPendingMaxDegree(null);
  }, [maxDegree]);

  // Reset tree
  const handleReset = useCallback(() => {
    const newTree = new BTree(maxDegree);
    setTree(newTree);
    setAllSteps([]);
    setCurrentStep(-1);
    setIsPlaying(false);
  }, [maxDegree]);
  
  // Export tree
  const handleExport = useCallback(() => {
    const data = {
      maxDegree,
      maxKeys: maxDegree - 1,
      minChildren: Math.ceil(maxDegree / 2),
      minKeys: Math.ceil(maxDegree / 2) - 1,
      tree: currentTree,
      timestamp: new Date().toISOString()
    };
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `btree-maxdegree${maxDegree}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [maxDegree, currentTree]);

  // Step forward
  const stepForward = useCallback(() => {
    if (currentStep >= allSteps.length - 1) return;
    setCurrentStep(prev => prev + 1);
  }, [currentStep, allSteps]);

  // Step backward
  const stepBackward = useCallback(() => {
    if (currentStep < 0) return;
    setCurrentStep(prev => prev - 1);
  }, [currentStep]);

  // Toggle play/pause
  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  // Play functionality
  useEffect(() => {
    if (isPlaying) {
      const interval = 800 / speed;
      playIntervalRef.current = setInterval(() => {
        setCurrentStep(prev => {
          if (prev >= allSteps.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, allSteps, speed]);

  // Handle Enter key
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleInsert();
    }
  }, [handleInsert]);

  const handleDeleteKeyPress = useCallback((e) => {
    if (e.key === 'Enter') {
      handleDelete();
    }
  }, [handleDelete]);

  const maxKeys = maxDegree - 1;
  const minChildren = Math.ceil(maxDegree / 2);
  const minKeys = minChildren - 1;
  const stepInfo = allSteps.length > 0 ? ` • Step ${currentStep + 1} of ${allSteps.length}` : '';

  return React.createElement('div', { className: 'app-container' },
    // Modal
    showModal && React.createElement('div', { className: 'modal-overlay', onClick: cancelDegreeChange },
      React.createElement('div', { className: 'modal-dialog', onClick: (e) => e.stopPropagation() },
        React.createElement('div', { className: 'modal-header' },
          React.createElement('h3', null, 'Reset Tree?')
        ),
        React.createElement('div', { className: 'modal-body' },
          `Changing maxDegree will rebuild the tree. Insert sequence will be replayed. Proceed?`
        ),
        React.createElement('div', { className: 'modal-footer' },
          React.createElement('button', {
            className: 'btn-secondary',
            onClick: cancelDegreeChange,
            'aria-label': 'Cancel'
          }, 'Cancel'),
          React.createElement('button', {
            className: 'btn-primary',
            onClick: confirmDegreeChange,
            'aria-label': 'Proceed with rebuild'
          }, 'Proceed')
        )
      )
    ),

    // Header
    React.createElement('header', { className: 'header' },
      React.createElement('div', { className: 'header-left' },
        React.createElement('h1', null, 'B-Tree Visualizer'),
        React.createElement('div', { className: 'degree-badge' }, `m = ${maxDegree} • Max keys = ${maxKeys} • Min children = ${minChildren} • Min keys = ${minKeys}${stepInfo}`)
      ),
      React.createElement('div', { className: 'header-right' },
        React.createElement('div', { className: 'speed-control' },
          React.createElement('label', null, 'Speed'),
          React.createElement('input', {
            type: 'range',
            min: '0.5',
            max: '2',
            step: '0.1',
            value: speed,
            onChange: (e) => setSpeed(parseFloat(e.target.value)),
            'aria-label': 'Animation speed'
          }),
          React.createElement('span', { className: 'speed-value' }, `${speed}x`)
        )
      )
    ),

    // Main workspace
    React.createElement('main', { className: 'main-workspace' },
      // Left panel - Visualization
      React.createElement('div', { className: 'visualization-panel' },
        React.createElement('div', { className: 'svg-container' },
          currentTree.keys.length === 0 ? 
            React.createElement('div', { className: 'empty-state' },
              'Tree is empty. Insert keys to begin visualization.'
            ) :
            renderTree(currentTree)
        )
      ),

      // Right panel - Step Trace
      React.createElement('aside', { className: 'step-trace-panel' },
        React.createElement('div', { className: 'trace-header' },
          React.createElement('h2', null, 'Step Trace')
        ),
        
        React.createElement('div', { className: 'trace-controls' },
          React.createElement('button', {
            className: 'btn-sm btn-secondary',
            onClick: stepBackward,
            disabled: currentStep < 0,
            'aria-label': 'Previous step'
          }, '◄ Prev'),
          React.createElement('button', {
            className: 'btn-sm btn-primary',
            onClick: togglePlay,
            disabled: allSteps.length === 0 || currentStep >= allSteps.length - 1,
            'aria-label': isPlaying ? 'Pause' : 'Play'
          }, isPlaying ? '⏸' : '▶'),
          React.createElement('button', {
            className: 'btn-sm btn-secondary',
            onClick: stepForward,
            disabled: currentStep >= allSteps.length - 1,
            'aria-label': 'Next step'
          }, 'Next ►')
        ),
        
        React.createElement('div', { className: 'trace-log', role: 'list' },
          allSteps.length === 0 ? 
            React.createElement('div', { style: { padding: '2rem 1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.875rem' } },
              'No steps yet. Insert keys to see trace.'
            ) :
            allSteps.map((step, idx) => {
              let className = 'trace-step';
              if (idx < currentStep) className += ' past';
              if (idx === currentStep) className += ' current';
              if (idx > currentStep) className += ' future';

              return React.createElement('div', {
                key: idx,
                className,
                role: 'listitem'
              },
                React.createElement('span', { className: 'step-icon' }, step.icon),
                step.message.replace(/(\d+)/g, (match) => `\`${match}\``)
              );
            })
        )
      )
    ),
    
    // Input Panel
    React.createElement('div', { className: 'input-panel' },
      React.createElement('div', { className: 'input-section', style: { flex: '1 1 300px' } },
        React.createElement('label', null, 'Insert Key(s)'),
        React.createElement('div', { className: 'input-group' },
          React.createElement('input', {
            type: 'text',
            placeholder: '10 or 10,20,30',
            value: inputValue,
            onChange: (e) => setInputValue(e.target.value),
            onKeyPress: handleKeyPress,
            'aria-label': 'Insert keys'
          }),
          React.createElement('button', {
            className: 'btn-primary',
            onClick: handleInsert,
            'aria-label': 'Insert keys'
          }, 'Insert')
        ),
        React.createElement('div', { className: 'input-hint' }, 'Single or comma-separated, e.g. 10 or 10,20,30')
      ),
      
      React.createElement('div', { className: 'input-section', style: { flex: '1 1 300px' } },
        React.createElement('label', null, 'Delete Key(s)'),
        React.createElement('div', { className: 'input-group' },
          React.createElement('input', {
            type: 'text',
            placeholder: '5 or 3,7,5',
            value: deleteValue,
            onChange: (e) => setDeleteValue(e.target.value),
            onKeyPress: handleDeleteKeyPress,
            disabled: tree.getInsertedKeys().length === 0,
            'aria-label': 'Delete keys'
          }),
          React.createElement('button', {
            className: 'btn-primary',
            onClick: handleDelete,
            disabled: tree.getInsertedKeys().length === 0,
            style: { background: '#ef4444' },
            'aria-label': 'Delete keys'
          }, 'Delete')
        ),
        React.createElement('div', { className: 'input-hint' }, 'Single or comma-separated, e.g. 5 or 3,7,5')
      ),
      
      React.createElement('div', { className: 'input-section', style: { flex: '0 1 240px' } },
        React.createElement('label', { title: 'm ≥ 3. Each node has up to m children and m-1 keys. Minimum children: ceil(m/2). Minimum keys: ceil(m/2)-1' }, 'Max Children per Node (m)'),
        React.createElement('div', { className: 'input-group' },
          React.createElement('input', {
            type: 'number',
            min: '3',
            value: tempDegree,
            onChange: (e) => setTempDegree(e.target.value),
            'aria-label': 'Maximum children per node',
            title: 'm ≥ 3. Each node has up to m children and m-1 keys.'
          }),
          React.createElement('button', {
            className: 'btn-secondary',
            onClick: handleDegreeChange,
            disabled: parseInt(tempDegree, 10) < 3 || isNaN(parseInt(tempDegree, 10)),
            'aria-label': 'Apply new maxDegree'
          }, 'Apply')
        ),
        React.createElement('div', { className: 'input-hint', style: parseInt(tempDegree, 10) < 3 ? { color: '#ef4444' } : {} }, 
          parseInt(tempDegree, 10) < 3 ? 'maxDegree must be at least 3' : `Max keys = ${Math.max(0, parseInt(tempDegree, 10) - 1) || 0}`
        )
      ),
      
      React.createElement('div', { className: 'input-section', style: { flex: '0 1 200px' } },
        React.createElement('label', null, 'Actions'),
        React.createElement('div', { className: 'input-group' },
          React.createElement('button', {
            className: 'btn-tertiary',
            onClick: () => { setAllSteps([]); setCurrentStep(-1); },
            'aria-label': 'Clear log'
          }, 'Clear Log'),
          React.createElement('button', {
            className: 'btn-tertiary',
            onClick: handleExport,
            disabled: currentTree.keys.length === 0,
            'aria-label': 'Export tree as JSON'
          }, 'Export JSON')
        )
      )
    )
  );
}

// Render the app
if (typeof ReactDOM !== 'undefined' && ReactDOM.createRoot) {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(BTreeVisualizer));
}