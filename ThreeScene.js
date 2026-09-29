async function initThreeScene() {
    const THREE = await import('./three.module.js');
    const { OrbitControls } = await import('./OrbitControls.js');
    const { GLTFLoader } = await import('./GLTFLoader.js');
    const container = document.querySelector('.simulation-area');
    if (!container || typeof THREE === 'undefined') return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 4.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // position canvas and attach
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.top = '0';
    renderer.domElement.style.left = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.zIndex = '6';
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.minDistance = 2.6;
    controls.maxDistance = 6.8;
    controls.maxPolarAngle = Math.PI * 0.78;

    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('pointerdown', () => { renderer.domElement.style.cursor = 'grabbing'; });
    window.addEventListener('pointerup', () => { renderer.domElement.style.cursor = 'grab'; });
    renderer.domElement.addEventListener('pointerleave', () => { renderer.domElement.style.cursor = 'grab'; });

    const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 0.65);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.8);
    keyLight.position.set(4, 6, 3);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 20;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xffd7c2, 0.8);
    fillLight.position.set(-4, 2, 3);
    scene.add(fillLight);

    const loader = new GLTFLoader();
    let model = null;
    const meshNames = [];

    function frameModel(target) {
        const box = new THREE.Box3().setFromObject(target);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        target.position.x -= center.x;
        target.position.y -= center.y;
        target.position.z -= center.z;

        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
            const scale = 2.15 / maxDim;
            target.scale.setScalar(scale);
        }

        target.position.y = -0.08;
        camera.position.set(0.9, 0.6, 2.6);
        controls.target.set(0, 0.12, 0);
        controls.update();
    }

    loader.load('models/NEW_CARWITHENGINE.glb', function (gltf) {
        model = gltf.scene;
        model.rotation.y = Math.PI * 0.28;

        const explicitHide = new Set(['DASHBOARD', 'SEATS', 'INTERIOR']);
        model.traverse((child) => {
            if (!child.isMesh) return;
            meshNames.push(child.name || '(unnamed)');
            child.castShadow = true;
            child.receiveShadow = true;

            const nameUpper = (child.name || '').toUpperCase();
            if (explicitHide.has(nameUpper)) { child.visible = false; return; }

            // simple fallback material fixes
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach((m) => { if (!m) return; m.side = THREE.FrontSide; m.transparent = false; m.opacity = 1; if (m.map) m.map.encoding = THREE.sRGBEncoding; m.needsUpdate = true; });

            try { if (child.geometry && child.geometry.isBufferGeometry) child.geometry.computeVertexNormals(); } catch (e) { console.warn('computeVertexNormals failed for', child.name, e); }
        });

        console.log('Car GLB mesh names:', meshNames);

        const ground = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), new THREE.ShadowMaterial({ opacity: 0.35 }));
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.58;
        ground.receiveShadow = true;
        scene.add(ground);

        scene.add(model);
        frameModel(model);
    }, undefined, function (error) { console.error(error); });

    function animate() { requestAnimationFrame(animate); if (model) model.rotation.y += 0; controls.update(); renderer.render(scene, camera); }
    animate();

    window.addEventListener('resize', () => { camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(container.clientWidth, container.clientHeight); });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThreeScene, { once: true });
} else {
    initThreeScene();
}