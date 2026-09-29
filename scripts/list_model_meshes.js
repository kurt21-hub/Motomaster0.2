import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import * as THREE from '../three.module.js';
import { GLTFLoader } from '../GLTFLoader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '..', 'models', 'NEW_CARWITHENGINE.glb');

const loader = new GLTFLoader();

try {
    const data = await fs.readFile(filePath);
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);

    loader.parse(arrayBuffer, path.dirname(filePath) + '/', (gltf) => {
        const meshes = [];
        gltf.scene.traverse((child) => {
            if (child.isMesh) {
                meshes.push({ name: child.name || '(unnamed)', visible: child.visible, materialType: child.material?.type });
            }
        });
        console.log(JSON.stringify(meshes, null, 2));
    }, (err) => { console.error('Parse error:', err); });
} catch (err) {
    console.error(err);
}
