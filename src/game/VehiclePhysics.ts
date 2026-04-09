import * as THREE from 'three';
import {
    addBroadphaseLayer,
    addObjectLayer,
    box,
    CastRayStatus,
    castRay,
    createClosestCastRayCollector,
    createDefaultCastRaySettings,
    createWorld,
    createWorldSettings,
    enableCollision,
    filter,
    MotionType,
    registerAll,
    rigidBody,
    triangleMesh,
    updateWorld,
    World,
    RigidBody
} from 'crashcat';
import { mat4, quat, vec3, Mat4, Quat, Vec3 } from 'mathcat';

// --- Types & Interfaces ---

export type VehicleState = {
    sliding: boolean;
    currentVehicleSpeedKmHour: number;
};

export type WheelState = {
    suspensionLength: number;
    suspensionRelativeVelocity: number;
    suspensionForce: number;
    clippedInvContactDotSuspension: number;

    inContactWithGround: boolean;
    hitPointWorld: Vec3;
    hitNormalWorld: Vec3;

    directionWorld: Vec3;
    axleWorld: Vec3;

    chassisConnectionPointWorld: Vec3;

    sideImpulse: number;
    forwardImpulse: number;

    forwardWS: Vec3;
    axle: Vec3;

    worldTransformPosition: Vec3;
    worldTransformQuaternion: Quat;

    engineForce: number;
    brakeForce: number;
    steering: number;

    rotation: number;
    deltaRotation: number;

    groundBody: RigidBody | null;

    slipInfo: number;
    skidInfo: number;

    sliding: boolean;
};

export type WheelOptions = {
    radius: number;
    directionLocal: Vec3;
    axleLocal: Vec3;
    suspensionFrequency: number;
    suspensionDamping: number;
    suspensionRestLength: number;
    maxSuspensionForce: number;
    maxSuspensionTravel: number;
    suspensionForcePoint: Vec3 | null;
    sideFrictionStiffness: number;
    frictionSlip: number;
    rollInfluence: number;
    customSlidingRotationalSpeed: number;
    useCustomSlidingRotationalSpeed: boolean;
    forwardAcceleration: number;
    sideAcceleration: number;
    chassisConnectionPointLocal: Vec3;
};

export type Wheel = {
    state: WheelState;
    options: WheelOptions;
};

export type AntiRollBar = {
    leftWheel: number;
    rightWheel: number;
    stiffness: number;
};

export type Vehicle = {
    wheels: Wheel[];
    state: VehicleState;
    chassisBody: RigidBody;
    chassisWorldMatrix: Mat4;
    chassisInvRotationMatrix: Mat4;
    queryFilter: ReturnType<typeof filter.create>;
    antiRollBars: AntiRollBar[];
};

// --- Vehicle Creation ---

export function createVehicle(chassisBody: RigidBody, queryFilter: ReturnType<typeof filter.create>): Vehicle {
    return {
        wheels: [],
        state: { sliding: false, currentVehicleSpeedKmHour: 0 },
        chassisBody,
        chassisWorldMatrix: mat4.create(),
        chassisInvRotationMatrix: mat4.create(),
        queryFilter,
        antiRollBars: [],
    };
}

export function addAntiRollBar(vehicle: Vehicle, arb: AntiRollBar): void {
    vehicle.antiRollBars.push(arb);
}

function createWheelState(): WheelState {
    return {
        suspensionLength: 0, suspensionForce: 0, suspensionRelativeVelocity: 0,
        clippedInvContactDotSuspension: 1, directionWorld: vec3.create(),
        inContactWithGround: false, hitNormalWorld: vec3.create(), hitPointWorld: vec3.create(),
        chassisConnectionPointWorld: vec3.create(), axleWorld: vec3.create(),
        sideImpulse: 0, forwardImpulse: 0, forwardWS: vec3.create(), axle: vec3.create(),
        worldTransformPosition: vec3.create(), worldTransformQuaternion: quat.create(),
        steering: 0, brakeForce: 0, engineForce: 0, rotation: 0, deltaRotation: 0,
        groundBody: null, slipInfo: 0, skidInfo: 0, sliding: false,
    };
}

export function addWheel(vehicle: Vehicle, options: WheelOptions): number {
    vehicle.wheels.push({ options, state: createWheelState() });
    return vehicle.wheels.length - 1;
}

export function setEngineForce(vehicle: Vehicle, force: number, wheelIndex: number): void {
    vehicle.wheels[wheelIndex].state.engineForce = force;
}

export function setSteeringValue(vehicle: Vehicle, steering: number, wheelIndex: number): void {
    vehicle.wheels[wheelIndex].state.steering = steering;
}

export function setBrakeValue(vehicle: Vehicle, brake: number, wheelIndex: number): void {
    vehicle.wheels[wheelIndex].state.brakeForce = brake;
}

// --- Physics Helpers ---

const vehicleRayCollector = createClosestCastRayCollector();
const vehicleRaySettings = createDefaultCastRaySettings();

function updateChassisMatrices(vehicle: Vehicle): void {
    mat4.fromRotationTranslation(vehicle.chassisWorldMatrix, vehicle.chassisBody.quaternion, vehicle.chassisBody.position);
    mat4.fromQuat(vehicle.chassisInvRotationMatrix, vehicle.chassisBody.quaternion);
    mat4.transpose(vehicle.chassisInvRotationMatrix, vehicle.chassisInvRotationMatrix);
}

function getVehicleAxisWorld(out: Vec3, vehicle: Vehicle, axisIndex: number): Vec3 {
    const col = axisIndex * 4;
    out[0] = vehicle.chassisWorldMatrix[col];
    out[1] = vehicle.chassisWorldMatrix[col + 1];
    out[2] = vehicle.chassisWorldMatrix[col + 2];
    return out;
}

const _resolveBilateral_vel1 = vec3.create();
const _resolveBilateral_vel2 = vec3.create();
const _resolveBilateral_vel = vec3.create();

function resolveSingleBilateralConstraint(body1: RigidBody, pos1: Vec3, body2: RigidBody, pos2: Vec3, normal: Vec3): number {
    const normalLenSqr = vec3.squaredLength(normal);
    if (normalLenSqr > 1.1) return 0;

    rigidBody.getVelocityAtPoint(_resolveBilateral_vel1, body1, pos1);
    rigidBody.getVelocityAtPoint(_resolveBilateral_vel2, body2, pos2);
    vec3.subtract(_resolveBilateral_vel, _resolveBilateral_vel1, _resolveBilateral_vel2);

    const relVel = vec3.dot(normal, _resolveBilateral_vel);
    const contactDamping = 0.2;
    const massTerm = 1 / (body1.motionProperties.invMass + body2.motionProperties.invMass);
    return -contactDamping * relVel * massTerm;
}

const _computeImpulseDenominator_r0 = vec3.create();
const _computeImpulseDenominator_c0 = vec3.create();
const _computeImpulseDenominator_vec = vec3.create();
const _computeImpulseDenominator_m = vec3.create();
const _computeImpulseDenominator_invInertia = mat4.create();

function computeImpulseDenominator(body: RigidBody, pos: Vec3, normal: Vec3): number {
    const r0 = _computeImpulseDenominator_r0;
    const c0 = _computeImpulseDenominator_c0;
    const vec = _computeImpulseDenominator_vec;
    const m = _computeImpulseDenominator_m;

    rigidBody.getInverseInertia(_computeImpulseDenominator_invInertia, body);
    vec3.subtract(r0, pos, body.position);
    vec3.cross(c0, r0, normal);
    vec3.transformMat4(m, c0, _computeImpulseDenominator_invInertia);
    vec3.cross(vec, m, r0);

    return body.motionProperties.invMass + vec3.dot(normal, vec);
}

const _calcRollingFriction_vel1 = vec3.create();
const _calcRollingFriction_vel2 = vec3.create();
const _calcRollingFriction_vel = vec3.create();

function calcRollingFriction(body0: RigidBody, body1: RigidBody, frictionPosWorld: Vec3, frictionDirectionWorld: Vec3, maxImpulse: number): number {
    rigidBody.getVelocityAtPoint(_calcRollingFriction_vel1, body0, frictionPosWorld);
    rigidBody.getVelocityAtPoint(_calcRollingFriction_vel2, body1, frictionPosWorld);
    vec3.subtract(_calcRollingFriction_vel, _calcRollingFriction_vel1, _calcRollingFriction_vel2);

    const vrel = vec3.dot(frictionDirectionWorld, _calcRollingFriction_vel);
    const denom0 = computeImpulseDenominator(body0, frictionPosWorld, frictionDirectionWorld);
    const denom1 = computeImpulseDenominator(body1, frictionPosWorld, frictionDirectionWorld);

    const jacDiagABInv = 1 / (denom0 + denom1);
    let j1 = -vrel * jacDiagABInv;

    if (maxImpulse < j1) j1 = maxImpulse;
    if (j1 < -maxImpulse) j1 = -maxImpulse;

    return j1;
}

// --- Vehicle Update Logic ---

function resetStates(vehicle: Vehicle): void {
    vehicle.state.sliding = false;
    for (const wheel of vehicle.wheels) {
        wheel.state.inContactWithGround = false;
        wheel.state.groundBody = null;
    }
}

function updateWheelTransformWorld(vehicle: Vehicle, wheel: Wheel): void {
    vec3.transformMat4(wheel.state.chassisConnectionPointWorld, wheel.options.chassisConnectionPointLocal, vehicle.chassisWorldMatrix);
    mat4.multiply3x3Vec(wheel.state.directionWorld, vehicle.chassisWorldMatrix, wheel.options.directionLocal);
    mat4.multiply3x3Vec(wheel.state.axleWorld, vehicle.chassisWorldMatrix, wheel.options.axleLocal);
}

const _updateWheelTransform_up = vec3.create();
const _updateWheelTransform_right = vec3.create();
const _updateWheelTransform_fwd = vec3.create();
const _updateWheelTransform_steeringQuat = quat.create();
const _updateWheelTransform_rotatingQuat = quat.create();
const _updateWheelTransform_chassisQuat = quat.create();
const _updateWheelTransform_tmpQuat = quat.create();

function updateWheelTransform(vehicle: Vehicle): void {
    for (const wheel of vehicle.wheels) {
        updateWheelTransformWorld(vehicle, wheel);

        const up = _updateWheelTransform_up;
        const right = _updateWheelTransform_right;
        const fwd = _updateWheelTransform_fwd;

        vec3.copy(up, wheel.options.directionLocal);
        vec3.scale(up, up, -1);
        vec3.copy(right, wheel.options.axleLocal);
        vec3.cross(fwd, up, right);
        vec3.normalize(fwd, fwd);
        vec3.normalize(right, right);

        quat.setAxisAngle(_updateWheelTransform_steeringQuat, up, wheel.state.steering);
        quat.setAxisAngle(_updateWheelTransform_rotatingQuat, right, wheel.state.rotation);

        quat.copy(_updateWheelTransform_chassisQuat, vehicle.chassisBody.quaternion);
        quat.multiply(_updateWheelTransform_tmpQuat, _updateWheelTransform_chassisQuat, _updateWheelTransform_steeringQuat);
        quat.multiply(wheel.state.worldTransformQuaternion, _updateWheelTransform_tmpQuat, _updateWheelTransform_rotatingQuat);
        quat.normalize(wheel.state.worldTransformQuaternion, wheel.state.worldTransformQuaternion);

        vec3.copy(wheel.state.worldTransformPosition, wheel.state.directionWorld);
        vec3.scale(wheel.state.worldTransformPosition, wheel.state.worldTransformPosition, wheel.state.suspensionLength);
        vec3.add(wheel.state.worldTransformPosition, wheel.state.worldTransformPosition, wheel.state.chassisConnectionPointWorld);
    }
}

const _updateCurrentSpeed_chassisVelocity = vec3.create();
const _updateCurrentSpeed_forwardWorld = vec3.create();

function updateCurrentSpeed(vehicle: Vehicle): void {
    vec3.copy(_updateCurrentSpeed_chassisVelocity, vehicle.chassisBody.motionProperties.linearVelocity);
    vehicle.state.currentVehicleSpeedKmHour = 3.6 * vec3.length(_updateCurrentSpeed_chassisVelocity);
    getVehicleAxisWorld(_updateCurrentSpeed_forwardWorld, vehicle, 2);
    if (vec3.dot(_updateCurrentSpeed_forwardWorld, _updateCurrentSpeed_chassisVelocity) > 0) {
        vehicle.state.currentVehicleSpeedKmHour *= -1;
    }
}

const _updateWheelSuspension_hitPoint = vec3.create();
const _updateWheelSuspension_hitNormal = vec3.create();
const _updateWheelSuspension_direction = vec3.create();
const _updateWheelSuspension_chassisVelAtContact = vec3.create();
const _computeEffectiveMass_forcePoint = vec3.create();
const _computeEffectiveMass_forcePointCrossUp = vec3.create();
const _computeEffectiveMass_negUp = vec3.create();
const _computeEffectiveMass_temp = vec3.create();

function updateWheelSuspension(world: World, vehicle: Vehicle): void {
    for (const wheel of vehicle.wheels) {
        updateWheelTransformWorld(vehicle, wheel);

        const maxSuspensionLength = wheel.options.suspensionRestLength + wheel.options.maxSuspensionTravel;
        const rayLength = wheel.options.radius + maxSuspensionLength;
        const origin = wheel.state.chassisConnectionPointWorld;

        vec3.copy(_updateWheelSuspension_direction, wheel.state.directionWorld);
        vec3.normalize(_updateWheelSuspension_direction, _updateWheelSuspension_direction);

        const chassisId = vehicle.chassisBody.id;
        vehicle.queryFilter.bodyFilter = (body: RigidBody) => body.id !== chassisId;

        vehicleRayCollector.reset();
        castRay(world, vehicleRayCollector, vehicleRaySettings, origin, _updateWheelSuspension_direction, rayLength, vehicle.queryFilter);

        const hit = vehicleRayCollector.hit;
        const hitBody = hit.status === CastRayStatus.COLLIDING ? rigidBody.get(world, hit.bodyIdB) : undefined;

        if (hit.status === CastRayStatus.COLLIDING && hitBody) {
            wheel.state.groundBody = hitBody;
            wheel.state.inContactWithGround = true;

            const hitDistance = hit.fraction * rayLength;
            vec3.scaleAndAdd(_updateWheelSuspension_hitPoint, origin, _updateWheelSuspension_direction, hitDistance);
            vec3.copy(wheel.state.hitPointWorld, _updateWheelSuspension_hitPoint);

            rigidBody.getSurfaceNormal(_updateWheelSuspension_hitNormal, hitBody, wheel.state.hitPointWorld, hit.subShapeId);
            vec3.copy(wheel.state.hitNormalWorld, _updateWheelSuspension_hitNormal);

            wheel.state.suspensionLength = hitDistance - wheel.options.radius;

            const minSuspensionLength = wheel.options.suspensionRestLength - wheel.options.maxSuspensionTravel;
            if (wheel.state.suspensionLength < minSuspensionLength) wheel.state.suspensionLength = minSuspensionLength;
            if (wheel.state.suspensionLength > maxSuspensionLength) {
                wheel.state.suspensionLength = maxSuspensionLength;
                wheel.state.groundBody = null;
                wheel.state.inContactWithGround = false;
                vec3.zero(wheel.state.hitNormalWorld);
                vec3.zero(wheel.state.hitPointWorld);
            }

            const denominator = vec3.dot(wheel.state.hitNormalWorld, wheel.state.directionWorld);
            rigidBody.getVelocityAtPoint(_updateWheelSuspension_chassisVelAtContact, vehicle.chassisBody, wheel.state.hitPointWorld);
            const projVel = vec3.dot(wheel.state.hitNormalWorld, _updateWheelSuspension_chassisVelAtContact);

            if (denominator >= -0.1) {
                wheel.state.suspensionRelativeVelocity = 0;
                wheel.state.clippedInvContactDotSuspension = 1 / 0.1;
            } else {
                const inv = -1 / denominator;
                wheel.state.suspensionRelativeVelocity = projVel * inv;
                wheel.state.clippedInvContactDotSuspension = inv;
            }
        } else {
            wheel.state.suspensionLength = wheel.options.suspensionRestLength;
            wheel.state.suspensionRelativeVelocity = 0;
            vec3.copy(wheel.state.hitNormalWorld, wheel.state.directionWorld);
            vec3.scale(wheel.state.hitNormalWorld, wheel.state.hitNormalWorld, -1);
            wheel.state.clippedInvContactDotSuspension = 1.0;
        }

        wheel.state.suspensionForce = 0;
        if (wheel.state.inContactWithGround) {
            const lengthDifference = wheel.options.suspensionRestLength - wheel.state.suspensionLength;

            let forcePointLocal: Vec3;
            if (wheel.options.suspensionForcePoint !== null) {
                forcePointLocal = wheel.options.suspensionForcePoint;
            } else {
                vec3.copy(_computeEffectiveMass_forcePoint, wheel.options.chassisConnectionPointLocal);
                vec3.scaleAndAdd(_computeEffectiveMass_forcePoint, _computeEffectiveMass_forcePoint, wheel.options.directionLocal, 0.5 * maxSuspensionLength);
                forcePointLocal = _computeEffectiveMass_forcePoint;
            }

            const mp = vehicle.chassisBody.motionProperties;
            vec3.negate(_computeEffectiveMass_negUp, wheel.options.directionLocal);
            vec3.cross(_computeEffectiveMass_forcePointCrossUp, forcePointLocal, _computeEffectiveMass_negUp);

            const invInertiaDiag = mp.invInertiaDiagonal;
            const rCrossUp = _computeEffectiveMass_forcePointCrossUp;
            vec3.set(_computeEffectiveMass_temp, rCrossUp[0] * invInertiaDiag[0], rCrossUp[1] * invInertiaDiag[1], rCrossUp[2] * invInertiaDiag[2]);

            const effectiveMass = 1.0 / (mp.invMass + vec3.dot(rCrossUp, _computeEffectiveMass_temp));
            const omega = 2.0 * Math.PI * wheel.options.suspensionFrequency;
            let stiffness = effectiveMass * omega * omega;
            let damping = 2.0 * effectiveMass * wheel.options.suspensionDamping * omega;

            const cosAngleCorrection = wheel.state.clippedInvContactDotSuspension;
            stiffness *= cosAngleCorrection;
            damping *= cosAngleCorrection;

            let force = stiffness * lengthDifference - damping * wheel.state.suspensionRelativeVelocity;
            wheel.state.suspensionForce = Math.max(0, force);
        }
    }
}

const _applyWheelSuspensionForce_impulse = vec3.create();

function applyWheelSuspensionForce(world: World, vehicle: Vehicle, delta: number): void {
    for (const wheel of vehicle.wheels) {
        const suspensionForce = Math.min(wheel.state.suspensionForce, wheel.options.maxSuspensionForce);
        vec3.copy(_applyWheelSuspensionForce_impulse, wheel.state.hitNormalWorld);
        vec3.scale(_applyWheelSuspensionForce_impulse, _applyWheelSuspensionForce_impulse, suspensionForce * delta);
        rigidBody.addImpulseAtPosition(world, vehicle.chassisBody, _applyWheelSuspensionForce_impulse, wheel.state.hitPointWorld);
    }

    for (const arb of vehicle.antiRollBars) {
        if (arb.stiffness <= 0) continue;
        const lw = vehicle.wheels[arb.leftWheel];
        const rw = vehicle.wheels[arb.rightWheel];

        if (lw.state.inContactWithGround && rw.state.inContactWithGround) {
            const diff = rw.state.suspensionLength - lw.state.suspensionLength;
            const impulse = diff * arb.stiffness * delta;

            vec3.copy(_applyWheelSuspensionForce_impulse, lw.state.hitNormalWorld);
            vec3.scale(_applyWheelSuspensionForce_impulse, _applyWheelSuspensionForce_impulse, -impulse);
            rigidBody.addImpulseAtPosition(world, vehicle.chassisBody, _applyWheelSuspensionForce_impulse, lw.state.hitPointWorld);

            vec3.copy(_applyWheelSuspensionForce_impulse, rw.state.hitNormalWorld);
            vec3.scale(_applyWheelSuspensionForce_impulse, _applyWheelSuspensionForce_impulse, impulse);
            rigidBody.addImpulseAtPosition(world, vehicle.chassisBody, _applyWheelSuspensionForce_impulse, rw.state.hitPointWorld);
        }
    }
}

const _updateFriction_surfNormalScaledProj = vec3.create();
const _updateFriction_impulse = vec3.create();
const _updateFriction_sideImp = vec3.create();
const _updateFriction_worldPos = vec3.create();
const _updateFriction_relPos = vec3.create();
const _updateFriction_rollInfluenceAdjustedWorldPos = vec3.create();
const directions: Vec3[] = [vec3.fromValues(1, 0, 0), vec3.fromValues(0, 1, 0), vec3.fromValues(0, 0, 1)];

function updateFriction(world: World, vehicle: Vehicle, delta: number): void {
    const surfNormalScaledProj = _updateFriction_surfNormalScaledProj;

    for (const wheel of vehicle.wheels) {
        wheel.state.sideImpulse = 0;
        wheel.state.forwardImpulse = 0;

        if (wheel.state.inContactWithGround && wheel.state.groundBody) {
            const axle = wheel.state.axle;
            const forwardWS = wheel.state.forwardWS;

            vec3.transformQuat(axle, directions[0], wheel.state.worldTransformQuaternion);
            const surfNormalWS = wheel.state.hitNormalWorld;
            const proj = vec3.dot(axle, surfNormalWS);

            vec3.copy(surfNormalScaledProj, surfNormalWS);
            vec3.scale(surfNormalScaledProj, surfNormalScaledProj, proj);
            vec3.subtract(axle, axle, surfNormalScaledProj);
            vec3.normalize(axle, axle);

            vec3.cross(forwardWS, surfNormalWS, axle);
            vec3.normalize(forwardWS, forwardWS);

            wheel.state.sideImpulse = resolveSingleBilateralConstraint(vehicle.chassisBody, wheel.state.hitPointWorld, wheel.state.groundBody, wheel.state.hitPointWorld, axle);
            wheel.state.sideImpulse *= wheel.options.sideFrictionStiffness;
        }
    }

    vehicle.state.sliding = false;

    for (const wheel of vehicle.wheels) {
        let rollingFriction = 0;
        wheel.state.slipInfo = 1;

        if (wheel.state.groundBody) {
            const maxImpulse = wheel.state.brakeForce ? wheel.state.brakeForce : 0;
            rollingFriction = calcRollingFriction(vehicle.chassisBody, wheel.state.groundBody, wheel.state.hitPointWorld, wheel.state.forwardWS, maxImpulse);
            rollingFriction += wheel.state.engineForce * delta;
            wheel.state.slipInfo *= maxImpulse / rollingFriction;
        }

        wheel.state.forwardImpulse = 0;
        wheel.state.skidInfo = 1;

        if (wheel.state.groundBody) {
            const maxImp = wheel.state.suspensionForce * delta * wheel.options.frictionSlip;
            wheel.state.forwardImpulse = rollingFriction;

            const x = (wheel.state.forwardImpulse * 0.5) / wheel.options.forwardAcceleration;
            const y = (wheel.state.sideImpulse * 1) / wheel.options.sideAcceleration;
            const impulseSquared = x * x + y * y;

            wheel.state.sliding = false;
            if (impulseSquared > maxImp * maxImp) {
                vehicle.state.sliding = true;
                wheel.state.sliding = true;
                wheel.state.skidInfo *= maxImp / Math.sqrt(impulseSquared);
            }
        }
    }

    if (vehicle.state.sliding) {
        for (const wheel of vehicle.wheels) {
            if (wheel.state.sideImpulse !== 0 && wheel.state.skidInfo < 1) {
                wheel.state.forwardImpulse *= wheel.state.skidInfo;
                wheel.state.sideImpulse *= wheel.state.skidInfo;
            }
        }
    }

    for (const wheel of vehicle.wheels) {
        vec3.copy(_updateFriction_worldPos, wheel.state.hitPointWorld);
        vec3.copy(_updateFriction_relPos, _updateFriction_worldPos);
        vec3.subtract(_updateFriction_relPos, _updateFriction_relPos, vehicle.chassisBody.position);

        if (wheel.state.forwardImpulse !== 0) {
            vec3.copy(_updateFriction_impulse, wheel.state.forwardWS);
            vec3.scale(_updateFriction_impulse, _updateFriction_impulse, wheel.state.forwardImpulse);
            rigidBody.addImpulseAtPosition(world, vehicle.chassisBody, _updateFriction_impulse, _updateFriction_worldPos);
        }

        if (wheel.state.sideImpulse !== 0) {
            vec3.copy(_updateFriction_sideImp, wheel.state.axle);
            vec3.scale(_updateFriction_sideImp, _updateFriction_sideImp, wheel.state.sideImpulse);

            mat4.multiply3x3Vec(_updateFriction_rollInfluenceAdjustedWorldPos, vehicle.chassisInvRotationMatrix, _updateFriction_relPos);
            _updateFriction_rollInfluenceAdjustedWorldPos[1] *= wheel.options.rollInfluence;
            mat4.multiply3x3Vec(_updateFriction_rollInfluenceAdjustedWorldPos, vehicle.chassisWorldMatrix, _updateFriction_rollInfluenceAdjustedWorldPos);
            vec3.add(_updateFriction_rollInfluenceAdjustedWorldPos, _updateFriction_rollInfluenceAdjustedWorldPos, vehicle.chassisBody.position);

            rigidBody.addImpulseAtPosition(world, vehicle.chassisBody, _updateFriction_sideImp, _updateFriction_rollInfluenceAdjustedWorldPos);
            vec3.scale(_updateFriction_sideImp, _updateFriction_sideImp, -1);
            rigidBody.addImpulseAtPosition(world, wheel.state.groundBody!, _updateFriction_sideImp, wheel.state.hitPointWorld);
        }
    }
}

const _updateWheelRotation_hitNormalScaledWithProj = vec3.create();
const _updateWheelRotation_fwd = vec3.create();
const _updateWheelRotation_vel = vec3.create();

function updateWheelRotation(vehicle: Vehicle, delta: number): void {
    for (const wheel of vehicle.wheels) {
        rigidBody.getVelocityAtPoint(_updateWheelRotation_vel, vehicle.chassisBody, wheel.state.chassisConnectionPointWorld);

        if (wheel.state.inContactWithGround) {
            getVehicleAxisWorld(_updateWheelRotation_fwd, vehicle, 2);
            const proj = vec3.dot(_updateWheelRotation_fwd, wheel.state.hitNormalWorld);
            vec3.copy(_updateWheelRotation_hitNormalScaledWithProj, wheel.state.hitNormalWorld);
            vec3.scale(_updateWheelRotation_hitNormalScaledWithProj, _updateWheelRotation_hitNormalScaledWithProj, proj);
            vec3.subtract(_updateWheelRotation_fwd, _updateWheelRotation_fwd, _updateWheelRotation_hitNormalScaledWithProj);
            const proj2 = vec3.dot(_updateWheelRotation_fwd, _updateWheelRotation_vel);
            wheel.state.deltaRotation = (proj2 * delta) / wheel.options.radius;
        }

        if ((wheel.state.sliding || !wheel.state.inContactWithGround) && wheel.state.engineForce !== 0 && wheel.options.useCustomSlidingRotationalSpeed) {
            wheel.state.deltaRotation = (wheel.state.engineForce > 0 ? 1 : -1) * wheel.options.customSlidingRotationalSpeed * delta;
        }

        if (Math.abs(wheel.state.brakeForce) > Math.abs(wheel.state.engineForce)) {
            wheel.state.deltaRotation = 0;
        }

        wheel.state.rotation += wheel.state.deltaRotation;
        wheel.state.deltaRotation *= 0.99;
    }
}

export function updateVehicle(world: World, vehicle: Vehicle, delta: number): void {
    updateChassisMatrices(vehicle);
    resetStates(vehicle);
    updateWheelTransform(vehicle);
    updateCurrentSpeed(vehicle);
    updateWheelSuspension(world, vehicle);
    applyWheelSuspensionForce(world, vehicle, delta);
    updateFriction(world, vehicle, delta);
    updateWheelRotation(vehicle, delta);
}
