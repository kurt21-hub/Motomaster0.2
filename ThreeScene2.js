import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';
import { GLTFLoader } from './GLTFLoader.js';

function initThreeScene() {
    const container = document.querySelector('.simulation-area');
    if (!container) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.6, 5.0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.6;
    renderer.shadowMap.enabled = false;

    // ensure canvas sits above UI overlay
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '10010';
    renderer.domElement.style.pointerEvents = 'auto';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 1.6;
    controls.maxDistance = 30;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1.0);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(4, 6, 3);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffd7c2, 1.2);
    fillLight.position.set(-3, 1.5, -2);
    scene.add(fillLight);

    const loader = new GLTFLoader();
    let model = null;
    let activeExterior = null;
    const meshNames = [];
    // hood interaction holders (populated after model load)
    let hoodPivots = [];
    let hoodState = [];
    // door interaction holders
    let doorPivots = [];
    let doorState = [];
    // battery terminal cap interaction holders
    let batteryCapPivots = [];
    let batteryCapState = [];
    let hoveredCapIndex = null;
    let capTooltipElement = null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function fitCameraToTarget(target) {
        const box = new THREE.Box3().setFromObject(target);
        const size = box.getSize(new THREE.Vector3());
        const radius = size.length() * 0.5;

        // fit the camera to the model bounds so widening the container does not clip the car
        const aspect = camera.aspect || (container.clientWidth / container.clientHeight);
        const vFov = THREE.MathUtils.degToRad(camera.fov);
        const fitHeightDistance = radius / Math.tan(vFov / 2);
        const fitWidthDistance = fitHeightDistance / aspect;
        // bring the camera closer so the car appears larger by default
        const distance = Math.max(fitHeightDistance, fitWidthDistance) * 0.58;
        const viewDir = new THREE.Vector3(0.12, 0.16, 2.4).normalize();
        const targetCenter = new THREE.Vector3(0, 0.14, 0);
        camera.position.copy(targetCenter).add(viewDir.multiplyScalar(distance));
        controls.target.copy(targetCenter);
        controls.update();
    }

    function frameModel(target) {
        if (!target.userData.__normalizedForViewer) {
            const box = new THREE.Box3().setFromObject(target);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());

            target.position.x -= center.x;
            target.position.y -= center.y;
            target.position.z -= center.z;

            const maxDim = Math.max(size.x, size.y, size.z);
            if (maxDim > 0) {
                // scale up the model so it appears larger in the viewport
                const base = 9.5;
                const scale = (base * 1.25) / maxDim;
                target.scale.setScalar(scale);
            }

            // keep the car centered in the viewport
            target.position.y = -0.32;
            target.userData.__normalizedForViewer = true;
        }

        fitCameraToTarget(target);
    }

    loader.load(
        'models/NEW_CARWITHENGINE.glb',
        function (gltf) {
            model = gltf.scene;
            model.rotation.y = Math.PI * 0.28;

            // Simpler approach: clone the whole model and remove/hide interior parts
            const exterior = model.clone(true);
            exterior.traverse((child) => {
                if (!child.isMesh) return;
                const nameUpper = (child.name || '').toUpperCase();
                meshNames.push(child.name || '(unnamed)');
                // If this is an interior mesh, remove it from the exterior clone
                if (['DASHBOARD', 'SEATS', 'INTERIOR'].includes(nameUpper)) {
                    child.visible = false;
                    return;
                }
                // ensure meshes have proper normals
                try { if (child.geometry && child.geometry.isBufferGeometry) child.geometry.computeVertexNormals(); } catch (e) { console.warn('computeVertexNormals failed for', child.name, e); }
            });

            console.log('Car GLB mesh names:', meshNames);
            // expose names and quick wheel report for debugging in the page context
            try {
                const wheelCandidates = meshNames.filter(n => /WHEEL|WHEELS|TIRE|RIM|BRAKE|AXLE/gi.test(n));
                window.__meshReport = {
                    all: meshNames,
                    wheelCandidates,
                    timestamp: Date.now()
                };
            } catch (e) { console.warn(e); }

            // keep a reference for debugging and hide the original model to avoid interior bleed
            window.__originalModel = model;
            model.visible = false;

            exterior.name = 'CarExteriorGroup';
            scene.add(exterior);
            activeExterior = exterior;

            // finalize exterior materials and properties
            const paintHex = 0xEDEDED; // neutral light paint like reference
            exterior.traverse((c) => {
                if (!c.isMesh) return;
                c.castShadow = false;
                c.receiveShadow = false;
                const n = (c.name || '').toUpperCase();
                if (n.includes('WINDOW')) {
                    c.material = new THREE.MeshStandardMaterial({ color: 0x0b0b0c, roughness: 0.35, metalness: 0.0 });
                } else if (n.includes('WHEEL') || n.includes('WHEELS')) {
                    const orig = c.material;
                    if (orig && orig.map) {
                        orig.roughness = 0.35;
                        orig.metalness = 0.9;
                        orig.transparent = false;
                        orig.side = THREE.FrontSide;
                        orig.needsUpdate = true;
                        c.material = orig;
                    } else {
                        c.material = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.35, metalness: 0.9 });
                    }
                } else if (n.includes('BODY') || n.includes('HOOD') || n.includes('DOOR')) {
                    const orig = c.material;
                    if (orig && orig.map) {
                        const mat = new THREE.MeshPhysicalMaterial({ map: orig.map, color: new THREE.Color(0xffffff), roughness: 0.14, metalness: 0.6, clearcoat: 0.9, clearcoatRoughness: 0.03 });
                        if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace || mat.map.colorSpace;
                        mat.needsUpdate = true;
                        c.material = mat;
                    } else {
                        c.material = new THREE.MeshPhysicalMaterial({ color: paintHex, roughness: 0.14, metalness: 0.6, clearcoat: 0.9, clearcoatRoughness: 0.03 });
                    }
                } else {
                    // generic fallback
                    const om = c.material;
                    if (om && om.map) om.map.colorSpace = THREE.SRGBColorSpace || om.map.colorSpace;
                    if (!om || om.isMaterial === false) c.material = new THREE.MeshStandardMaterial({ color: 0xcccccc });
                }
            });

            // If the GLB only contains wheels for one side, mirror them to the other side
            try {
                const wheels = exterior.getObjectByName('WHEELS');
                if (wheels && !exterior.getObjectByName('WHEELS_MIRROR')) {
                    const geom = wheels.geometry && wheels.geometry.clone ? wheels.geometry.clone() : null;
                    if (geom) {
                        const mat = wheels.material && wheels.material.clone ? wheels.material.clone() : new THREE.MeshStandardMaterial({ color: 0x666666 });
                        // mirror geometry across X axis
                        const m = new THREE.Matrix4().makeScale(-1, 1, 1);
                        geom.applyMatrix4(m);
                        geom.computeVertexNormals();
                        const mirror = new THREE.Mesh(geom, mat);
                        mirror.name = 'WHEELS_MIRROR';
                        // position mirror: flip X of original world position relative to model
                        mirror.position.copy(wheels.position);
                        mirror.position.x *= -1;
                        mirror.quaternion.copy(wheels.quaternion);
                        mirror.scale.copy(wheels.scale);
                        if (mirror.material) mirror.material.side = THREE.DoubleSide;
                        mirror.castShadow = true;
                        mirror.receiveShadow = true;
                        exterior.add(mirror);
                        window.__mirrorAdded = true;
                        console.log('Added mirrored wheels as WHEELS_MIRROR');
                    }
                }
            } catch (e) { console.warn('wheel mirror failed', e); }

            // frame and show exterior as the target
            frameModel(exterior);

            // --- HOOD INTERACTION ---
            try {
                const hoodMeshes = [];
                exterior.traverse((c) => {
                    if (!c.isMesh) return;
                    const n = (c.name || '').toUpperCase();
                    if (n.includes('HOOD') || n.includes('BONNET') || n.includes('FRUNK') || n.includes('HOOD_TOP')) hoodMeshes.push(c);
                });

                // fallback: pick the largest front-most mesh by Z center
                if (hoodMeshes.length === 0) {
                    let best = null;
                    let bestScore = 0;
                    exterior.traverse((c) => {
                        if (!c.isMesh) return;
                        const box = new THREE.Box3().setFromObject(c);
                        const size = box.getSize(new THREE.Vector3());
                        const center = box.getCenter(new THREE.Vector3());
                        // prefer wide flat pieces near the front (higher center.z)
                        const score = (center.z + Math.abs(center.z)) * (size.x * size.z);
                        if (score > bestScore) { bestScore = score; best = c; }
                    });
                    if (best) hoodMeshes.push(best);
                }

                hoodPivots = [];
                hoodMeshes.forEach((hood) => {
                    const bbox = new THREE.Box3().setFromObject(hood);
                    const size = bbox.getSize(new THREE.Vector3());
                    const center = bbox.getCenter(new THREE.Vector3());

                    // hinge: place near the rear edge (towards cabin/windshield)
                    const hingeWorld = center.clone();
                    hingeWorld.y = bbox.max.y;
                    hingeWorld.z = bbox.min.z + size.z * 0.02;

                    const pivot = new THREE.Group();
                    pivot.name = (hood.name || 'hood') + '_pivot';

                    // convert hinge to exterior local and attach
                    const hingeLocal = hingeWorld.clone();
                    exterior.worldToLocal(hingeLocal);
                    pivot.position.copy(hingeLocal);
                    exterior.add(pivot);

                    // attach hood to pivot preserving world transform
                    pivot.attach(hood);

                    // store base hinge position for tuning
                    pivot.userData.hingeBase = pivot.position.clone();

                    // (hinge helper removed)

                    hood.userData.isHood = true;
                    hood.userData.hoodPivot = pivot;
                    hoodPivots.push(pivot);
                });

                hoodState = hoodPivots.map(() => ({ open: false, target: 0 }));

                // --- Door detection and pivot creation ---
                try {
                    const doorMeshes = [];
                    // compute car center to classify front vs rear doors
                    const carBox = new THREE.Box3().setFromObject(exterior);
                    const carCenter = carBox.getCenter(new THREE.Vector3());
                    exterior.traverse((c) => {
                        if (!c.isMesh) return;
                        const n = (c.name || '').toUpperCase();
                        if (n.includes('DOOR') && !n.includes('DASH') && !n.includes('INTERIOR')) doorMeshes.push(c);
                    });
                    doorPivots = [];
                    doorState = [];
                    const sortedDoors = doorMeshes
                        .map((door) => {
                            const bbox = new THREE.Box3().setFromObject(door);
                            const center = bbox.getCenter(new THREE.Vector3());
                            const size = bbox.getSize(new THREE.Vector3());
                            return {
                                door,
                                bbox,
                                center,
                                size,
                                isRightSide: center.x > carCenter.x
                            };
                        })
                        .sort((a, b) => (a.isRightSide === b.isRightSide ? 0 : a.isRightSide ? -1 : 1));
                    const leftDoorRef = sortedDoors.find((d) => !d.isRightSide);
                    const twoDoorFrontHintFromLeft = leftDoorRef ? (leftDoorRef.center.z < carCenter.z) : null;
                    sortedDoors.forEach(({ door, bbox, center, size, isRightSide }) => {
                        try {
                            // hinge at inner edge (near vehicle center) for X,
                            // but Z depends on whether this is a front or rear door
                            const hingeWorld = center.clone();
                            hingeWorld.y = center.y;
                            if (isRightSide) {
                                // right side door - hinge on mirror side (next to front hood right edge)
                                hingeWorld.x = bbox.max.x - size.x * 0.02;
                            } else {
                                // left side door - hinge at max.x
                                hingeWorld.x = bbox.max.x - size.x * 0.02;
                            }
                            // keep left-door behavior as-is; for right door in 2-door layout,
                            // use the same front-edge hint as the already-correct left door.
                            const isFront = isRightSide && sortedDoors.length <= 2 && twoDoorFrontHintFromLeft !== null
                                ? twoDoorFrontHintFromLeft
                                : (center.z < carCenter.z);
                            if (isFront) {
                                // hinge toward the front edge of the door
                                hingeWorld.z = isRightSide ? (bbox.min.z + size.z * 0.005) : (bbox.min.z + size.z * 0.02);
                            } else {
                                // hinge toward the rear edge of the door
                                hingeWorld.z = bbox.max.z - size.z * 0.02;
                            }

                            const pivot = new THREE.Group();
                            exterior.worldToLocal(hingeWorld);
                            pivot.position.copy(hingeWorld);
                            exterior.add(pivot);
                            pivot.attach(door);
                            pivot.userData.doorBase = pivot.position.clone();

                            // keep left door unchanged; only mirror right-door swing direction
                            const openAngle = Math.PI * 0.65;
                            const openSign = isRightSide ? -1 : 1;

                            door.userData.isDoor = true;
                            door.userData.doorPivot = pivot;
                            door.userData.doorSide = isRightSide ? 'right' : 'left';
                            doorPivots.push(pivot);
                            doorState.push({ open: false, target: 0, openAngle, openSign });
                        } catch (e) { console.warn('door pivot failed', e); }
                    });

                    // expose door toggle API
                    window.toggleDoor = function (index = 0) {
                        if (!doorPivots || !doorPivots.length) {
                            console.warn('toggleDoor: door pivots not ready');
                            return null;
                        }
                        const idx = Math.min(Math.max(0, index), doorPivots.length - 1);
                        doorState[idx].open = !doorState[idx].open;
                        doorState[idx].target = doorState[idx].open ? (doorState[idx].openAngle * (doorState[idx].openSign || 1)) : 0;
                        return doorState[idx].open;
                    };
                } catch (e) { console.warn('door setup failed', e); }

                // --- Battery Terminal Cap detection and interaction ---
                try {
                    const batteryCapMeshes = [];
                    const allMeshNames = [];

                    // First find all meshes and log names for debugging
                    let batteryMesh = null;
                    let batteryMeshes = [];
                    exterior.traverse((c) => {
                        if (!c.isMesh) return;
                        const n = (c.name || '').toUpperCase();
                        allMeshNames.push(c.name || '(unnamed)');

                        // Find battery meshes
                        if (n.includes('BATTERY') || n.includes('BATT')) {
                            batteryMeshes.push(c);
                            if (!n.includes('CAP') && !n.includes('CASE')) {
                                batteryMesh = c;
                            }
                        }
                    });

                    console.log('All mesh names:', allMeshNames);
                    console.log('Found battery meshes:', batteryMeshes.length);

                    // Find terminal caps - try multiple detection methods
                    exterior.traverse((c) => {
                        if (!c.isMesh) return;
                        const n = (c.name || '').toUpperCase();

                        // Method 1: Name patterns
                        const isCapByName = n.includes('CAP') || n.includes('TERMINAL') ||
                            (n.includes('POS') && n.length < 10) ||
                            (n.includes('NEG') && n.length < 10) ||
                            n.includes('PLUS') || n.includes('MINUS');

                        // Method 2: Small objects on TOP of battery (not just near it)
                        let isCapByPosition = false;
                        if (batteryMeshes.length > 0) {
                            const capBox = new THREE.Box3().setFromObject(c);
                            const capCenter = capBox.getCenter(new THREE.Vector3());
                            const capSize = capBox.getSize(new THREE.Vector3());

                            // Check if on top of any battery
                            for (const batt of batteryMeshes) {
                                const battBox = new THREE.Box3().setFromObject(batt);
                                const battCenter = battBox.getCenter(new THREE.Vector3());
                                const battSize = battBox.getSize(new THREE.Vector3());

                                // Must be: small, above battery top, within battery X/Z bounds
                                const isSmall = capSize.y < battSize.y * 0.4 &&
                                    Math.max(capSize.x, capSize.z) < battSize.x * 0.4;
                                const isAbove = capCenter.y > battBox.max.y - battSize.y * 0.2;
                                const isWithinXZ = Math.abs(capCenter.x - battCenter.x) < battSize.x * 0.5 &&
                                    Math.abs(capCenter.z - battCenter.z) < battSize.z * 0.6;

                                if (isSmall && isAbove && isWithinXZ) {
                                    isCapByPosition = true;
                                    console.log('Found cap by position:', c.name, 'at', capCenter);
                                    break;
                                }
                            }
                        }

                        // Method 3: Color-based detection (red or black/dark materials)
                        let isCapByColor = false;
                        if (c.material) {
                            const mat = c.material;
                            const color = mat.color || new THREE.Color();
                            // Check if red-ish or very dark
                            const isRed = color.r > 0.5 && color.g < 0.3 && color.b < 0.3;
                            const isBlack = color.r < 0.2 && color.g < 0.2 && color.b < 0.2;
                            if ((isRed || isBlack) && (isCapByName || isCapByPosition)) {
                                isCapByColor = true;
                            }
                        }

                        if (isCapByName || isCapByPosition) {
                            batteryCapMeshes.push(c);
                            console.log('Added cap:', c.name, 'methods:', { name: isCapByName, pos: isCapByPosition });
                        }
                    });

                    console.log('Total caps found:', batteryCapMeshes.length);

                    batteryCapPivots = [];
                    batteryCapState = [];

                    batteryCapMeshes.forEach((cap, index) => {
                        try {
                            const bbox = new THREE.Box3().setFromObject(cap);
                            const center = bbox.getCenter(new THREE.Vector3());

                            // Determine if this is positive or negative by name, color, or position
                            const name = (cap.name || '').toUpperCase();

                            // Check material color for red (positive) or black (negative)
                            let isRed = false, isBlack = false;
                            if (cap.material) {
                                const mat = cap.material;
                                const color = mat.color || new THREE.Color();
                                isRed = color.r > 0.5 && color.g < 0.3 && color.b < 0.3;
                                isBlack = color.r < 0.2 && color.g < 0.2 && color.b < 0.2;
                            }

                            const isPositive = name.includes('POS') || name.includes('PLUS') ||
                                name.includes('RED') || isRed ||
                                (center.x > 0 && !isBlack); // use position if no color hint
                            const capType = isPositive ? 'positive' : 'negative';
                            const displayName = isPositive ? 'Positive (+) Cap' : 'Negative (-) Cap';

                            console.log(`Cap ${index}: ${cap.name} -> ${capType} (red:${isRed}, black:${isBlack})`);

                            // Create pivot at the cap base
                            const pivot = new THREE.Group();
                            const hingeWorld = center.clone();
                            hingeWorld.y = bbox.min.y; // hinge at bottom
                            exterior.worldToLocal(hingeWorld);
                            pivot.position.copy(hingeWorld);
                            exterior.add(pivot);
                            pivot.attach(cap);

                            pivot.userData.baseY = pivot.position.y;
                            pivot.userData.baseRot = pivot.rotation.clone();

                            cap.userData.isBatteryCap = true;
                            cap.userData.capIndex = index;
                            cap.userData.capType = capType;
                            cap.userData.capPivot = pivot;
                            cap.userData.displayName = displayName;

                            // Store materials for opacity animation
                            const capMaterials = [];
                            cap.traverse((child) => {
                                if (child.isMesh && child.material) {
                                    child.material = child.material.clone();
                                    child.material.transparent = true;
                                    capMaterials.push(child.material);
                                }
                            });
                            pivot.userData.materials = capMaterials;
                            pivot.userData.opacity = 1;

                            batteryCapPivots.push(pivot);
                            batteryCapState.push({
                                removed: false,
                                target: 0,
                                capType: capType,
                                capName: displayName
                            });
                        } catch (e) { console.warn('battery cap pivot failed', e); }
                    });

                    if (batteryCapMeshes.length > 0) {
                        console.log(`Found ${batteryCapMeshes.length} battery terminal cap(s):`, batteryCapMeshes.map(c => ({ name: c.name, type: c.userData.capType })));
                    }

                    // API functions
                    window.toggleBatteryCap = function (index = 0) {
                        if (!batteryCapPivots || !batteryCapPivots.length) return null;
                        if (index < 0 || index >= batteryCapPivots.length) return null;
                        const state = batteryCapState[index];
                        state.removed = !state.removed;
                        state.target = state.removed ? 1 : 0;
                        return { index, removed: state.removed, name: state.capName, type: state.capType };
                    };

                    window.checkBatteryCap = function (index = 0) {
                        if (!batteryCapState || !batteryCapState[index]) return null;
                        const state = batteryCapState[index];
                        return { index, removed: state.removed, name: state.capName, type: state.capType };
                    };

                    window.onBatteryCapClicked = function (capInfo) {
                        console.log('Battery terminal cap clicked:', capInfo);
                        // Don't toggle immediately - just dispatch event for UI to handle
                        window.dispatchEvent(new CustomEvent('batteryCapClicked', { detail: capInfo }));
                        return capInfo;
                    };

                    // Create tooltip element for hover effect
                    function createCapTooltip() {
                        if (capTooltipElement) return;
                        capTooltipElement = document.createElement('div');
                        capTooltipElement.id = 'cap-tooltip';
                        capTooltipElement.style.cssText = `
                            position: fixed;
                            pointer-events: none;
                            background: rgba(37, 99, 235, 0.95);
                            color: white;
                            padding: 8px 14px;
                            border-radius: 8px;
                            font-family: 'Nunito', sans-serif;
                            font-size: 0.75rem;
                            font-weight: 700;
                            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                            z-index: 10000;
                            display: none;
                            white-space: nowrap;
                            transform: translate(-50%, -120%);
                            transition: opacity 0.2s;
                        `;
                        capTooltipElement.innerHTML = `
                            <div style="display:flex;align-items:center;gap:6px;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12 6 12 12 16 14"/>
                                </svg>
                                <span>Click for options</span>
                            </div>
                            <div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:6px solid rgba(37, 99, 235, 0.95);"></div>
                        `;
                        document.body.appendChild(capTooltipElement);
                    }
                    createCapTooltip();

                    // Function to update tooltip position
                    function updateCapTooltip(screenX, screenY, capInfo) {
                        if (!capTooltipElement) return;
                        if (capInfo) {
                            capTooltipElement.style.display = 'block';
                            capTooltipElement.style.left = screenX + 'px';
                            capTooltipElement.style.top = screenY + 'px';
                            // Change color based on cap type
                            const isPositive = capInfo.type === 'positive';
                            capTooltipElement.style.background = isPositive ? 'rgba(220, 38, 38, 0.95)' : 'rgba(55, 65, 81, 0.95)';
                            capTooltipElement.querySelector('div:last-child').style.borderTopColor = isPositive ? 'rgba(220, 38, 38, 0.95)' : 'rgba(55, 65, 81, 0.95)';
                        } else {
                            capTooltipElement.style.display = 'none';
                        }
                    }

                } catch (e) { console.warn('battery cap setup failed', e); }

                // --- Battery (main body) interaction ---
                try {
                    let batteryMainMesh = null;
                    let batteryCandidates = [];

                    // Debug: log all mesh names first
                    console.log('--- All meshes in scene ---');
                    exterior.traverse((c) => {
                        if (c.isMesh) {
                            const bbox = new THREE.Box3().setFromObject(c);
                            const center = bbox.getCenter(new THREE.Vector3());
                            const size = bbox.getSize(new THREE.Vector3());
                            console.log(`Mesh: "${c.name}" pos:(${center.x.toFixed(2)},${center.y.toFixed(2)},${center.z.toFixed(2)}) size:(${size.x.toFixed(2)},${size.y.toFixed(2)},${size.z.toFixed(2)})`);
                        }
                    });
                    console.log('--- End mesh list ---');

                    // Find the main battery mesh (not caps, not terminals)
                    exterior.traverse((c) => {
                        if (!c.isMesh) return;

                        // Skip meshes already marked as battery caps
                        if (c.userData.isBatteryCap) {
                            console.log('Skipping cap mesh:', c.name);
                            return;
                        }

                        const n = (c.name || '').toUpperCase();

                        // Skip caps and terminals by name
                        if (n.includes('CAP') || n.includes('TERMINAL') ||
                            n.includes('POS') || n.includes('NEG') || n.includes('LID') ||
                            n.includes('BATTERY001') || n.includes('BATTERY002')) return;

                        // Name-based detection - look for battery in name (but not BATTERY001/002 which are caps)
                        const isBatteryByName = (n.includes('BATTERY') && !n.match(/BATTERY00\d/)) ||
                            n.includes('BATT_') || n.includes('BATTERY_CASE') ||
                            n.includes('POWERCELL') || n.includes('CELL') ||
                            n.includes('CASE') || n.includes('BOX');

                        // Size-based detection - car battery dimensions
                        const bbox = new THREE.Box3().setFromObject(c);
                        const size = bbox.getSize(new THREE.Vector3());
                        const center = bbox.getCenter(new THREE.Vector3());

                        // Typical car battery: ~0.2-0.3m x 0.15-0.2m x 0.15-0.25m
                        const isBatteryBySize = size.x > 0.15 && size.y > 0.12 && size.z > 0.10 &&
                            size.x < 0.4 && size.y < 0.35 && size.z < 0.3;

                        // Position: in engine bay, typically front area (positive Z or negative Z depending on model)
                        // and at reasonable height
                        const isEngineBayPosition = center.y > 0.3 && center.y < 1.2;

                        // Higher score for objects named battery
                        let score = 0;
                        if (isBatteryByName) score += 20;
                        if (isBatteryBySize) score += 10;
                        if (isEngineBayPosition) score += 5;

                        // Check if it has the yellow label material (common in car batteries)
                        let hasLabelTexture = false;
                        if (c.material && c.material.name) {
                            const matName = c.material.name.toUpperCase();
                            if (matName.includes('LABEL') || matName.includes('STICKER') ||
                                matName.includes('DECAL') || matName.includes('TEXT')) {
                                hasLabelTexture = true;
                                score += 5;
                            }
                        }

                        // Also check for multiple materials (battery often has casing + label)
                        if (Array.isArray(c.material) && c.material.length > 1) {
                            score += 3;
                        }

                        if (score > 10) {
                            batteryCandidates.push({
                                mesh: c,
                                score: score,
                                size: size,
                                center: center
                            });
                        }
                    });

                    // Pick highest scoring candidate
                    if (batteryCandidates.length > 0) {
                        batteryCandidates.sort((a, b) => b.score - b.score);
                        batteryMainMesh = batteryCandidates[0].mesh;
                        console.log('Battery candidates found:', batteryCandidates.map(c => ({
                            name: c.mesh.name,
                            score: c.score,
                            size: `(${c.size.x.toFixed(2)},${c.size.y.toFixed(2)},${c.size.z.toFixed(2)})`,
                            pos: `(${c.center.x.toFixed(2)},${c.center.y.toFixed(2)},${c.center.z.toFixed(2)})`
                        })));
                    } else {
                        console.warn('No battery candidates found - check mesh names and scene structure');
                    }

                    if (batteryMainMesh) {
                        console.log('Found main battery mesh:', batteryMainMesh.name);

                        // Mark as battery for interaction
                        batteryMainMesh.userData.isBattery = true;
                        batteryMainMesh.userData.batteryRemoved = false;

                        // Also mark all children for raycasting
                        batteryMainMesh.traverse((child) => {
                            if (child.isMesh) {
                                child.userData.isBattery = true;
                                console.log('Marked battery child:', child.name);
                            }
                        });

                        // Create pivot for animation
                        const batteryPivot = new THREE.Group();
                        const battBox = new THREE.Box3().setFromObject(batteryMainMesh);
                        const battCenter = battBox.getCenter(new THREE.Vector3());
                        const battSize = battBox.getSize(new THREE.Vector3());

                        // Pivot at bottom center of battery
                        const pivotWorld = battCenter.clone();
                        pivotWorld.y = battBox.min.y;
                        exterior.worldToLocal(pivotWorld);
                        batteryPivot.position.copy(pivotWorld);
                        exterior.add(batteryPivot);
                        batteryPivot.attach(batteryMainMesh);

                        batteryPivot.userData.baseY = batteryPivot.position.y;
                        batteryPivot.userData.basePos = {
                            x: batteryPivot.position.x,
                            y: batteryPivot.position.y,
                            z: batteryPivot.position.z
                        };
                        batteryPivot.userData.baseRot = batteryPivot.rotation.clone();

                        // Store reference
                        window.batteryPivot = batteryPivot;
                        window.batteryMesh = batteryMainMesh;

                        // API functions
                        window.checkBattery = function () {
                            return {
                                removed: batteryMainMesh.userData.batteryRemoved,
                                name: batteryMainMesh.name || 'Battery'
                            };
                        };

                        window.toggleBattery = function () {
                            const state = batteryMainMesh.userData;
                            state.batteryRemoved = !state.batteryRemoved;

                            console.log('toggleBattery called, new removed state:', state.batteryRemoved);

                            // Ensure visibility when installing (not removed)
                            if (!state.batteryRemoved) {
                                console.log('Ensuring battery visibility');
                                batteryPivot.visible = true;
                                batteryMainMesh.visible = true;
                                batteryPivot.traverse((child) => {
                                    if (child.isMesh) {
                                        child.visible = true;
                                        if (child.material) child.material.visible = true;
                                    }
                                });
                            }

                            // Animate: lift up and rotate when removed
                            const targetY = state.batteryRemoved ? 0.5 : 0; // Lift 0.5 units
                            const targetRot = state.batteryRemoved ? Math.PI * 0.15 : 0; // Slight tilt

                            // Store targets for animation loop
                            batteryPivot.userData.targetY = batteryPivot.userData.baseY + targetY;
                            batteryPivot.userData.targetRot = targetRot;
                            batteryPivot.userData.animate = true;

                            return {
                                removed: state.batteryRemoved,
                                name: batteryMainMesh.name || 'Battery'
                            };
                        };

                        // Install battery at original position (for click-to-install from tools)
                        window.installBattery = function () {
                            const state = batteryMainMesh.userData;

                            console.log('installBattery called, current removed state:', state.batteryRemoved);

                            // Set as not removed
                            state.batteryRemoved = false;

                            // Get base position data
                            const baseY = batteryPivot.userData.baseY || 0;
                            const basePos = batteryPivot.userData.basePos || { x: 0, y: 0, z: 0 };
                            const baseRot = batteryPivot.userData.baseRot || { x: 0, y: 0, z: 0 };

                            // IMMEDIATELY set to ORIGINAL position (engine bay position)
                            batteryPivot.position.set(basePos.x, baseY, basePos.z);
                            batteryPivot.rotation.set(baseRot.x, baseRot.y, baseRot.z);

                            // Reset any animation offsets
                            batteryPivot.userData.currentY = baseY;
                            batteryPivot.userData.currentRot = 0;

                            // Ensure visibility - force pivot, mesh and ALL children visible
                            batteryPivot.visible = true;
                            batteryMainMesh.visible = true;
                            batteryPivot.traverse((child) => {
                                child.visible = true;
                                if (child.isMesh) {
                                    if (child.material) {
                                        child.material.visible = true;
                                        if (child.material.opacity !== undefined) {
                                            child.material.opacity = 1;
                                            child.material.transparent = false;
                                        }
                                    }
                                }
                            });

                            // Disable animation since we're already at target
                            batteryPivot.userData.targetY = baseY;
                            batteryPivot.userData.targetRot = 0;
                            batteryPivot.userData.animate = false;

                            console.log('Battery installed at ORIGINAL position:', batteryPivot.position);

                            return {
                                removed: false,
                                name: batteryMainMesh.name || 'Battery',
                                installed: true,
                                position: batteryPivot.position.clone()
                            };
                        };

                        window.onBatteryClicked = function (batteryInfo, screenX, screenY) {
                            console.log('Battery clicked:', batteryInfo);
                            window.dispatchEvent(new CustomEvent('batteryClicked', {
                                detail: { ...batteryInfo, screenX, screenY }
                            }));
                        };

                        console.log('Battery interaction setup complete');
                    }
                } catch (e) { console.warn('battery setup failed', e); }

                // expose tuning functions to allow live adjustment from UI
                window.tuneHood = function (index = 0, dy = 0, dz = 0) {
                    if (!hoodPivots || !hoodPivots.length) return false;
                    const idx = Math.min(Math.max(0, index), hoodPivots.length - 1);
                    const pivot = hoodPivots[idx];
                    if (!pivot || !pivot.userData.hingeBase) return false;
                    pivot.position.copy(pivot.userData.hingeBase).add(new THREE.Vector3(0, dy, dz));
                    return true;
                };

                window.resetHoodHinge = function (index = 0) {
                    if (!hoodPivots || !hoodPivots.length) return false;
                    const idx = Math.min(Math.max(0, index), hoodPivots.length - 1);
                    const pivot = hoodPivots[idx];
                    if (!pivot || !pivot.userData.hingeBase) return false;
                    pivot.position.copy(pivot.userData.hingeBase);
                    return true;
                };

                // expose toggle API
                window.toggleHood = function (index = 0) {
                    if (!hoodPivots || !hoodPivots.length) {
                        console.warn('toggleHood: hood pivots not ready yet');
                        return null;
                    }
                    const idx = Math.min(Math.max(0, index), hoodPivots.length - 1);
                    hoodState[idx].open = !hoodState[idx].open;
                    hoodState[idx].target = hoodState[idx].open ? -Math.PI * 0.5 * 0.62 : 0;
                    return hoodState[idx].open;
                };

                // pointer click handler to toggle hood by clicking the mesh
                function onPointerDown(event) {
                    const rect = renderer.domElement.getBoundingClientRect();
                    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                    raycaster.setFromCamera(pointer, camera);
                    const intersects = raycaster.intersectObjects(exterior.children, true);
                    for (let inter of intersects) {
                        let obj = inter.object;
                        while (obj && !obj.userData.isHood) obj = obj.parent;
                        if (obj && obj.userData.isHood) {
                            const pivot = obj.userData.hoodPivot;
                            const idx = hoodPivots.indexOf(pivot);
                            if (idx >= 0) {
                                hoodState[idx].open = !hoodState[idx].open;
                                hoodState[idx].target = hoodState[idx].open ? -Math.PI * 0.5 * 0.62 : 0;
                            }
                            break;
                        }
                    }
                }

                // extend pointer handler to toggle doors when clicked
                function onPointerDownDoors(event) {
                    const rect = renderer.domElement.getBoundingClientRect();
                    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                    raycaster.setFromCamera(pointer, camera);
                    const intersects = raycaster.intersectObjects(exterior.children, true);
                    for (let inter of intersects) {
                        let obj = inter.object;
                        while (obj && !obj.userData.isDoor) obj = obj.parent;
                        if (obj && obj.userData.isDoor) {
                            const pivot = obj.userData.doorPivot;
                            const idx = doorPivots.indexOf(pivot);
                            if (idx >= 0) {
                                doorState[idx].open = !doorState[idx].open;
                                doorState[idx].target = doorState[idx].open ? (doorState[idx].openAngle * (doorState[idx].openSign || 1)) : 0;
                            }
                            break;
                        }
                    }
                }

                renderer.domElement.addEventListener('pointerdown', onPointerDown, false);
                renderer.domElement.addEventListener('pointerdown', onPointerDownDoors, false);

                // pointer move handler - shows hover card and tracks cursor
                function onPointerMoveBatteryCaps(event) {
                    const rect = renderer.domElement.getBoundingClientRect();
                    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                    raycaster.setFromCamera(pointer, camera);

                    const intersects = raycaster.intersectObjects(exterior.children, true);
                    let foundCap = null;
                    let foundCapInfo = null;
                    let foundBattery = false;

                    for (let inter of intersects) {
                        let obj = inter.object;

                        // Check for battery cap first
                        while (obj && !obj.userData.isBatteryCap && !obj.userData.isBattery) {
                            obj = obj.parent;
                        }

                        if (obj && obj.userData.isBatteryCap) {
                            const capIndex = obj.userData.capIndex;
                            const capInfo = window.checkBatteryCap(capIndex);
                            if (capInfo) {
                                foundCap = capIndex;
                                foundCapInfo = capInfo;
                                renderer.domElement.style.cursor = 'pointer';

                                // Show hover card following mouse
                                if (window.onBatteryCapHover) {
                                    window.onBatteryCapHover(capInfo, event.clientX, event.clientY);
                                }
                            }
                            break;
                        }

                        // Check for main battery
                        if (obj && obj.userData.isBattery) {
                            console.log('Battery hovered:', obj.name);
                            foundBattery = true;
                            renderer.domElement.style.cursor = 'pointer';

                            // Show battery hover card
                            if (window.onBatteryHover) {
                                const batteryInfo = window.checkBattery();
                                console.log('Calling onBatteryHover with:', batteryInfo);
                                window.onBatteryHover(batteryInfo, event.clientX, event.clientY);
                            } else {
                                console.warn('onBatteryHover not defined');
                            }
                            break;
                        }
                    }

                    if (foundCap === null && !foundBattery) {
                        renderer.domElement.style.cursor = 'default';
                        if (window.onBatteryCapHoverEnd) {
                            window.onBatteryCapHoverEnd();
                        }
                        if (window.onBatteryHoverEnd) {
                            window.onBatteryHoverEnd();
                        }
                    }

                    hoveredCapIndex = foundCap;
                }
                renderer.domElement.addEventListener('pointermove', onPointerMoveBatteryCaps, false);

                // pointer down handler - locks card position when cap or battery is clicked
                function onPointerDownBatteryCaps(event) {
                    const rect = renderer.domElement.getBoundingClientRect();
                    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
                    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
                    raycaster.setFromCamera(pointer, camera);

                    const intersects = raycaster.intersectObjects(exterior.children, true);

                    for (let inter of intersects) {
                        let obj = inter.object;

                        // Check for battery cap
                        while (obj && !obj.userData.isBatteryCap && !obj.userData.isBattery) {
                            obj = obj.parent;
                        }

                        if (obj && obj.userData.isBatteryCap) {
                            const capIndex = obj.userData.capIndex;
                            const capInfo = window.checkBatteryCap(capIndex);
                            if (capInfo && window.onBatteryCapClicked) {
                                // Lock card at click position
                                window.onBatteryCapClicked(capInfo, event.clientX, event.clientY);
                            }
                            break;
                        }

                        // Check for main battery
                        if (obj && obj.userData.isBattery) {
                            if (window.onBatteryClicked) {
                                const batteryInfo = window.checkBattery();
                                window.onBatteryClicked(batteryInfo, event.clientX, event.clientY);
                            }
                            break;
                        }
                    }
                }
                renderer.domElement.addEventListener('pointerdown', onPointerDownBatteryCaps, false);
            } catch (e) {
                console.warn('Hood setup failed', e);
            }
        },
        undefined,
        function (error) {
            console.error(error);
        }
    );

    function animate() {
        requestAnimationFrame(animate);
        controls.update();
        // animate hood pivots towards their targets
        if (hoodPivots && hoodPivots.length) {
            for (let i = 0; i < hoodPivots.length; i++) {
                const pivot = hoodPivots[i];
                const state = hoodState[i] || { target: 0 };
                const cur = pivot.rotation.x;
                const next = THREE.MathUtils.lerp(cur, state.target || 0, 0.08);
                pivot.rotation.x = next;
            }
        }

        // animate door pivots
        if (doorPivots && doorPivots.length) {
            for (let i = 0; i < doorPivots.length; i++) {
                const p = doorPivots[i];
                const st = doorState[i] || { target: 0 };
                const cur = p.rotation.y;
                const next = THREE.MathUtils.lerp(cur, st.target || 0, 0.12);
                p.rotation.y = next;
            }
        }

        // animate battery terminal caps (fade out when removed)
        if (batteryCapPivots && batteryCapPivots.length) {
            for (let i = 0; i < batteryCapPivots.length; i++) {
                const pivot = batteryCapPivots[i];
                const state = batteryCapState[i];
                if (!state) continue;

                // target opacity: 1 = visible, 0 = removed (invisible)
                const targetOpacity = state.removed ? 0 : 1;
                pivot.userData.opacity = THREE.MathUtils.lerp(pivot.userData.opacity || 1, targetOpacity, 0.15);

                // Apply opacity to all materials
                if (pivot.userData.materials) {
                    pivot.userData.materials.forEach(mat => {
                        mat.opacity = pivot.userData.opacity;
                    });
                }

                // Hide completely when fully transparent
                if (pivot.children[0]) {
                    pivot.children[0].visible = pivot.userData.opacity > 0.01;
                }
            }
        }

        // animate battery (lift up when removed)
        if (window.batteryPivot && window.batteryPivot.userData.animate) {
            const pivot = window.batteryPivot;
            const targetY = pivot.userData.targetY || pivot.userData.baseY;
            const targetRot = pivot.userData.targetRot || 0;

            pivot.position.y = THREE.MathUtils.lerp(pivot.position.y, targetY, 0.08);
            pivot.rotation.x = THREE.MathUtils.lerp(pivot.rotation.x, targetRot, 0.08);

            // Stop animating when close to target
            if (Math.abs(pivot.position.y - targetY) < 0.001 &&
                Math.abs(pivot.rotation.x - targetRot) < 0.001) {
                pivot.userData.animate = false;
            }
        }
        renderer.render(scene, camera);
    }

    animate();

    const syncToContainer = () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        if (activeExterior) frameModel(activeExterior);
    };

    if (window.ResizeObserver) {
        const observer = new ResizeObserver(() => syncToContainer());
        observer.observe(container);
    }

    window.addEventListener('resize', () => {
        syncToContainer();
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThreeScene, { once: true });
} else {
    initThreeScene();
}

