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
    speed: number;
    nitro: number;
    distance: number;
    laps: number;
    lastLapTime: number;
    bestLapTime: number;
    currentLapTime: number;
    carPosition: { x: number; z: number };
    gameOver: boolean;
    isPaused: boolean;
};

export class GameEngine {
    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private world: World;
    private vehicle!: Vehicle;
    private chassisMesh!: THREE.Group;
    private wheelMeshes: THREE.Group[] = [];
    private controls = { forward: false, backward: false, left: false, right: false, brake: false, nitro: false, reset: false };
    private lastTime: number = 0;
    private animationFrameId: number = 0;
    private timerId: any;
    private currentLookAt: THREE.Vector3 = new THREE.Vector3();
    private flipTimer: number = 0;
    
    private onStateChange: (state: GameState) => void;
    
    public state: GameState = {
        speed: 0,
        nitro: 100,
        distance: 0,
        laps: 0,
        lastLapTime: 0,
        bestLapTime: 0,
        currentLapTime: 0,
        carPosition: { x: 0, z: 0 },
        gameOver: false,
        isPaused: false,
    };

    private roadRadius = 400;
    private roadWidth = 40;
    private layerMoving!: number;
    private queryFilter!: any;
    
    // Juice
    private speedLines: THREE.Line[] = [];
    private shakeAmount: number = 0;
    private targetShake: number = 0;
    private lastAngle: number = 0;
    private hasPassedCheckpoint: boolean = false;
    private raceStarted: boolean = false;
    private carColor: string;
    private trackId: string;

    constructor(canvas: HTMLCanvasElement, onStateChange: (state: GameState) => void, carColor: string = '#FF5722', trackId: string = 'circle') {
        this.onStateChange = onStateChange;
        this.carColor = carColor;
        this.trackId = trackId;
        
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
        
        // --- Input ---
        this.setupInput();

        // --- Juice ---
        this.setupJuice();

        // --- Start Loop ---
        this.lastTime = performance.now();
        this.animate();
    }

    private getTrackPoint(angle: number): { x: number, z: number, dx: number, dz: number } {
        if (this.trackId === 'nebula') {
            const R = 700;
            const A = 250;
            const N = 5;
            const r = R + A * Math.sin(N * angle);
            const dr = A * N * Math.cos(N * angle);
            const x = r * Math.cos(angle);
            const z = r * Math.sin(angle);
            const dx = dr * Math.cos(angle) - r * Math.sin(angle);
            const dz = dr * Math.sin(angle) + r * Math.cos(angle);
            return { x, z, dx, dz };
        }
        if (this.trackId === 'serpentine') {
            const R = 600;
            const A = 200;
            const N = 3;
            const r = R + A * Math.sin(N * angle);
            const dr = A * N * Math.cos(N * angle);
            const x = r * Math.cos(angle);
            const z = r * Math.sin(angle);
            const dx = dr * Math.cos(angle) - r * Math.sin(angle);
            const dz = dr * Math.sin(angle) + r * Math.cos(angle);
            return { x, z, dx, dz };
        }
        const a = this.trackId === 'oval' ? 800 : 400;
        const b = 400;
        const x = Math.cos(angle) * a;
        const z = Math.sin(angle) * b;
        const dx = -a * Math.sin(angle);
        const dz = b * Math.cos(angle);
        return { x, z, dx, dz };
    }

    private createScenicTrack(layerStatic: number) {
        const segments = this.trackId === 'nebula' ? 480 : (this.trackId === 'serpentine' ? 360 : (this.trackId === 'oval' ? 240 : 120));
        const maxRadius = this.trackId === 'nebula' ? 950 : (this.trackId === 'serpentine' ? 800 : (this.trackId === 'oval' ? 800 : 400));
        const segmentLength = (2 * Math.PI * maxRadius) / segments + 2; // +2 for overlap
        
        // --- Physics Ground Plane (Seamless) ---
        // Surface at y = -0.1 to allow road meshes to sit at y = 0
        // Thickened to 100 units to prevent high-speed tunneling
        const groundShape = box.create({ halfExtents: [2000, 50, 2000], convexRadius: 0 });
        rigidBody.create(this.world, {
            shape: groundShape,
            objectLayer: layerStatic,
            motionType: MotionType.STATIC,
            position: vec3.fromValues(0, -50.1, 0), 
            restitution: 0.1,
            friction: 0.9,
        });

        // Visual Grass Plane
        const grassGeom = new THREE.PlaneGeometry(4000, 4000);
        grassGeom.rotateX(-Math.PI / 2);
        const grassMat = new THREE.MeshStandardMaterial({ color: this.trackId === 'nebula' ? '#0a001a' : (this.trackId === 'serpentine' ? '#1a0505' : (this.trackId === 'oval' ? '#0a0a1a' : '#388E3C')), roughness: 1 });
        const grass = new THREE.Mesh(grassGeom, grassMat);
        grass.position.y = -0.15;
        grass.receiveShadow = true;
        this.scene.add(grass);

        const roadMat = new THREE.MeshStandardMaterial({ 
            color: this.trackId === 'nebula' ? '#0f0f1a' : (this.trackId === 'serpentine' ? '#151515' : (this.trackId === 'oval' ? '#111111' : '#222222')), 
            roughness: 0.7,
            metalness: 0.2
        });
        const roadGeom = new THREE.BoxGeometry(this.roadWidth, 0.2, segmentLength);

        const terrainMat = new THREE.MeshStandardMaterial({ color: this.trackId === 'nebula' ? '#1a0a2e' : (this.trackId === 'serpentine' ? '#2a0a0a' : (this.trackId === 'oval' ? '#1a1a2e' : '#4CAF50')), roughness: 1.0 });
        const terrainGeom = new THREE.BoxGeometry(400, 0.1, segmentLength);

        const lineGeom = new THREE.PlaneGeometry(0.6, 4);
        lineGeom.rotateX(-Math.PI / 2);
        const lineMat = new THREE.MeshBasicMaterial({ color: this.trackId === 'nebula' ? '#b026ff' : (this.trackId === 'serpentine' ? '#FF3366' : (this.trackId === 'oval' ? '#00E5FF' : '#FFD700')) });

        const treeTrunkGeom = new THREE.CylinderGeometry(0.6, 0.8, 5);
        const treeTrunkMat = new THREE.MeshStandardMaterial({ color: '#4E342E' });
        const treeTopGeom = new THREE.ConeGeometry(4, 10, 8);
        const treeTopMat = new THREE.MeshStandardMaterial({ color: '#1B5E20' });
        
        const roundTreeTopGeom = new THREE.SphereGeometry(5, 8, 8);
        const roundTreeTopMat = new THREE.MeshStandardMaterial({ color: '#2E7D32' });

        const bannerGeom = new THREE.BoxGeometry(0.3, 12, 5);
        const bannerMat = new THREE.MeshStandardMaterial({ color: '#E91E63' });

        // Barrier Physics - Using MANY segments for barriers to follow the curve perfectly
        const barrierSegments = this.trackId === 'nebula' ? 960 : (this.trackId === 'serpentine' ? 720 : (this.trackId === 'oval' ? 480 : 360)); 
        const barrierSegmentLength = (2 * Math.PI * maxRadius) / barrierSegments + 1;
        const barrierHeight = 10;
        const barrierThickness = 3;
        const barrierGeom = new THREE.BoxGeometry(barrierThickness, barrierHeight, barrierSegmentLength); 
        const barrierMat = new THREE.MeshStandardMaterial({ color: this.trackId === 'nebula' ? '#b026ff' : (this.trackId === 'serpentine' ? '#FF3366' : (this.trackId === 'oval' ? '#00E5FF' : '#ffffff')), transparent: true, opacity: this.trackId === 'circle' ? 0.08 : 0.2 });
        // Large convexRadius (1.0) makes the edges extremely round, preventing any catching
        const barrierShape = box.create({ halfExtents: [barrierThickness / 2, barrierHeight / 2, barrierSegmentLength / 2], convexRadius: 1.0 });

        // Festival Assets
        const stageGeom = new THREE.BoxGeometry(100, 30, 50);
        const stageMat = new THREE.MeshStandardMaterial({ color: '#050505', metalness: 1, roughness: 0.1 });
        const screenMat = new THREE.MeshBasicMaterial({ color: '#E91E63' });

        const grandstandGeom = new THREE.BoxGeometry(60, 15, 30);
        const grandstandMat = new THREE.MeshStandardMaterial({ color: '#333333' });

        // Create Barriers separately with fewer segments
        for (let i = 0; i < barrierSegments; i++) {
            const angle = (i / barrierSegments) * Math.PI * 2;
            const { x, z, dx, dz } = this.getTrackPoint(angle);
            const rotationY = Math.atan2(dx, dz);
            
            const len = Math.sqrt(dx*dx + dz*dz);
            const nx = dz / len;
            const nz = -dx / len;

            for (const side of [-1, 1]) {
                const bDist = (this.roadWidth / 2 + 6) * side;
                const bx = x + nx * bDist;
                const bz = z + nz * bDist;

                const bMesh = new THREE.Mesh(barrierGeom, barrierMat);
                bMesh.position.set(bx, barrierHeight / 2 - 0.1, bz);
                bMesh.rotation.y = rotationY;
                this.scene.add(bMesh);

                rigidBody.create(this.world, {
                    shape: barrierShape,
                    objectLayer: layerStatic,
                    motionType: MotionType.STATIC,
                    position: vec3.fromValues(bx, barrierHeight / 2 - 0.1, bz),
                    quaternion: quat.fromEuler(quat.create(), [0, (rotationY * 180) / Math.PI, 0]),
                    restitution: 0, // Zero restitution to prevent bouncing
                    friction: 0.05, // Very low friction to slide along walls
                });
            }
        }

        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const { x, z, dx, dz } = this.getTrackPoint(angle);
            const rotationY = Math.atan2(dx, dz);
            
            const len = Math.sqrt(dx*dx + dz*dz);
            const nx = dz / len;
            const nz = -dx / len;

            // Visual Road Segment
            const roadMesh = new THREE.Mesh(roadGeom, roadMat);
            roadMesh.position.set(x, 0, z); 
            roadMesh.rotation.y = rotationY;
            roadMesh.receiveShadow = true;
            this.scene.add(roadMesh);

            // Visual Terrain
            const terrainMesh = new THREE.Mesh(terrainGeom, terrainMat);
            terrainMesh.position.set(x, -0.05, z);
            terrainMesh.rotation.y = rotationY;
            terrainMesh.receiveShadow = true;
            this.scene.add(terrainMesh);

            // Road Lines
            if (i % 2 === 0) {
                const line = new THREE.Mesh(lineGeom, lineMat);
                line.position.set(x, 0.11, z);
                line.rotation.y = rotationY;
                this.scene.add(line);
            }

            // Environmental Character
            if (i === 0) {
                // --- Start/Finish Line Arch ---
                const archGroup = new THREE.Group();
                
                // Pillars
                const pillarGeom = new THREE.BoxGeometry(4, 25, 4);
                const pillarMat = new THREE.MeshStandardMaterial({ color: '#222222', metalness: 0.8, roughness: 0.2 });
                
                const leftPillar = new THREE.Mesh(pillarGeom, pillarMat);
                leftPillar.position.set(-(this.roadWidth / 2 + 2), 12.5, 0);
                archGroup.add(leftPillar);
                
                const rightPillar = new THREE.Mesh(pillarGeom, pillarMat);
                rightPillar.position.set(this.roadWidth / 2 + 2, 12.5, 0);
                archGroup.add(rightPillar);
                
                // Crossbar
                const crossbarGeom = new THREE.BoxGeometry(this.roadWidth + 8, 6, 4);
                const crossbar = new THREE.Mesh(crossbarGeom, pillarMat);
                crossbar.position.set(0, 22, 0);
                archGroup.add(crossbar);
                
                // Banner
                const bannerArchGeom = new THREE.PlaneGeometry(this.roadWidth + 4, 4);
                const bannerArchMat = new THREE.MeshBasicMaterial({ color: '#E91E63', side: THREE.DoubleSide });
                const bannerArch = new THREE.Mesh(bannerArchGeom, bannerArchMat);
                bannerArch.position.set(0, 22, 2.1);
                archGroup.add(bannerArch);
                
                // "START / FINISH" Text (Simulated with boxes for now)
                const textMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
                const textGeom = new THREE.BoxGeometry(this.roadWidth * 0.6, 1.5, 0.1);
                const textMesh = new THREE.Mesh(textGeom, textMat);
                textMesh.position.set(0, 22, 2.2);
                archGroup.add(textMesh);

                archGroup.position.set(x, 0, z);
                archGroup.rotation.y = rotationY;
                this.scene.add(archGroup);

                // Stage and Screen
                const stage = new THREE.Mesh(stageGeom, stageMat);
                const stageX = x + nx * 100;
                const stageZ = z + nz * 100;
                stage.position.set(stageX, 15, stageZ);
                stage.rotation.y = rotationY;
                this.scene.add(stage);

                const screen = new THREE.Mesh(new THREE.PlaneGeometry(80, 25), screenMat);
                screen.position.set(stageX - nx * 25, 18, stageZ - nz * 25);
                screen.rotation.y = rotationY;
                this.scene.add(screen);
            }

            if (i % 12 === 0 && i !== 0) {
                const stand = new THREE.Mesh(grandstandGeom, grandstandMat);
                const side = (i % 24 === 0) ? 1 : -1;
                const dist = (this.roadWidth / 2 + 45) * side;
                const sx = x + nx * dist;
                const sz = z + nz * dist;
                stand.position.set(sx, 7.5, sz);
                stand.rotation.y = rotationY;
                this.scene.add(stand);
            }

            if (i % 3 === 0) {
                const side = (i % 6 === 0) ? 1 : -1;
                const dist = (this.roadWidth / 2 + 25 + Math.random() * 40) * side;
                const tx = x + nx * dist;
                const tz = z + nz * dist;

                const trunk = new THREE.Mesh(treeTrunkGeom, treeTrunkMat);
                trunk.position.set(tx, 2.5, tz);
                this.scene.add(trunk);
                
                const isRound = Math.random() > 0.5;
                const top = new THREE.Mesh(isRound ? roundTreeTopGeom : treeTopGeom, isRound ? roundTreeTopMat : treeTopMat);
                top.position.set(tx, isRound ? 7.5 : 10, tz);
                this.scene.add(top);

                if (i % 9 === 0) {
                    const bx = x + nx * (this.roadWidth / 2 + 4) * side;
                    const bz = z + nz * (this.roadWidth / 2 + 4) * side;
                    const banner = new THREE.Mesh(bannerGeom, bannerMat);
                    banner.position.set(bx, 6, bz);
                    banner.rotation.y = rotationY;
                    this.scene.add(banner);
                }
            }
        }

        // Hot Air Balloons
        const balloonGeom = new THREE.SphereGeometry(15, 16, 16);
        const balloonColors = ['#E91E63', '#FFC107', '#2196F3', '#4CAF50', '#9C27B0', '#FF5722'];
        for (let i = 0; i < 15; i++) {
            const balloon = new THREE.Mesh(balloonGeom, new THREE.MeshStandardMaterial({ color: balloonColors[i % 6] }));
            const angle = Math.random() * Math.PI * 2;
            const { x, z, dx, dz } = this.getTrackPoint(angle);
            const len = Math.sqrt(dx*dx + dz*dz);
            const nx = dz / len;
            const nz = -dx / len;
            const dist = 300 + Math.random() * 400;
            balloon.position.set(
                x + nx * dist,
                80 + Math.random() * 100,
                z + nz * dist
            );
            this.scene.add(balloon);
        }
    }

    private createSupercarVehicle(layerMoving: number, queryFilter: any) {
        const chassisHalfWidth = 1.1;
        const chassisHalfHeight = 0.4;
        const chassisHalfLength = 2.5;

        const startPoint = this.getTrackPoint(0);

        const chassisShape = box.create({ halfExtents: [chassisHalfWidth, chassisHalfHeight, chassisHalfLength], convexRadius: 0.2 }); // More rounded edges
        const chassisBody = rigidBody.create(this.world, {
            shape: chassisShape,
            objectLayer: layerMoving,
            motionType: MotionType.DYNAMIC,
            position: vec3.fromValues(startPoint.x, 3, startPoint.z),
            quaternion: quat.fromEuler(quat.create(), [0, 0, 0]),
            mass: 1800, // Heavier for better stability at high speeds
            restitution: 0.05,
            friction: 0.5,
        });

        this.vehicle = createVehicle(chassisBody, queryFilter);

        const wheelRadius = 0.45;
        const wheelWidth = 0.4;
        const vehicleWidth = 2.6; // Wider for more stability
        const vehicleHeight = 0.2; // Slightly higher connection point
        const vehicleFront = -1.5;
        const vehicleBack = 1.5;

        const commonWheelOptions: Omit<WheelOptions, 'chassisConnectionPointLocal'> = {
            radius: wheelRadius,
            directionLocal: vec3.fromValues(0, -1, 0),
            axleLocal: vec3.fromValues(1, 0, 0),
            suspensionFrequency: 3.0, // Stiffer suspension to prevent rolling
            suspensionDamping: 1.2, 
            suspensionRestLength: 0.4, // Shorter suspension for lower COM
            maxSuspensionForce: 400000,
            maxSuspensionTravel: 0.4,
            suspensionForcePoint: null,
            sideFrictionStiffness: 3.0,
            frictionSlip: 4.0, 
            rollInfluence: 0.01,
            customSlidingRotationalSpeed: -40,
            useCustomSlidingRotationalSpeed: true,
            forwardAcceleration: 2.0,
            sideAcceleration: 2.0,
        };

        addWheel(this.vehicle, { ...commonWheelOptions, chassisConnectionPointLocal: vec3.fromValues(-vehicleWidth * 0.5, vehicleHeight, vehicleFront) });
        addWheel(this.vehicle, { ...commonWheelOptions, chassisConnectionPointLocal: vec3.fromValues(vehicleWidth * 0.5, vehicleHeight, vehicleFront) });
        addWheel(this.vehicle, { ...commonWheelOptions, chassisConnectionPointLocal: vec3.fromValues(-vehicleWidth * 0.5, vehicleHeight, vehicleBack) });
        addWheel(this.vehicle, { ...commonWheelOptions, chassisConnectionPointLocal: vec3.fromValues(vehicleWidth * 0.5, vehicleHeight, vehicleBack) });

        addAntiRollBar(this.vehicle, { leftWheel: 0, rightWheel: 1, stiffness: 20000 });
        addAntiRollBar(this.vehicle, { leftWheel: 2, rightWheel: 3, stiffness: 20000 });

        // --- Low-Poly Convertible Mesh ---
        this.chassisMesh = new THREE.Group();
        
        const carMat = new THREE.MeshPhysicalMaterial({ 
            color: this.carColor,
            roughness: 0.4,
            metalness: 0.1,
            clearcoat: 0.2,
            clearcoatRoughness: 0.2,
            flatShading: true
        });
        const darkMat = new THREE.MeshStandardMaterial({ color: '#333333', roughness: 0.8, flatShading: true });
        const glassMat = new THREE.MeshStandardMaterial({ color: '#222222', transparent: true, opacity: 0.6, roughness: 0.1, metalness: 0.8 });
        const lightMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
        const tailLightMat = new THREE.MeshBasicMaterial({ color: '#dd3333' });

        // Main Body Base
        const baseGeom = new THREE.BoxGeometry(chassisHalfWidth * 2, chassisHalfHeight * 1.2, chassisHalfLength * 2);
        const baseMesh = new THREE.Mesh(baseGeom, carMat);
        baseMesh.position.y = -chassisHalfHeight * 0.2;
        baseMesh.castShadow = true;
        this.chassisMesh.add(baseMesh);

        // Hood
        const hoodGeom = new THREE.BoxGeometry(chassisHalfWidth * 2, chassisHalfHeight * 0.6, chassisHalfLength * 0.8);
        const hoodMesh = new THREE.Mesh(hoodGeom, carMat);
        hoodMesh.position.set(0, chassisHalfHeight * 0.7, -chassisHalfLength * 0.6);
        hoodMesh.castShadow = true;
        this.chassisMesh.add(hoodMesh);

        // Trunk
        const trunkGeom = new THREE.BoxGeometry(chassisHalfWidth * 2, chassisHalfHeight * 0.6, chassisHalfLength * 0.5);
        const trunkMesh = new THREE.Mesh(trunkGeom, carMat);
        trunkMesh.position.set(0, chassisHalfHeight * 0.7, chassisHalfLength * 0.75);
        trunkMesh.castShadow = true;
        this.chassisMesh.add(trunkMesh);

        // Side panels
        const sideGeom = new THREE.BoxGeometry(0.2, chassisHalfHeight * 0.6, chassisHalfLength * 0.7);
        const sideL = new THREE.Mesh(sideGeom, carMat);
        sideL.position.set(-chassisHalfWidth + 0.1, chassisHalfHeight * 0.7, chassisHalfLength * 0.15);
        sideL.castShadow = true;
        this.chassisMesh.add(sideL);
        const sideR = new THREE.Mesh(sideGeom, carMat);
        sideR.position.set(chassisHalfWidth - 0.1, chassisHalfHeight * 0.7, chassisHalfLength * 0.15);
        sideR.castShadow = true;
        this.chassisMesh.add(sideR);

        // Dashboard
        const dashGeom = new THREE.BoxGeometry(chassisHalfWidth * 2, chassisHalfHeight * 0.5, 0.4);
        const dashMesh = new THREE.Mesh(dashGeom, darkMat);
        dashMesh.position.set(0, chassisHalfHeight * 0.65, -chassisHalfLength * 0.1);
        this.chassisMesh.add(dashMesh);

        // Windshield Frame
        const frameGeom = new THREE.BoxGeometry(chassisHalfWidth * 2, chassisHalfHeight * 1.5, 0.1);
        const frameMesh = new THREE.Mesh(frameGeom, darkMat);
        frameMesh.position.set(0, chassisHalfHeight * 1.75, -chassisHalfLength * 0.15);
        frameMesh.rotation.x = -Math.PI / 8;
        this.chassisMesh.add(frameMesh);

        // Windshield Glass
        const glassGeom = new THREE.BoxGeometry(chassisHalfWidth * 1.8, chassisHalfHeight * 1.3, 0.12);
        const glassMesh = new THREE.Mesh(glassGeom, glassMat);
        glassMesh.position.set(0, chassisHalfHeight * 1.75, -chassisHalfLength * 0.15);
        glassMesh.rotation.x = -Math.PI / 8;
        this.chassisMesh.add(glassMesh);

        // Mirrors
        const mirrorGeom = new THREE.BoxGeometry(0.3, 0.2, 0.2);
        const mirrorL = new THREE.Mesh(mirrorGeom, darkMat);
        mirrorL.position.set(-chassisHalfWidth - 0.15, chassisHalfHeight * 1.5, -chassisHalfLength * 0.1);
        this.chassisMesh.add(mirrorL);
        const mirrorR = new THREE.Mesh(mirrorGeom, darkMat);
        mirrorR.position.set(chassisHalfWidth + 0.15, chassisHalfHeight * 1.5, -chassisHalfLength * 0.1);
        this.chassisMesh.add(mirrorR);

        // Bumpers
        const bumperGeom = new THREE.BoxGeometry(chassisHalfWidth * 2.1, 0.25, 0.3);
        const frontBumper = new THREE.Mesh(bumperGeom, darkMat);
        frontBumper.position.set(0, -chassisHalfHeight * 0.2, -chassisHalfLength - 0.05);
        this.chassisMesh.add(frontBumper);

        const rearBumper = new THREE.Mesh(bumperGeom, darkMat);
        rearBumper.position.set(0, -chassisHalfHeight * 0.2, chassisHalfLength + 0.05);
        this.chassisMesh.add(rearBumper);

        // Headlights
        const headLightGeom = new THREE.BoxGeometry(0.5, 0.2, 0.1);
        const headL = new THREE.Mesh(headLightGeom, lightMat);
        headL.position.set(-0.7, chassisHalfHeight * 0.7, -chassisHalfLength - 0.01);
        const headR = new THREE.Mesh(headLightGeom, lightMat);
        headR.position.set(0.7, chassisHalfHeight * 0.7, -chassisHalfLength - 0.01);
        this.chassisMesh.add(headL);
        this.chassisMesh.add(headR);

        // Tail lights
        const tailLightGeom = new THREE.BoxGeometry(0.4, 0.15, 0.1);
        const tailL = new THREE.Mesh(tailLightGeom, tailLightMat);
        tailL.position.set(-0.7, chassisHalfHeight * 0.7, chassisHalfLength + 0.01);
        const tailR = new THREE.Mesh(tailLightGeom, tailLightMat);
        tailR.position.set(0.7, chassisHalfHeight * 0.7, chassisHalfLength + 0.01);
        this.chassisMesh.add(tailL);
        this.chassisMesh.add(tailR);

        // Exhaust
        const exhaustGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
        const exhaustMat = new THREE.MeshStandardMaterial({ color: '#aaaaaa', metalness: 0.8, roughness: 0.2 });
        const exhaustL = new THREE.Mesh(exhaustGeom, exhaustMat);
        exhaustL.rotation.x = Math.PI / 2;
        exhaustL.position.set(-0.2, -chassisHalfHeight * 0.9, chassisHalfLength + 0.1);
        const exhaustR = new THREE.Mesh(exhaustGeom, exhaustMat);
        exhaustR.rotation.x = Math.PI / 2;
        exhaustR.position.set(0.2, -chassisHalfHeight * 0.9, chassisHalfLength + 0.1);
        this.chassisMesh.add(exhaustL);
        this.chassisMesh.add(exhaustR);

        // Steering wheel (Right side)
        const wheelGeom2 = new THREE.TorusGeometry(0.25, 0.05, 8, 16);
        const steeringWheel = new THREE.Mesh(wheelGeom2, darkMat);
        steeringWheel.position.set(0.5, chassisHalfHeight * 1.0, 0.1);
        steeringWheel.rotation.x = -Math.PI / 4;
        this.chassisMesh.add(steeringWheel);

        // Cat driver (Right side)
        const catGroup = new THREE.Group();
        const catHeadGeom = new THREE.SphereGeometry(0.35, 16, 16);
        const catMat = new THREE.MeshStandardMaterial({ color: '#cccccc', roughness: 0.9, flatShading: true });
        const catHead = new THREE.Mesh(catHeadGeom, catMat);
        catGroup.add(catHead);

        const earGeom = new THREE.ConeGeometry(0.15, 0.25, 4);
        const earL = new THREE.Mesh(earGeom, catMat);
        earL.position.set(-0.2, 0.25, 0);
        earL.rotation.z = Math.PI / 6;
        catGroup.add(earL);
        const earR = new THREE.Mesh(earGeom, catMat);
        earR.position.set(0.2, 0.25, 0);
        earR.rotation.z = -Math.PI / 6;
        catGroup.add(earR);

        catGroup.position.set(0.5, chassisHalfHeight * 1.4, 0.4);
        this.chassisMesh.add(catGroup);

        // Seats
        const seatGeom = new THREE.BoxGeometry(0.8, 0.8, 0.2);
        const seatL = new THREE.Mesh(seatGeom, darkMat);
        seatL.position.set(-0.5, chassisHalfHeight * 0.8, 0.7);
        seatL.rotation.x = -Math.PI / 12;
        this.chassisMesh.add(seatL);
        const seatR = new THREE.Mesh(seatGeom, darkMat);
        seatR.position.set(0.5, chassisHalfHeight * 0.8, 0.7);
        seatR.rotation.x = -Math.PI / 12;
        this.chassisMesh.add(seatR);

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

    private setupJuice() {
        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
        for (let i = 0; i < 40; i++) {
            const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -5)];
            const geom = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geom, lineMat.clone());
            line.visible = false;
            this.scene.add(line);
            this.speedLines.push(line);
        }
    }

    private updateJuice(delta: number, speed: number) {
        // Speed Lines
        const speedThreshold = 180;
        const maxOpacity = 0.6;
        const opacity = Math.max(0, Math.min(maxOpacity, (speed - speedThreshold) / 100));

        const cameraForward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const cameraRight = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);

        this.speedLines.forEach((line, i) => {
            if (speed > speedThreshold) {
                if (!line.visible) {
                    line.visible = true;
                    const spreadX = (Math.random() - 0.5) * 40;
                    const spreadY = (Math.random() - 0.5) * 20;
                    const spreadZ = -50 - Math.random() * 50;
                    
                    line.position.copy(this.camera.position)
                        .add(cameraRight.clone().multiplyScalar(spreadX))
                        .add(cameraUp.clone().multiplyScalar(spreadY))
                        .add(cameraForward.clone().multiplyScalar(spreadZ));
                    
                    line.quaternion.copy(this.camera.quaternion);
                }
                
                // Move line towards camera
                const toCamera = new THREE.Vector3().subVectors(this.camera.position, line.position);
                const dist = toCamera.length();
                line.position.add(cameraForward.clone().multiplyScalar(-speed * delta * 0.5));
                (line.material as THREE.LineBasicMaterial).opacity = opacity;

                if (dist < 10 || dist > 150) {
                    line.visible = false; // Reset next frame
                }
            } else {
                line.visible = false;
            }
        });

        // Shake
        this.shakeAmount += (this.targetShake - this.shakeAmount) * 0.1;
        this.targetShake *= 0.9; // Decay
        
        if (speed > 250) {
            this.shakeAmount += (speed - 250) * 0.0001;
        }

        if (this.shakeAmount > 0.01) {
            this.camera.position.x += (Math.random() - 0.5) * this.shakeAmount;
            this.camera.position.y += (Math.random() - 0.5) * this.shakeAmount;
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
                case 'KeyR': this.resetCar(); break;
                case 'Escape': this.togglePause(); break;
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

    public togglePause() {
        this.state.isPaused = !this.state.isPaused;
        this.notifyStateChange();
    }

    public restart() {
        this.resetCar();
        this.state.currentLapTime = 0;
        this.state.laps = 0;
        this.state.lastLapTime = 0;
        this.state.bestLapTime = 0;
        this.state.speed = 0;
        this.state.nitro = 100;
        this.state.distance = 0;
        this.state.gameOver = false;
        this.state.isPaused = false;
        this.raceStarted = false;
        this.hasPassedCheckpoint = false;
        this.lastAngle = 0;
        this.notifyStateChange();
    }

    private resetCar() {
        const cb = this.vehicle.chassisBody;
        
        // Find current position on the track
        const angle = Math.atan2(cb.position[2], cb.position[0]);
        const x = Math.cos(angle) * this.roadRadius;
        const z = Math.sin(angle) * this.roadRadius;
        const rotationY = -angle;

        // Reset position and rotation
        cb.position[0] = x;
        cb.position[1] = 2; // Slightly above ground
        cb.position[2] = z;
        
        const q = quat.fromEuler(quat.create(), [0, (rotationY * 180) / Math.PI, 0]);
        cb.quaternion[0] = q[0];
        cb.quaternion[1] = q[1];
        cb.quaternion[2] = q[2];
        cb.quaternion[3] = q[3];

        // Reset velocities
        vec3.zero(cb.motionProperties.linearVelocity);
        vec3.zero(cb.motionProperties.angularVelocity);
        
        this.flipTimer = 0;
        this.shakeAmount = 0.5; // Visual feedback
    }

    private updateResetLogic(delta: number) {
        const cb = this.vehicle.chassisBody;
        
        // Check if car is upside down (Up vector dot World Up < 0)
        const up = vec3.fromValues(0, 1, 0);
        vec3.transformQuat(up, up, cb.quaternion);
        
        if (up[1] < 0.2) { // Car is tilted or upside down
            this.flipTimer += delta;
            if (this.flipTimer > 3.0) { // Auto-reset after 3 seconds
                this.resetCar();
            }
        } else {
            this.flipTimer = 0;
        }
    }

    private animate = () => {
        this.animationFrameId = requestAnimationFrame(this.animate);

        const now = performance.now();
        const delta = Math.min((now - this.lastTime) / 1000, 1 / 30);
        this.lastTime = now;

        if (this.state.gameOver) return;

        if (this.state.isPaused) {
            this.renderer.render(this.scene, this.camera);
            return;
        }

        // Apply controls
        let engineForce = 0;
        let steering = 0;
        let maxForce = 6000; 
        const maxSteer = 0.35;
        const maxBrake = 200;

        // Nitro Logic
        let nitroActive = false;
        if (this.controls.nitro && this.state.nitro > 5) { // Minimum 5% to start nitro
            maxForce *= 2.5;
            this.state.nitro = Math.max(0, this.state.nitro - delta * 40);
            nitroActive = true;
        } else {
            this.state.nitro = Math.min(100, this.state.nitro + delta * 8);
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

        this.updateResetLogic(delta);

        const cb = this.vehicle.chassisBody;
        this.state.carPosition = { x: cb.position[0], z: cb.position[2] };
        
        // Juice
        this.updateJuice(delta, this.state.speed);

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
        
        // Distance Progress (Angle-based)
        let carAngle = 0;
        if (this.trackId === 'oval') {
            carAngle = Math.atan2(cb.position[2] / 400, cb.position[0] / 800);
        } else {
            carAngle = Math.atan2(cb.position[2], cb.position[0]);
        }
        const normalizedAngle = (carAngle + Math.PI) / (2 * Math.PI);
        this.state.distance = normalizedAngle * 100;

        // Checkpoint Detection (Halfway point at angle PI or -PI)
        if (Math.abs(carAngle) > 3) {
            this.hasPassedCheckpoint = true;
        }

        // Lap Timing
        if (!this.raceStarted && (this.controls.forward || this.controls.backward || this.controls.left || this.controls.right)) {
            this.raceStarted = true;
        }

        if (this.raceStarted && !this.state.gameOver) {
            this.state.currentLapTime += delta;
        }

        // Lap Detection (Crossing angle 0)
        const crossedStart = (this.lastAngle < 0 && carAngle >= 0) || (this.lastAngle > 0 && carAngle <= 0);
        const notAtBack = Math.abs(this.lastAngle - carAngle) < Math.PI;
        
        if (crossedStart && notAtBack && this.hasPassedCheckpoint) {
            this.state.laps++;
            this.state.lastLapTime = this.state.currentLapTime;
            
            if (this.state.bestLapTime === 0 || this.state.lastLapTime < this.state.bestLapTime) {
                this.state.bestLapTime = this.state.lastLapTime;
            }
            
            this.state.currentLapTime = 0;
            this.hasPassedCheckpoint = false; // Reset for next lap
        }

        this.lastAngle = carAngle;

        if (this.animationFrameId % 5 === 0) {
            this.notifyStateChange();
        }

        // Dynamic FOV based on speed and nitro
        let targetFov = 70 + (speed * 0.5);
        if (nitroActive) targetFov += 15;
        
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

        this.renderer.render(this.scene, this.camera);
    };

    public cleanup() {
        cancelAnimationFrame(this.animationFrameId);
        clearInterval(this.timerId);
        this.renderer.dispose();
    }
}
