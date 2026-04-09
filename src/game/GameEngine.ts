import * as THREE from 'three';
import {
    addBroadphaseLayer,
    addObjectLayer,
    box,
    createWorld,
    createWorldSettings,
    enableCollision,
    filter,
    MotionType,
    registerAll,
    rigidBody,
    updateWorld,
    World,
    RigidBody
} from 'crashcat';
import { quat, vec3 } from 'mathcat';
import {
    Vehicle,
    createVehicle,
    addWheel,
    addAntiRollBar,
    setEngineForce,
    setSteeringValue,
    setBrakeValue,
    updateVehicle,
    WheelOptions
} from './VehiclePhysics';

export type GameState = {
    score: number;
    timeLeft: number;
    gameOver: boolean;
    gameWon: boolean;
    speed: number;
    nitro: number;
    multiplier: number;
    distance: number;
};

export class GameEngine {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private world: World;
    private vehicle!: Vehicle;
    private chassisMesh!: THREE.Group;
    private wheelMeshes: THREE.Group[] = [];
    private controls = { forward: false, backward: false, left: false, right: false, brake: false, nitro: false };
    private lastTime: number = 0;
    private animationFrameId: number = 0;
    private timerId: any;
    private currentLookAt: THREE.Vector3 = new THREE.Vector3();
    
    private coins: { mesh: THREE.Group, body: RigidBody, collected: boolean, basePos: THREE.Vector3 }[] = [];
    private traffic: { mesh: THREE.Group, body: RigidBody, speed: number, lane: number }[] = [];
    private onStateChange: (state: GameState) => void;
    
    public state: GameState = {
        score: 0,
        timeLeft: 60,
        gameOver: false,
        gameWon: false,
        speed: 0,
        nitro: 100,
        multiplier: 1,
        distance: 0
    };

    private roadLength = 2000;
    private startZ = 50;
    private layerMoving!: number;
    private queryFilter!: any;

    constructor(canvas: HTMLCanvasElement, onStateChange: (state: GameState) => void) {
        this.onStateChange = onStateChange;
        
        // --- Three.js Setup (Forza Horizon Vibe) ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#87CEEB'); // Bright Sky Blue
        this.scene.fog = new THREE.Fog('#87CEEB', 100, 500);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // Strong Sunlight
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
        sunLight.position.set(100, 200, 100);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.camera.left = -150;
        sunLight.shadow.camera.right = 150;
        sunLight.shadow.camera.top = 150;
        sunLight.shadow.camera.bottom = -150;
        sunLight.shadow.bias = -0.0001;
        this.scene.add(sunLight);

        // --- Physics Setup ---
        registerAll();
        const worldSettings = createWorldSettings();
        const BROADPHASE_MOVING = addBroadphaseLayer(worldSettings);
        const BROADPHASE_STATIC = addBroadphaseLayer(worldSettings);
        const LAYER_MOVING = addObjectLayer(worldSettings, BROADPHASE_MOVING);
        const LAYER_STATIC = addObjectLayer(worldSettings, BROADPHASE_STATIC);

        enableCollision(worldSettings, LAYER_MOVING, LAYER_MOVING);
        enableCollision(worldSettings, LAYER_MOVING, LAYER_STATIC);

        this.world = createWorld(worldSettings);
        this.queryFilter = filter.create(worldSettings.layers);
        filter.enableAllLayers(this.queryFilter, worldSettings.layers);
        this.layerMoving = LAYER_MOVING;

        // --- Track Generation ---
        this.createScenicTrack(LAYER_STATIC);

        // --- Vehicle Setup ---
        this.createSupercarVehicle(LAYER_MOVING, this.queryFilter);
        
        // --- Coins Setup ---
        this.createFestivalRings(LAYER_STATIC);

        // --- Traffic Setup ---
        this.spawnTraffic(LAYER_MOVING);

        // --- Input ---
        this.setupInput();

        // --- Start Loop ---
        this.lastTime = performance.now();
        this.animate();
        
        // --- Timer ---
        this.timerId = setInterval(() => {
            if (!this.state.gameOver && !this.state.gameWon) {
                this.state.timeLeft -= 1;
                if (this.state.timeLeft <= 0) {
                    this.state.timeLeft = 0;
                    this.state.gameOver = true;
                }
                this.notifyStateChange();
            }
        }, 1000);
    }

    private createScenicTrack(layerStatic: number) {
        const roadWidth = 40;
        const roadLength = 2000;
        const startZ = 50;
        const endZ = startZ - roadLength;

        // Dry Asphalt Road
        const roadGeom = new THREE.PlaneGeometry(roadWidth, roadLength);
        roadGeom.rotateX(-Math.PI / 2);
        const roadMat = new THREE.MeshStandardMaterial({ 
            color: '#333333', 
            roughness: 0.8,
            metalness: 0.1
        });
        const roadMesh = new THREE.Mesh(roadGeom, roadMat);
        roadMesh.position.set(0, 0, startZ - roadLength / 2);
        roadMesh.receiveShadow = true;
        this.scene.add(roadMesh);

        // Grass/Terrain
        const terrainGeom = new THREE.PlaneGeometry(1000, 2000);
        terrainGeom.rotateX(-Math.PI / 2);
        const terrainMat = new THREE.MeshStandardMaterial({ color: '#4CAF50', roughness: 1.0 });
        const terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
        terrainMesh.position.set(0, -0.1, startZ - roadLength / 2);
        terrainMesh.receiveShadow = true;
        this.scene.add(terrainMesh);

        // Road Physics
        const trackShape = box.create({ halfExtents: [500, 1, 1000], convexRadius: 0.05 });
        rigidBody.create(this.world, {
            shape: trackShape,
            objectLayer: layerStatic,
            motionType: MotionType.STATIC,
            position: vec3.fromValues(0, -1, startZ - roadLength / 2),
            restitution: 0.1,
            friction: 0.9,
        });

        // Road Lines (Yellow)
        const lineGeom = new THREE.PlaneGeometry(0.5, 4);
        lineGeom.rotateX(-Math.PI / 2);
        const lineMat = new THREE.MeshBasicMaterial({ color: '#FFD700' });
        for (let z = startZ; z > endZ; z -= 10) {
            const line = new THREE.Mesh(lineGeom, lineMat);
            line.position.set(0, 0.01, z);
            this.scene.add(line);
        }

        // Festival Banners & Trees
        const bannerGeom = new THREE.BoxGeometry(0.2, 10, 4);
        const bannerMat = new THREE.MeshStandardMaterial({ color: '#E91E63' }); // Pink Festival Color
        
        const treeTrunkGeom = new THREE.CylinderGeometry(0.5, 0.7, 4);
        const treeTrunkMat = new THREE.MeshStandardMaterial({ color: '#5D4037' });
        const treeTopGeom = new THREE.ConeGeometry(3, 8, 8);
        const treeTopMat = new THREE.MeshStandardMaterial({ color: '#2E7D32' });

        for (let z = startZ; z > endZ; z -= 40) {
            // Left Tree
            const trunkL = new THREE.Mesh(treeTrunkGeom, treeTrunkMat);
            trunkL.position.set(-roadWidth / 2 - 5, 2, z);
            trunkL.castShadow = true;
            this.scene.add(trunkL);
            const topL = new THREE.Mesh(treeTopGeom, treeTopMat);
            topL.position.set(-roadWidth / 2 - 5, 8, z);
            topL.castShadow = true;
            this.scene.add(topL);

            // Right Tree
            const trunkR = new THREE.Mesh(treeTrunkGeom, treeTrunkMat);
            trunkR.position.set(roadWidth / 2 + 5, 2, z + 20);
            trunkR.castShadow = true;
            this.scene.add(trunkR);
            const topR = new THREE.Mesh(treeTopGeom, treeTopMat);
            topR.position.set(roadWidth / 2 + 5, 8, z + 20);
            topR.castShadow = true;
            this.scene.add(topR);

            // Festival Banners every 120 units
            if (z % 120 === 0) {
                const banner = new THREE.Mesh(bannerGeom, bannerMat);
                banner.position.set(-roadWidth / 2 - 1, 5, z);
                this.scene.add(banner);
                
                const bannerR = new THREE.Mesh(bannerGeom, bannerMat);
                bannerR.position.set(roadWidth / 2 + 1, 5, z);
                this.scene.add(bannerR);
            }
        }
    }

    private createSupercarVehicle(layerMoving: number, queryFilter: any) {
        const chassisHalfWidth = 1.1;
        const chassisHalfHeight = 0.3;
        const chassisHalfLength = 2.5;

        const chassisShape = box.create({ halfExtents: [chassisHalfWidth, chassisHalfHeight, chassisHalfLength], convexRadius: 0.05 });
        const chassisBody = rigidBody.create(this.world, {
            shape: chassisShape,
            objectLayer: layerMoving,
            motionType: MotionType.DYNAMIC,
            position: vec3.fromValues(0, 2, 0),
            quaternion: quat.create(),
            mass: 1500,
            restitution: 0.1,
            friction: 0.5,
        });

        this.vehicle = createVehicle(chassisBody, queryFilter);

        const wheelRadius = 0.4;
        const wheelWidth = 0.35;
        const vehicleWidth = 2.3;
        const vehicleHeight = -0.1;
        const vehicleFront = -1.5;
        const vehicleBack = 1.5;

        const commonWheelOptions: Omit<WheelOptions, 'chassisConnectionPointLocal'> = {
            radius: wheelRadius,
            directionLocal: vec3.fromValues(0, -1, 0),
            axleLocal: vec3.fromValues(1, 0, 0),
            suspensionFrequency: 2.2,
            suspensionDamping: 0.8, 
            suspensionRestLength: 0.3,
            maxSuspensionForce: 250000,
            maxSuspensionTravel: 0.3,
            suspensionForcePoint: null,
            sideFrictionStiffness: 2.8,
            frictionSlip: 3.5, 
            rollInfluence: 0.01,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true,
            forwardAcceleration: 1.8,
            sideAcceleration: 1.8,
        };

        addWheel(this.vehicle, { ...commonWheelOptions, chassisConnectionPointLocal: vec3.fromValues(-vehicleWidth * 0.5, vehicleHeight, vehicleFront) });
        addWheel(this.vehicle, { ...commonWheelOptions, chassisConnectionPointLocal: vec3.fromValues(vehicleWidth * 0.5, vehicleHeight, vehicleFront) });
        addWheel(this.vehicle, { ...commonWheelOptions, chassisConnectionPointLocal: vec3.fromValues(-vehicleWidth * 0.5, vehicleHeight, vehicleBack) });
        addWheel(this.vehicle, { ...commonWheelOptions, chassisConnectionPointLocal: vec3.fromValues(vehicleWidth * 0.5, vehicleHeight, vehicleBack) });

        addAntiRollBar(this.vehicle, { leftWheel: 0, rightWheel: 1, stiffness: 20000 });
        addAntiRollBar(this.vehicle, { leftWheel: 2, rightWheel: 3, stiffness: 20000 });

        // --- Supercar Mesh ---
        this.chassisMesh = new THREE.Group();
        
        // Main body (Vibrant Orange)
        const bodyGeom = new THREE.BoxGeometry(chassisHalfWidth * 2, chassisHalfHeight * 2, chassisHalfLength * 2);
        const bodyMat = new THREE.MeshPhysicalMaterial({ 
            color: '#FF5722',
            roughness: 0.1,
            metalness: 0.3,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });
        const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
        bodyMesh.castShadow = true;
        this.chassisMesh.add(bodyMesh);

        // Aerodynamic Cabin
        const cabinGeom = new THREE.SphereGeometry(1, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2);
        const cabinMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0, metalness: 1 });
        const cabinMesh = new THREE.Mesh(cabinGeom, cabinMat);
        cabinMesh.scale.set(chassisHalfWidth * 0.8, chassisHalfHeight * 1.5, chassisHalfLength * 0.4);
        cabinMesh.position.set(0, chassisHalfHeight, -0.2);
        this.chassisMesh.add(cabinMesh);

        // Headlights
        const headLightGeom = new THREE.PlaneGeometry(0.5, 0.2);
        const headLightMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
        const headL = new THREE.Mesh(headLightGeom, headLightMat);
        headL.position.set(-0.7, 0, -chassisHalfLength - 0.01);
        const headR = new THREE.Mesh(headLightGeom, headLightMat);
        headR.position.set(0.7, 0, -chassisHalfLength - 0.01);
        this.chassisMesh.add(headL);
        this.chassisMesh.add(headR);

        this.scene.add(this.chassisMesh);

        // --- Wheels ---
        const wheelGeom = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 32);
        const wheelMat = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.8 });
        const rimGeom = new THREE.CylinderGeometry(wheelRadius * 0.7, wheelRadius * 0.7, wheelWidth * 1.1, 5);
        const rimMat = new THREE.MeshStandardMaterial({ color: '#333333', metalness: 1, roughness: 0.2 });
        
        for (let i = 0; i < 4; i++) {
            const group = new THREE.Group();
            const tire = new THREE.Mesh(wheelGeom, wheelMat);
            tire.rotation.z = Math.PI / 2;
            tire.castShadow = true;
            group.add(tire);
            const rim = new THREE.Mesh(rimGeom, rimMat);
            rim.rotation.z = Math.PI / 2;
            group.add(rim);
            this.scene.add(group);
            this.wheelMeshes.push(group);
        }
    }

    private createFestivalRings(layerStatic: number) {
        const ringGeom = new THREE.TorusGeometry(3, 0.3, 16, 32);
        const ringMat = new THREE.MeshStandardMaterial({ 
            color: '#E91E63', 
            emissive: '#E91E63',
            emissiveIntensity: 0.5
        });
        
        const ringPositions = [
            [0, 3, -50],
            [-10, 3, -180],
            [10, 3, -320],
            [0, 3, -480],
            [15, 3, -620],
            [-15, 3, -780],
            [0, 3, -920],
            [-10, 3, -1080],
            [10, 3, -1220],
            [0, 3, -1400], 
        ];

        for (const pos of ringPositions) {
            const group = new THREE.Group();
            group.position.set(pos[0], pos[1], pos[2]);
            const mesh = new THREE.Mesh(ringGeom, ringMat);
            group.add(mesh);
            this.scene.add(group);
            this.coins.push({ 
                mesh: group, 
                body: null as any, 
                collected: false,
                basePos: new THREE.Vector3(pos[0], pos[1], pos[2])
            });
        }
    }

    private spawnTraffic(layerMoving: number) {
        const carGeom = new THREE.BoxGeometry(2, 1.2, 4);
        const colors = ['#333333', '#555555', '#111111', '#ffffff', '#444444'];
        
        for (let i = 0; i < 25; i++) {
            const lane = Math.floor(Math.random() * 4) - 1.5; // Lanes at -1.5, -0.5, 0.5, 1.5
            const z = -100 - Math.random() * 1800;
            const x = lane * 10;
            const speed = 15 + Math.random() * 15;

            const mesh = new THREE.Group();
            const bodyMesh = new THREE.Mesh(carGeom, new THREE.MeshStandardMaterial({ color: colors[Math.floor(Math.random() * colors.length)] }));
            bodyMesh.castShadow = true;
            mesh.add(bodyMesh);

            // Headlights for traffic
            const lightGeom = new THREE.PlaneGeometry(0.4, 0.2);
            const lightMat = new THREE.MeshBasicMaterial({ color: '#ffffaa' });
            const l1 = new THREE.Mesh(lightGeom, lightMat);
            l1.position.set(-0.6, 0, -2.01);
            const l2 = new THREE.Mesh(lightGeom, lightMat);
            l2.position.set(0.6, 0, -2.01);
            mesh.add(l1, l2);

            mesh.position.set(x, 0.6, z);
            this.scene.add(mesh);

            const shape = box.create({ halfExtents: [1, 0.6, 2], convexRadius: 0.05 });
            const body = rigidBody.create(this.world, {
                shape,
                objectLayer: layerMoving,
                motionType: MotionType.KINEMATIC,
                position: vec3.fromValues(x, 0.6, z),
                restitution: 0.1,
                friction: 0.5,
            });

            this.traffic.push({ mesh, body, speed, lane });
        }
    }

    private setupInput() {
        const onKeyDown = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': this.controls.forward = true; break;
                case 'KeyS': case 'ArrowDown': this.controls.backward = true; break;
                case 'KeyA': case 'ArrowLeft': this.controls.left = true; break;
                case 'KeyD': case 'ArrowRight': this.controls.right = true; break;
                case 'Space': this.controls.brake = true; break;
                case 'ShiftLeft': case 'ShiftRight': this.controls.nitro = true; break;
            }
        };
        const onKeyUp = (e: KeyboardEvent) => {
            switch (e.code) {
                case 'KeyW': case 'ArrowUp': this.controls.forward = false; break;
                case 'KeyS': case 'ArrowDown': this.controls.backward = false; break;
                case 'KeyA': case 'ArrowLeft': this.controls.left = false; break;
                case 'KeyD': case 'ArrowRight': this.controls.right = false; break;
                case 'Space': this.controls.brake = false; break;
                case 'ShiftLeft': case 'ShiftRight': this.controls.nitro = false; break;
            }
        };
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
    }

    private notifyStateChange() {
        this.onStateChange({ ...this.state });
    }

    public resize(width: number, height: number) {
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    private animate = () => {
        this.animationFrameId = requestAnimationFrame(this.animate);

        const now = performance.now();
        const delta = Math.min((now - this.lastTime) / 1000, 1 / 30);
        this.lastTime = now;

        if (this.state.gameOver || this.state.gameWon) return;

        // Apply controls
        let engineForce = 0;
        let steering = 0;
        let maxForce = 6000; 
        const maxSteer = 0.35;
        const maxBrake = 200;

        // Nitro Logic
        if (this.controls.nitro && this.state.nitro > 0) {
            maxForce *= 2.5;
            this.state.nitro -= delta * 30;
            // Nitro visual effect (FOV increase)
            this.camera.fov += 5;
        } else {
            this.state.nitro = Math.min(100, this.state.nitro + delta * 5);
        }

        if (this.controls.forward) engineForce += maxForce;
        if (this.controls.backward) engineForce -= maxForce;
        if (this.controls.left) steering += maxSteer;
        if (this.controls.right) steering -= maxSteer;
        const brakeForce = this.controls.brake ? maxBrake : 0;

        for (let i = 0; i < 4; i++) setBrakeValue(this.vehicle, brakeForce, i);
        setSteeringValue(this.vehicle, steering, 0);
        setSteeringValue(this.vehicle, steering, 1);
        
        setEngineForce(this.vehicle, engineForce, 0);
        setEngineForce(this.vehicle, engineForce, 1);
        setEngineForce(this.vehicle, engineForce, 2);
        setEngineForce(this.vehicle, engineForce, 3);

        // Physics step
        updateVehicle(this.world, this.vehicle, delta);
        updateWorld(this.world, undefined, delta);

        const cb = this.vehicle.chassisBody;

        // Update Traffic
        for (const t of this.traffic) {
            const pos = t.body.position;
            pos[2] -= t.speed * delta;
            // Loop traffic
            if (pos[2] < -1950) pos[2] = 50;
            if (pos[2] > 50) pos[2] = -1950;
            
            t.body.position = pos;
            t.mesh.position.set(pos[0], pos[1], pos[2]);

            // Near Miss Detection
            const dist = new THREE.Vector3(cb.position[0], cb.position[1], cb.position[2]).distanceTo(new THREE.Vector3(pos[0], pos[1], pos[2]));
            if (dist < 4.5 && dist > 2.5) {
                this.state.score += Math.floor(this.state.multiplier * 5);
                this.state.multiplier = Math.min(10, this.state.multiplier + 0.05);
            }
        }

        // Update meshes
        this.chassisMesh.position.set(cb.position[0], cb.position[1], cb.position[2]);
        this.chassisMesh.quaternion.set(cb.quaternion[0], cb.quaternion[1], cb.quaternion[2], cb.quaternion[3]);

        for (let i = 0; i < 4; i++) {
            const w = this.vehicle.wheels[i];
            const wm = this.wheelMeshes[i];
            wm.position.set(w.state.worldTransformPosition[0], w.state.worldTransformPosition[1], w.state.worldTransformPosition[2]);
            wm.quaternion.set(w.state.worldTransformQuaternion[0], w.state.worldTransformQuaternion[1], w.state.worldTransformQuaternion[2], w.state.worldTransformQuaternion[3]);
        }

        const velocity = new THREE.Vector3(cb.motionProperties.linearVelocity[0], cb.motionProperties.linearVelocity[1], cb.motionProperties.linearVelocity[2]);
        const speed = velocity.length();
        this.state.speed = Math.round(speed * 3.6); 
        
        // Multiplier Logic
        if (this.state.speed > 150) {
            this.state.multiplier = Math.min(10, this.state.multiplier + delta * 0.1);
            this.state.score += Math.floor(this.state.speed * delta * this.state.multiplier * 0.1);
        } else {
            this.state.multiplier = Math.max(1, this.state.multiplier - delta * 0.5);
        }

        // Distance Progress
        this.state.distance = Math.min(100, Math.abs(cb.position[2] / 2000) * 100);
        if (this.state.distance >= 99 && this.state.score > 100) {
            this.state.gameWon = true;
        }

        if (this.animationFrameId % 5 === 0) {
            this.notifyStateChange();
        }

        const targetFov = 70 + (speed * 0.6);
        this.camera.fov += (targetFov - this.camera.fov) * 0.1;
        this.camera.updateProjectionMatrix();

        const idealOffset = new THREE.Vector3(0, 3, 8);
        idealOffset.applyQuaternion(this.chassisMesh.quaternion);
        idealOffset.add(this.chassisMesh.position);
        if (idealOffset.y < 1) idealOffset.y = 1;

        const idealLookAt = new THREE.Vector3(0, 1, -10);
        idealLookAt.applyQuaternion(this.chassisMesh.quaternion);
        idealLookAt.add(this.chassisMesh.position);

        this.camera.position.lerp(idealOffset, 1.0 - Math.pow(0.0001, delta));
        this.currentLookAt.lerp(idealLookAt, 1.0 - Math.pow(0.0001, delta));
        this.camera.lookAt(this.currentLookAt);

        const carPos = new THREE.Vector3(cb.position[0], cb.position[1], cb.position[2]);
        let coinsCollectedThisFrame = false;
        
        for (const coin of this.coins) {
            if (!coin.collected) {
                coin.mesh.rotation.y += delta * 3;
                if (carPos.distanceTo(coin.basePos) < 6.0) {
                    coin.collected = true;
                    coin.mesh.visible = false;
                    this.state.score += 10;
                    coinsCollectedThisFrame = true;
                }
            }
        }

        if (coinsCollectedThisFrame) {
            if (this.coins.every(c => c.collected)) {
                this.state.gameWon = true;
            }
            this.notifyStateChange();
        }

        this.renderer.render(this.scene, this.camera);
    };

    public cleanup() {
        cancelAnimationFrame(this.animationFrameId);
        clearInterval(this.timerId);
        this.renderer.dispose();
    }
}
